import React, { useState, useEffect } from 'react';
import { SecurityLog } from '../types/telemetry';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { ScrollText, Search, Download, RefreshCw, Filter } from 'lucide-react';

export const SecurityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getSecurityLogs({
        limit: 100,
        search: search || undefined,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
      });
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch security logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Security & Audit Logs</h1>
          <p className="text-xs text-slate-500 font-medium">
            Persistent, cryptographically grounded tactical audit trail with export capability
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

      {/* Search and Filter toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit descriptions, packet IDs, sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500"
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
            className="px-3 py-2 border border-slate-300 rounded-md bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Packet ID</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No matching security log entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19) : ''}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
