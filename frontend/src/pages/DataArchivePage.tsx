import React, { useState, useEffect } from 'react';
import { ProcessedFile, Packet } from '../types/telemetry';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { TelemetryTable } from '../components/telemetry/TelemetryTable';
import { PacketDetailModal } from '../components/telemetry/PacketDetailModal';
import { Archive, FileCheck, FolderCheck, Download, RefreshCw } from 'lucide-react';

export const DataArchivePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'files' | 'packets'>('files');
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'files') {
        const fileList = await api.getProcessedFiles();
        setFiles(fileList);
      } else {
        const pktList = await api.getPackets({ limit: 100 });
        setPackets(pktList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tactical Data Archive</h1>
          <p className="text-xs text-slate-500 font-medium">
            Persistent repository of verified telemetry, file ingestion records, and security audits
          </p>
        </div>

        {/* Export links */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getLogExportUrl('csv')}
            download
            className="flex items-center space-x-1.5 px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>EXPORT AUDIT CSV</span>
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'files'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderCheck className="w-4 h-4" />
          <span>File Ingestion History (/data/incoming)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{files.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('packets')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'packets'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Historical Telemetry Packets</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{packets.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'files' ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Filename</th>
                  <th className="py-2.5 px-3">Format</th>
                  <th className="py-2.5 px-3">SHA-256 Digest</th>
                  <th className="py-2.5 px-3">Packets Extracted</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Processed At (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No files ingested yet. Add a JSON, JSONL, or CSV file to <code>/data/incoming</code> to see automatic detection and processing.
                    </td>
                  </tr>
                ) : (
                  files.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center space-x-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>{f.filename}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                        {f.file_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                        {f.file_hash.slice(0, 16)}...
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {f.record_count}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.status === 'PROCESSED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {f.processed_at ? new Date(f.processed_at).toLocaleString() : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <TelemetryTable
            packets={packets}
            onSelectPacket={(pkt) => setSelectedPacket(pkt)}
            title="Archived Tactical Packets (Database Record)"
          />
        </div>
      )}

      {/* Packet Detail Modal */}
      <PacketDetailModal
        packet={selectedPacket}
        onClose={() => setSelectedPacket(null)}
      />
    </div>
  );
};
