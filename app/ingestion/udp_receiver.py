import asyncio
import json
from app.core.config import settings
from app.core.logging import logger
from app.processing.pipeline import pipeline

class TelemetryUDPProtocol(asyncio.DatagramProtocol):
    """
    Asyncio Datagram protocol for receiving raw tactical telemetry over UDP.
    """
    def __init__(self, loop):
        self.loop = loop
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport
        logger.info(f"UDP Telemetry Receiver active on {settings.UDP_HOST}:{settings.UDP_PORT}")

    def datagram_received(self, data: bytes, addr):
        try:
            text = data.decode('utf-8')
            packet_dict = json.loads(text)
            # Schedule pipeline processing in event loop
            asyncio.create_task(pipeline.process_packet(packet_dict))
        except Exception as e:
            logger.warning(f"Malformed UDP datagram received from {addr}: {e}")

class UDPReceiverService:
    def __init__(self):
        self.transport = None
        self.protocol = None

    async def start(self):
        loop = asyncio.get_running_loop()
        try:
            self.transport, self.protocol = await loop.create_datagram_endpoint(
                lambda: TelemetryUDPProtocol(loop),
                local_addr=(settings.UDP_HOST, settings.UDP_PORT)
            )
        except Exception as e:
            logger.warning(f"Could not bind UDP receiver on {settings.UDP_PORT}: {e}")

    async def stop(self):
        if self.transport:
            self.transport.close()
            logger.info("UDP Telemetry Receiver stopped.")

udp_receiver = UDPReceiverService()
