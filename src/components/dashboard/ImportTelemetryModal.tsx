import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  Shield,
  RefreshCw,
  AlertCircle,
  FileCode
} from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface ImportTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTelemetryImported?: (result: any) => void;
}

function validateFile(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) {
    return 'File size exceeds maximum permitted limit (10MB).';
  }
  if (file.size === 0) {
    return 'Selected file is empty.';
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['json', 'csv', 'jsonl'].includes(ext)) {
    return `Unsupported format '.${ext}'. Please select a .json, .csv, or .jsonl file.`;
  }
  return null;
}

const getSampleJson = () => {
  const t1 = new Date(Date.now() - 5000).toISOString();
  const t2 = new Date().toISOString();
  return JSON.stringify([
    {
      device_id: 'UAV-001',
      latitude: 17.3850,
      longitude: 78.4867,
      altitude: 500.0,
      speed: 80.0,
      heading: 90.0,
      timestamp: t1,
      battery_pct: 95.0,
      flight_mode: 'AUTONOMOUS_NAV'
    },
    {
      device_id: 'UAV-002',
      latitude: 17.3860,
      longitude: 78.4870,
      altitude: 550.0,
      speed: 75.0,
      heading: 120.0,
      timestamp: t2,
      battery_pct: 91.0,
      flight_mode: 'WAYPOINT_PATROL'
    }
  ], null, 2);
};

const getSampleCsv = () => {
  const t1 = new Date(Date.now() - 10000).toISOString();
  const t2 = new Date(Date.now() - 5000).toISOString();
  const t3 = new Date().toISOString();
  return [
    'device_id,latitude,longitude,altitude,speed,heading,timestamp,battery_pct,flight_mode',
    `UAV-001,17.3850,78.4867,500.0,80.0,90.0,${t1},95.0,AUTONOMOUS_NAV`,
    `UAV-002,17.3860,78.4870,550.0,75.0,120.0,${t2},91.0,WAYPOINT_PATROL`,
    `UGV-003,17.3872,78.4891,120.0,25.0,45.0,${t3},88.0,GROUND_RECON`
  ].join('\n');
};

