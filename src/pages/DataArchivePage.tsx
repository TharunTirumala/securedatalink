import React, { useState, useEffect, useCallback } from 'react';
import { ProcessedFile, Packet } from '../types/telemetry';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { Badge } from '../components/common/Badge';
import { TelemetryTable } from '../components/telemetry/TelemetryTable';
import { PacketDetailModal } from '../components/telemetry/PacketDetailModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  Archive,
  FileCheck,
  FolderCheck,
  Download,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Inbox,
  Clock,
  Layers
} from 'lucide-react';

export const DataArchivePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vault' | 'active' | 'files'>('vault');
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [archivedPackets, setArchivedPackets] = useState<Packet[]>([]);
  const [activePackets, setActivePackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [archiveStats, setArchiveStats] = useState({
    active_packets: 0,
    archived_packets: 0,
    total_files: 0,
    last_archived_at: null as string | null
  });

  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [isArchiveAllModalOpen, setIsArchiveAllModalOpen] = useState(false);
  const [restorePacketTarget, setRestorePacketTarget] = useState<Packet | null>(null);
  const [archiveSingleTarget, setArchiveSingleTarget] = useState<Packet | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await api.getArchiveStats();
      setArchiveStats(stats);
    } catch (e) {
      console.error('Failed to load archive stats:', e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchStats();
      if (activeTab === 'vault') {
        const pkts = await api.getArchivedPackets({ limit: 100 });
        setArchivedPackets(pkts);
      } else if (activeTab === 'active') {
        const pkts = await api.getPackets({ limit: 100 });
        setActivePackets(pkts);
      } else if (activeTab === 'files') {
        const fileList = await api.getProcessedFiles();
        setFiles(fileList);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Error loading archive data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchStats]);

  useEffect(() => {
    fetchData();

    const unsubArchived = wsClient.on('data_archived', () => {
      fetchData();
    });
    const unsubRestored = wsClient.on('data_restored', () => {
      fetchData();
    });

    return () => {
      unsubArchived();
      unsubRestored();
    };
  }, [fetchData]);

  // Handle Archive All Active Packets
  const handleArchiveAll = async () => {
    setActionInProgress(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await api.archivePackets({ archive_all_active: true, operator_id: 'OPERATOR-PRIMARY' });
      setStatusMsg(res.message || `Successfully archived ${res.archived_count} packet(s) to vault.`);
      setIsArchiveAllModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive active packets.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Archive Single Packet
  const handleArchiveSingle = async () => {
    if (!archiveSingleTarget) return;
    setActionInProgress(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await api.archivePackets({ packet_ids: [archiveSingleTarget.packet_id], operator_id: 'OPERATOR-PRIMARY' });
      setStatusMsg(res.message || `Archived packet ${archiveSingleTarget.packet_id} to vault.`);
      setArchiveSingleTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive packet.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Restore Single Packet from Vault
  const handleRestore = async () => {
    if (!restorePacketTarget) return;
    setActionInProgress(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await api.restorePacket(restorePacketTarget.packet_id, 'OPERATOR-PRIMARY');
      setStatusMsg(res.message || `Packet ${restorePacketTarget.packet_id} restored to active buffer.`);
      setRestorePacketTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore packet.');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tactical Data Archive</h1>
          <p className="text-xs text-slate-500 font-medium">
            Persistent repository separating active telemetry from immutable cold-storage vault
          </p>
        </div>

        {/* Action and Export buttons */}
        <div className="flex items-center space-x-2">
          {activeTab === 'active' && (
            <button
              onClick={() => setIsArchiveAllModalOpen(true)}
              disabled={loading || activePackets.length === 0}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>ARCHIVE ALL ACTIVE ({archiveStats.active_packets})</span>
            </button>
          )}

          <a
            href={api.getLogExportUrl('csv')}
            download
            className="flex items-center space-x-1.5 px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>EXPORT CSV</span>
          </a>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
            title="Refresh Archive"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="text-emerald-600 font-bold ml-2">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">ACTIVE BUFFER</span>
            <Inbox className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{archiveStats.active_packets}</span>
            <span className="text-[10px] text-slate-500 font-medium">packets</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Live operational stream</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">ARCHIVED VAULT</span>
            <Archive className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{archiveStats.archived_packets}</span>
            <span className="text-[10px] text-slate-500 font-medium">packets</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Persistent cold storage</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">FILE INGESTIONS</span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{archiveStats.total_files}</span>
            <span className="text-[10px] text-slate-500 font-medium">files</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">From /data/incoming</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">LAST ARCHIVED</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-1">
            <span className="text-xs font-mono font-bold text-slate-800">
              {archiveStats.last_archived_at
                ? new Date(archiveStats.last_archived_at).toISOString().replace('T', ' ').slice(0, 19)
                : 'Never'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Atomic transaction</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('vault')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'vault'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive className="w-4 h-4 text-amber-600" />
          <span>Archived Telemetry Vault</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
            {archiveStats.archived_packets}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Inbox className="w-4 h-4 text-sky-600" />
          <span>Active Telemetry Buffer</span>
          <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px]">
            {archiveStats.active_packets}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'files'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderCheck className="w-4 h-4 text-emerald-600" />
          <span>File Ingestion History</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{archiveStats.total_files}</span>
        </button>
      </div>

      {/* Tab 1: Archived Vault */}
      {activeTab === 'vault' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Immutable Cold Storage Vault ({archivedPackets.length} Loaded)</span>
            </span>
            <span className="text-[11px] text-slate-400">Archived data is excluded from active stream counters</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Packet ID</th>
                  <th className="py-2.5 px-3">Source Node</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Trust Score</th>
                  <th className="py-2.5 px-3">Batch ID</th>
                  <th className="py-2.5 px-3">Archived At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {archivedPackets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No archived packets in vault yet. Switch to the "Active Telemetry Buffer" tab and click "Archive" on packets to transfer them here.
                    </td>
                  </tr>
                ) : (
                  archivedPackets.map((pkt) => (
                    <tr key={pkt.packet_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-800">
                        <button
                          onClick={() => setSelectedPacket(pkt)}
                          className="hover:underline text-left"
                        >
                          {pkt.packet_id}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{pkt.source}</td>
                      <td className="py-2.5 px-3">
                        <Badge label={pkt.classification} type="classification" />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{pkt.trust_score}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {(pkt as any).archive_batch_id || 'BATCH-SYS'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {(pkt as any).archived_at
                          ? new Date((pkt as any).archived_at).toISOString().replace('T', ' ').slice(0, 19)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setRestorePacketTarget(pkt)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-300 flex items-center space-x-1 ml-auto"
                          title="Restore packet back to active telemetry buffer"
                        >
                          <RotateCcw className="w-3 h-3 text-sky-600" />
                          <span>Restore</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Active Buffer */}
      {activeTab === 'active' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold flex items-center space-x-1.5">
              <Inbox className="w-3.5 h-3.5 text-sky-600" />
              <span>Active Telemetry Buffer ({activePackets.length} Records)</span>
            </span>
            <button
              onClick={() => setIsArchiveAllModalOpen(true)}
              disabled={activePackets.length === 0}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center space-x-1"
            >
              <Archive className="w-3 h-3" />
              <span>Archive Entire Buffer</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Packet ID</th>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Source Node</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Trust Score</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {activePackets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Active buffer is empty. Telemetry packets will appear here as they are ingested from UDP or simulation.
                    </td>
                  </tr>
                ) : (
                  activePackets.map((pkt) => (
                    <tr key={pkt.packet_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-800">
                        <button
                          onClick={() => setSelectedPacket(pkt)}
                          className="hover:underline text-left"
                        >
                          {pkt.packet_id}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {pkt.created_at ? new Date(pkt.created_at).toISOString().replace('T', ' ').slice(0, 19) : ''}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{pkt.source}</td>
                      <td className="py-2.5 px-3">
                        <Badge label={pkt.classification} type="classification" />
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge label={pkt.action} type="action" />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{pkt.trust_score}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setArchiveSingleTarget(pkt)}
                          className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] border border-amber-200 flex items-center space-x-1 ml-auto"
                          title="Archive this packet to cold vault"
                        >
                          <Archive className="w-3 h-3 text-amber-600" />
                          <span>Archive</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: File Ingestion History */}
      {activeTab === 'files' && (
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
      )}

      {/* Packet Detail Modal */}
      <PacketDetailModal
        packet={selectedPacket}
        onClose={() => setSelectedPacket(null)}
      />

      {/* Confirmation Modal: Archive Entire Buffer */}
      <ConfirmModal
        isOpen={isArchiveAllModalOpen}
        title="Archive Active Telemetry Buffer"
        message={`Transfer all ${archiveStats.active_packets} active packets to the persistent cold-storage vault? This will separate them from the active telemetry stream.`}
        confirmLabel={actionInProgress ? "Archiving..." : "Archive All Packets"}
        confirmVariant="warning"
        disabled={actionInProgress}
        onConfirm={handleArchiveAll}
        onCancel={() => setIsArchiveAllModalOpen(false)}
      />

      {/* Confirmation Modal: Archive Single Packet */}
      <ConfirmModal
        isOpen={Boolean(archiveSingleTarget)}
        title="Archive Packet"
        message={`Archive packet ${archiveSingleTarget?.packet_id} to the permanent vault?`}
        confirmLabel={actionInProgress ? "Archiving..." : "Archive Packet"}
        confirmVariant="warning"
        disabled={actionInProgress}
        onConfirm={handleArchiveSingle}
        onCancel={() => setArchiveSingleTarget(null)}
      />

      {/* Confirmation Modal: Restore Packet */}
      <ConfirmModal
        isOpen={Boolean(restorePacketTarget)}
        title="Restore Packet to Active Buffer"
        message={`Restore packet ${restorePacketTarget?.packet_id} back to the active operational telemetry buffer?`}
        confirmLabel={actionInProgress ? "Restoring..." : "Restore Packet"}
        confirmVariant="primary"
        disabled={actionInProgress}
        onConfirm={handleRestore}
        onCancel={() => setRestorePacketTarget(null)}
      />
    </div>
  );
};
