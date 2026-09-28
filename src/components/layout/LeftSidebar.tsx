import React from 'react';
import {
  LayoutDashboard,
  Radio,
  FileCheck2,
  ShieldAlert,
  ScrollText,
  KeyRound,
  Archive
} from 'lucide-react';

interface LeftSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  threatCount?: number;
  connectionState?: 'connecting' | 'online' | 'offline';
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  setActiveTab,
  threatCount = 0,
  connectionState = 'online',
}) => {
  const navSections = [
    {
      title: 'SECURITY CENTER',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'telemetry', label: 'Live Telemetry', icon: Radio },
        { id: 'verification', label: 'Packet Verification', icon: FileCheck2 },
        { id: 'threats', label: 'Threat Detection', icon: ShieldAlert, badge: threatCount > 0 ? threatCount : undefined },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'logs', label: 'Audit History', icon: ScrollText },
        { id: 'keys', label: 'Key Management', icon: KeyRound },
        { id: 'archive', label: 'Tactical Data Archive', icon: Archive },
      ]
    }
  ];

  const engineStatusText = connectionState === 'online'
    ? 'AES/ECDSA-OK'
    : connectionState === 'connecting'
    ? 'SYNCING...'
    : 'OFFLINE';

  const engineStatusColor = connectionState === 'online'
    ? 'text-emerald-400'
    : connectionState === 'connecting'
    ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <aside className="w-64 min-w-[16rem] max-w-[16rem] h-full bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* Sidebar Navigation */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              {section.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sky-700 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-sky-200' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Status Information */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-slate-500">ENGINE:</span>
          <span className={`font-semibold ${engineStatusColor}`}>{engineStatusText}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] mt-1">
          <span className="text-slate-500">UDP PORT:</span>
          <span className="text-slate-300">9871</span>
        </div>
        <div className="mt-3 text-[10px] text-slate-500 text-center">
          SecureLink Tactical v1.0.0
        </div>
      </div>
    </aside>
  );
};
