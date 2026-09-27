import os
import shutil
import asyncio
import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any

from app.core.config import settings
from app.core.logging import logger
from app.crypto.hasher import SHA256Hasher
from app.processing.pipeline import pipeline
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager
from app.database.connection import async_session
from app.database.models import FileProcessingRecord
from sqlalchemy import select

class FileWatcher:
    """
    Continuous File Ingestion Service.
    Monitors data/incoming directory for new authorized telemetry files (.json, .jsonl, .csv).
    Validates identity, extracts records, runs them through the security pipeline,
    archives processed files, and updates connected dashboards via WebSockets.
    """
    
    def __init__(self):
        self.incoming_dir = settings.INCOMING_DIR
        self.processed_dir = settings.PROCESSED_DIR
        self._task: asyncio.Task = None
        self._poll_interval = 1.0 # 1 second poll for fast demonstration response

    async def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._watch_loop())
            logger.info(f"File Watcher started. Monitoring: {self.incoming_dir}")

    async def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            logger.info("File Watcher stopped.")

    async def _watch_loop(self):
        while True:
            try:
                await self._scan_incoming()
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in File Watcher scan loop: {e}", exc_info=True)
                await asyncio.sleep(2.0)

    async def _scan_incoming(self):
        if not self.incoming_dir.exists():
            return

        for filepath in self.incoming_dir.iterdir():
            if not filepath.is_file():
                continue
            
            # Supported formats
            ext = filepath.suffix.lower()
            if ext not in [".json", ".jsonl", ".csv"]:
                continue

            # Wait briefly to ensure file write has completed
            await asyncio.sleep(0.1)
            await self._process_file(filepath)

    async def _process_file(self, filepath: Path):
        filename = filepath.name
        ext = filepath.suffix.lower()
        file_type = ext.replace(".", "").upper()
        
        try:
            content_bytes = filepath.read_bytes()
            if not content_bytes:
                return # Empty file, wait for write
            
            file_hash = SHA256Hasher.digest(content_bytes)
            
            # Check if duplicate file
            async with async_session() as session:
                existing = await session.execute(
                    select(FileProcessingRecord).where(FileProcessingRecord.file_hash == file_hash)
                )
                if existing.scalar_one_or_none():
                    logger.warning(f"File {filename} (hash {file_hash[:8]}...) has already been processed. Skipping.")
                    # Move to processed archive to prevent continuous re-detection
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    dest = self.processed_dir / f"duplicate_{timestamp}_{filename}"
                    shutil.move(str(filepath), str(dest))
                    return

            logger.info(f"Detected new telemetry file: {filename} ({len(content_bytes)} bytes, hash: {file_hash[:8]}...)")
            
            # Parse records
            records, parse_err = self._parse_records(content_bytes, ext)
            if parse_err:
                logger.error(f"Failed to parse telemetry file {filename}: {parse_err}")
                await self._record_file_status(filename, file_hash, file_type, 0, "MALFORMED", parse_err)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                dest = self.processed_dir / f"failed_{timestamp}_{filename}"
                shutil.move(str(filepath), str(dest))
                return

            # Process each record through the security pipeline
            from app.api.endpoints_telemetry import normalize_and_seal_telemetry
            processed_count = 0
            for idx, record in enumerate(records):
                try:
                    sealed_rec = normalize_and_seal_telemetry(record, sequence_offset=idx)
                    await pipeline.process_packet(sealed_rec)
                    processed_count += 1
                except Exception as ex:
                    logger.error(f"Error processing packet record from {filename}: {ex}")

            # Record file success
            await self._record_file_status(filename, file_hash, file_type, processed_count, "PROCESSED", None)
            
            # Move to processed directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dest = self.processed_dir / f"{timestamp}_{filename}"
            shutil.move(str(filepath), str(dest))
            
            # Log audit and notify dashboard
            await audit_service.log_security_event(
                event_type="FILE_INGESTION_COMPLETED",
                severity="INFO",
                description=f"File {filename} ingested: {processed_count} packets processed through security pipeline",
                details={"file_hash": file_hash, "record_count": processed_count, "format": file_type}
            )
            await ws_manager.broadcast("file_processed", {
                "filename": filename,
                "file_hash": file_hash,
                "record_count": processed_count,
                "status": "PROCESSED",
                "processed_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"Successfully ingested and archived file: {filename} -> {dest.name}")

        except Exception as e:
            logger.error(f"Unexpected error processing file {filename}: {e}", exc_info=True)

    def _parse_records(self, content_bytes: bytes, ext: str) -> (List[Dict[str, Any]], str):
        records = []
        try:
            text = content_bytes.decode('utf-8')
            if ext == ".json":
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    records = parsed
                elif isinstance(parsed, dict):
                    # Could be single packet or container
                    if "packets" in parsed and isinstance(parsed["packets"], list):
                        records = parsed["packets"]
                    else:
                        records = [parsed]
            elif ext == ".jsonl":
                for line in text.splitlines():
                    line = line.strip()
                    if line:
                        records.append(json.loads(line))
            elif ext == ".csv":
                reader = csv.DictReader(text.splitlines())
                for row in reader:
                    records.append(dict(row))
            return records, None
        except Exception as e:
            return [], str(e)

    async def _record_file_status(self, filename: str, file_hash: str, file_type: str, count: int, status: str, err: str = None):
        try:
            async with async_session() as session:
                rec = FileProcessingRecord(
                    filename=filename,
                    file_hash=file_hash,
                    file_type=file_type,
                    record_count=count,
                    status=status,
                    error_message=err,
                    processed_at=datetime.now(timezone.utc)
                )
                session.add(rec)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to record file status in DB: {e}")

file_watcher = FileWatcher()
