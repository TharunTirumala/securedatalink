import React, { useState } from 'react';
import { ThreatEvent } from '../types/telemetry';
import { ThreatFeed } from '../components/security/ThreatFeed';
import { StatCard } from '../components/common/StatCard';
import { ShieldAlert, AlertTriangle, ShieldX, RefreshCw } from 'lucide-react';

interface ThreatDetectionPageProps {
  threats: ThreatEvent[];
}

export const ThreatDetectionPage: React.FC<ThreatDetectionPageProps> = ({ threats }) => {
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const filteredThreats = threats.filter((t) => {
    if (filterSeverity !== 'ALL' && t.severity !== filterSeverity) return false;
    return true;
  });

  const criticalCount = threats.filter((t) => t.severity === 'CRITICAL').length;
  const highCount = threats.filter((t) => t.severity === 'HIGH' || t.severity === 'WARNING').length;
  const blockedCount = threats.filter((t) => t.action === 'BLOCKED').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Threat Detection & Incident Response</h1>
        <p className="text-xs text-slate-500 font-medium">
          Automated classification and containment of spoofed, replayed, and tampered tactical packets
        </p>
      </div>

      {/* Threat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Threats Intercepted"
          value={threats.length}
          subtext="Persistent Log Interceptions"
          icon={ShieldAlert}
          variant={threats.length > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Critical Attacks (Tamper/Replay)"
          value={criticalCount}
          subtext="Cryptographic Integrity Violations"
          icon={ShieldX}
          variant={criticalCount > 0 ? 'danger' : 'default'}
        />
        <StatCard
          title="Packets Automatically Blocked"
          value={blockedCount}
          subtext="Prevented from C2 Ingress"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center space-x-3 text-xs">
        <span className="font-semibold text-slate-600">Filter Severity:</span>
        {['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'MEDIUM'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              filterSeverity === sev
                ? 'bg-sky-700 text-white border-sky-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Threat Incident List */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <ThreatFeed threats={filteredThreats} limit={100} />
      </div>
    </div>
  );
};
