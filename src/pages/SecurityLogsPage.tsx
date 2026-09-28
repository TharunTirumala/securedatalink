import React, { useState, useEffect } from 'react';
import { SecurityLog } from '../types/telemetry';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { Badge } from '../components/common/Badge';
import { Search, Download, RefreshCw, ShieldCheck, Info, X, AlertTriangle } from 'lucide-react';
import { formatUtc, formatIso } from '../utils/formatters';

export const SecurityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getSecurityLogs({
        limit: 100,
        search: search || undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
      });
      setLogs(data);
    } catch (e: any) {
      console.error('Failed to fetch security logs:', e);
      setErrorMsg(e.message || 'Failed to fetch audit history from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Live real-time append on new security events
    const unsubLog = wsClient.on('security_log_added', (newLog: SecurityLog) => {
      setLogs((prev) => {
        // Avoid duplicate ID if already present
        if (prev.some(l => l.id === newLog.id)) return prev;
        
        // Check filter
        if (severityFilter !== 'ALL' && newLog.severity !== severityFilter) {
          return prev;
        }
        return [newLog, ...prev.slice(0, 199)];
      });
    });

    return () => {
      unsubLog();
    };
  }, [severityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Security & Audit Logs</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" />
              IMMUTABLE AUDIT TRAIL
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cryptographically grounded persistent tactical event log with zero secrets exposure
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={api.getLogExportUrl('csv')}
            download="securelink_audit_log.csv"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>EXPORT CSV</span>
          </a>
          <a
            href={api.getLogExportUrl('json')}
            download="securelink_audit_log.json"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-md bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-200" />
            <span>EXPORT JSON</span>
          </a>
        </div>
      </div>

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between space-x-2 shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Compliance / Immutability Banner */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-sky-700 flex-shrink-0" />
          <span>
            <strong className="text-slate-800">Tamper-Evident Policy:</strong> All operational events (authentication attempts, overrides, archives, restorations, and pause/resumes) are permanently committed to SQLite. Logs are append-only; frontend deletion is strictly prohibited.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
          {logs.length} Records Loaded
        </span>
      </div>

      {/* Search and Filter toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit descriptions, packet IDs, sources, event types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white rounded-md font-semibold hover:bg-slate-700"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Source Node</th>
                <th className="py-2.5 px-3">Packet ID</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Loading immutable audit trail from server...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No matching security log entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatUtc(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={log.severity} type="severity" />
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                      {log.event_type}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {log.source || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sky-700">
                      {log.packet_id || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      {log.description}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {log.details ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Inspect
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <Badge label={selectedLog.severity} type="severity" />
                <h3 className="text-sm font-bold text-slate-900 font-mono">{selectedLog.event_type}</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Log ID</span>
                  <span className="font-mono text-slate-800">#{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Timestamp (UTC)</span>
                  <span className="font-mono text-slate-800">
                    {formatIso(selectedLog.timestamp)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Source / Operator</span>
                  <span className="font-semibold text-slate-800">{selectedLog.source || 'SYSTEM'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Associated Packet ID</span>
                  <span className="font-mono text-sky-700">{selectedLog.packet_id || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 leading-relaxed">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Sanitized Event Metadata (Zero Secrets Disclosed)
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-md font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