export const ImportTelemetryModal: React.FC<ImportTelemetryModalProps> = ({
  isOpen,
  onClose,
  onTelemetryImported
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteFormat, setPasteFormat] = useState<'json' | 'csv'>('json');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setServerError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleLoadSample = (type: 'json' | 'csv') => {
    setActiveTab('paste');
    setPasteFormat(type);
    setPasteContent(type === 'json' ? getSampleJson() : getSampleCsv());
    setValidationError(null);
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    if (activeTab === 'upload') {
      if (!selectedFile) {
        setValidationError('Please select a .json, .csv, or .jsonl file to import.');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await api.importTelemetryFile(selectedFile);
        setImportResult(result);
        if (onTelemetryImported) {
          onTelemetryImported(result);
        }
      } catch (err: any) {
        setServerError(err.message || 'File import failed');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Paste mode
      if (!pasteContent.trim()) {
        setValidationError('Please paste JSON or CSV telemetry content.');
        return;
      }

      if (pasteContent.length > 500 * 1024) {
        setValidationError('Pasted telemetry text exceeds limit (500KB max).');
        return;
      }

      setIsSubmitting(true);
      try {
        let result: any;
        if (pasteFormat === 'json') {
          let payload: any;
          try {
            payload = JSON.parse(pasteContent);
          } catch (jsonErr: any) {
            setValidationError(`Invalid JSON syntax: ${jsonErr.message}`);
            setIsSubmitting(false);
            return;
          }
          result = await api.importTelemetryData(payload);
        } else {
          const blob = new Blob([pasteContent], { type: 'text/csv' });
          const csvFile = new File([blob], 'pasted_telemetry.csv', { type: 'text/csv' });
          result = await api.importTelemetryFile(csvFile);
        }

        setImportResult(result);
        if (onTelemetryImported) {
          onTelemetryImported(result);
        }
      } catch (err: any) {
        setServerError(err.message || 'Data import failed');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPasteContent('');
    setValidationError(null);
    setServerError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const modalTitle = (
    <div className="flex items-center space-x-2.5">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
        <Upload className="w-4 h-4" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900 tracking-wide">
          IMPORT TELEMETRY (JSON / CSV)
        </h2>
        <p className="text-[11px] text-slate-500 font-medium">
          Upload and evaluate telemetry records through the 10-stage security verification pipeline
        </p>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Validation or Server Error */}
        {(validationError || serverError) && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error: </span>
              {validationError || serverError}
            </div>
          </div>
        )}

        {importResult ? (
          /* Import Results View */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">
                    IMPORT COMPLETE: {importResult.filename || 'Batch Payload'}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {importResult.status}
                </span>
              </div>

              {/* Outcome Stat Cards */}
              <div className="grid grid-cols-4 gap-2.5 mt-3 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">TOTAL</span>
                  <span className="text-lg font-bold font-mono text-slate-900 leading-tight">
                    {importResult.total_records}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200 bg-emerald-50/40">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono block">ACCEPTED</span>
                  <span className="text-lg font-bold font-mono text-emerald-700 leading-tight">
                    {importResult.accepted_count}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-rose-200 bg-rose-50/40">
                  <span className="text-[10px] font-bold text-rose-700 uppercase font-mono block">BLOCKED</span>
                  <span className="text-lg font-bold font-mono text-rose-700 leading-tight">
                    {importResult.blocked_count}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">FAILED</span>
                  <span className="text-lg font-bold font-mono text-slate-700 leading-tight">
                    {importResult.failed_count || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Records Breakdown Table (capped at 200) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase font-mono">
                  PROCESSED TELEMETRY RECORDS ({importResult.results?.length || 0})
                </span>
                <span className="text-[11px] text-slate-500">
                  Server-Sealed Simulation Ingestion
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Packet ID</th>
                      <th className="py-2 px-3">Device / Node</th>
                      <th className="py-2 px-3">Classification & Reason</th>
                      <th className="py-2 px-3">Outcome</th>
                      <th className="py-2 px-3 text-right">Trust Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {importResult.results?.slice(0, 200).map((res: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-mono">{res.record_index || idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-sky-800">{res.packet_id || '—'}</td>
                        <td className="py-2 px-3 font-semibold text-slate-700">{res.source || '—'}</td>
                        <td className="py-2 px-3">
                          {res.classification ? (
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                res.classification === 'AUTHENTIC'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {res.classification}
                              </span>
                              {res.reason && (
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs" title={res.reason}>
                                  {res.reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-rose-600 font-medium">{res.error || 'Failed'}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            res.action === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {res.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {res.trust_score !== undefined ? `${res.trust_score}/100` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Close & View Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* Input & Upload Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tab Selector */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab('upload'); setValidationError(null); }}
                className={`pb-1 px-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'upload'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Upload File (.json, .csv, .jsonl)</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('paste'); setValidationError(null); }}
                className={`pb-1 px-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'paste'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Paste JSON / CSV</span>
              </button>
            </div>

            {activeTab === 'upload' ? (
              <div className="space-y-3">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  tabIndex={0}
                  role="button"
                  aria-label="Upload telemetry file"
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-400 ${
                    selectedFile
                      ? 'border-indigo-400 bg-indigo-50/30'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,.csv,.jsonl"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready for pipeline ingestion
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Click to select or drag and drop telemetry file here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supported formats: <span className="font-mono font-bold text-slate-600">.json, .csv, .jsonl</span> (Max 10MB)
                      </p>
                    </div>
                  )}
                </div>

                {/* Sample Data Quick Buttons */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-slate-600 font-medium">Quick Sample Templates:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSample('json')}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Sample JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSample('csv')}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Sample CSV
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-slate-700">Format:</span>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        checked={pasteFormat === 'json'}
                        onChange={() => setPasteFormat('json')}
                        className="accent-indigo-600"
                      />
                      <span>JSON</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        checked={pasteFormat === 'csv'}
                        onChange={() => setPasteFormat('csv')}
                        className="accent-indigo-600"
                      />
                      <span>CSV</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleLoadSample(pasteFormat)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      Insert Sample {pasteFormat.toUpperCase()}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={
                    pasteFormat === 'json'
                      ? 'Paste single JSON object or array of objects here...'
                      : 'Paste CSV with header: device_id,latitude,longitude,altitude,speed,heading,timestamp...'
                  }
                  className="w-full p-3 rounded-lg border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-slate-50/30"
                />
              </div>
            )}

            {/* Security Notice */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start space-x-2 text-[11px] text-slate-600">
              <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Server-Sealed Simulation Notice:</strong> Raw telemetry uploaded without operator cryptographic keys is evaluated and sealed by the server with simulated authentication proof.
              </span>
            </div>

            {/* Form Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Clear Form
              </button>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>IMPORTING & EVALUATING...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>IMPORT & EVALUATE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
