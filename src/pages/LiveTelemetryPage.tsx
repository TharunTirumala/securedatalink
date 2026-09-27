import React, { useState } from 'react';
import { Packet } from '../types/telemetry';
import { TelemetryTable } from '../components/telemetry/TelemetryTable';
import { PacketDetailModal } from '../components/telemetry/PacketDetailModal';
import { Search, Filter, Radio, Download } from 'lucide-react';

interface LiveTelemetryPageProps {
  packets: Packet[];
}

export const LiveTelemetryPage: React.FC<LiveTelemetryPageProps> = ({ packets }) => {
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterClassification, setFilterClassification] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const sources = Array.from(new Set(packets.map((p) => p.source)));

  const filteredPackets = packets.filter((p) => {
    if (filterSource !== 'ALL' && p.source !== filterSource) return false;
    if (filterClassification !== 'ALL' && p.classification !== filterClassification) return false;
    if (filterAction !== 'ALL' && p.action !== filterAction) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.packet_id.toLowerCase().includes(term) ||
        p.source.toLowerCase().includes(term) ||
        p.classification.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Live Tactical Telemetry</h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time multi-source datalink stream inspection and cryptographic audit
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="font-mono text-slate-500">Buffer:</span>
          <span className="font-mono font-bold text-slate-800">{packets.length} packets loaded</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search packet ID or source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Source Filter */}
        <div>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
          >
            <option value="ALL">All Sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Classification Filter */}
        <div>
          <select
            value={filterClassification}
            onChange={(e) => setFilterClassification(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
          >
            <option value="ALL">All Classifications</option>
            <option value="AUTHENTIC">AUTHENTIC</option>
            <option value="REPLAYED">REPLAYED</option>
            <option value="TAMPERED">TAMPERED</option>
            <option value="INVALID SIGNATURE">INVALID SIGNATURE</option>
            <option value="INTEGRITY FAILURE">INTEGRITY FAILURE</option>
            <option value="FILTERED">FILTERED</option>
          </select>
        </div>

        {/* Action Filter */}
        <div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
          >
            <option value="ALL">All Actions</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="FILTERED">FILTERED</option>
          </select>
        </div>
      </div>

      {/* Main Telemetry Table */}
      <TelemetryTable
        packets={filteredPackets}
        onSelectPacket={(pkt) => setSelectedPacket(pkt)}
        title="Tactical Datalink Packets"
      />

      {/* Inspector Modal */}
      <PacketDetailModal
        packet={selectedPacket}
        onClose={() => setSelectedPacket(null)}
      />
    </div>
  );
};
