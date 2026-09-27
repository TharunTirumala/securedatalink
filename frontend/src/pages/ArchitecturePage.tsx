import React from 'react';
import {
  Network,
  Cpu,
  Shield,
  Layers,
  FileCheck2,
  Lock,
  Key,
  Hash,
  Filter,
  CheckCircle,
  Database,
  Sliders,
  Terminal,
  AlertTriangle,
  Clock
} from 'lucide-react';

export const ArchitecturePage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Architecture & Pipeline Topology</h1>
        <p className="text-xs text-slate-500 font-medium">
          Logical flow of tactical signal ingestion, cryptographic verification, trust scoring, and trusted C2 forwarding
        </p>
      </div>

      {/* TRL Scope Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
        <div className="font-bold text-slate-800 flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] uppercase font-mono">
            TRL 3/4 Scope
          </span>
          <span>Proof-of-Concept & Laboratory Validation Basis</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          SecureLink is developed strictly as a Technology Readiness Level (TRL) 3/4 proof-of-concept system for laboratory-level simulation, attack vector injection, and cryptographic validation. It implements authentic AES-256-GCM authenticated encryption, ECDSA NIST P-256 digital signatures, sliding-window freshness checking, and deterministic adaptive filtering.
        </p>
      </div>

      {/* Main Visual Pipeline Diagram */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Multi-Stage Cryptographic Processing Architecture
        </h2>

        {/* Ingestion Layer */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
            <Network className="w-4 h-4 text-sky-700" />
            <span>Ingestion Subsystems (Mode 1 & Mode 2)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">UDP Receiver (Port 9871)</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Asynchronous IP datagram listener for tactical radios</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Continuous File Watcher</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Monitors /data/incoming for JSON, JSONL, and CSV</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">REST Telemetry Endpoint</span>
              <span className="text-[11px] text-slate-500 mt-1 block">POST /api/v1/telemetry/ingest for network lab test feeds</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Simulated Demo Worker</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Background generator for authentic & attack scenarios</span>
            </div>
          </div>
        </div>

        {/* Central 10-Stage Pipeline Flow */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-sky-700" />
            <span>Multi-Stage Cryptographic Pipeline</span>
          </div>

          <div className="space-y-2">
            {[
              { num: '01', title: 'Signal Ingestion & Queue', desc: 'Raw packet ingestion, sequence extraction, timestamp registration', icon: Layers },
              { num: '02', title: 'Preprocessing & Validation', desc: 'Frame structure validation, hex decoding, schema sanitization', icon: FileCheck2 },
              { num: '03', title: 'Dynamic Nonce & Freshness Check', desc: 'Bounded LRU nonce cache prevents replay; timestamp skew <= 5.0s', icon: Clock },
              { num: '04', title: 'AES-256-GCM Authentication & Decryption', desc: '128-bit GHASH tag authentication prevents ciphertext tampering', icon: Lock },
              { num: '05', title: 'ECDSA NIST P-256 Signature Verification', desc: 'Asymmetric elliptic curve digital signature enforces sender identity', icon: Key },
              { num: '06', title: 'SHA-256 Payload Integrity Digest', desc: 'Cryptographic hash recomputation verifies uncorrupted plaintext', icon: Hash },
              { num: '07', title: 'Deterministic Packet Classification', desc: 'Classifies into AUTHENTIC, REPLAYED, TAMPERED, INVALID SIG, FILTERED', icon: Filter },
              { num: '08', title: 'Trust Assessment Engine', desc: 'Computes multi-factor 0-100 decision score with granular check breakdown', icon: Shield },
              { num: '09', title: 'Adaptive Verification & Filtering', desc: 'Enforces operational policy rules and maintains running telemetry statistics', icon: Sliders },
              { num: '10', title: 'Decision, C2 Output & Threat Logging', desc: 'ACCEPTED packets forward to Trusted C2; blocked packets trigger security alerts', icon: CheckCircle },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="flex items-start space-x-4 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <span className="font-mono font-bold text-sky-800 text-xs mt-0.5">{step.num}</span>
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-slate-700">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">{step.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Downstream Systems */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
            <Database className="w-4 h-4 text-sky-700" />
            <span>Downstream Tactical Services & Persistence</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Trusted C2 Forwarder</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Only verified packets ingress into operator display</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Persistent SQLite Database</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Permanent record of packets, threats, and files</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Real-Time WebSocket Bus</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Zero-polling reactive dashboard synchronization</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="font-bold text-slate-800 block">Security Audit Logging</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Persistent compliance trail with CSV/JSON exports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
