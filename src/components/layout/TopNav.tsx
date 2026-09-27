import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, Lock, Clock, User, Wifi, WifiOff } from 'lucide-react';

interface TopNavProps {
  wsConnected: boolean;
  systemStatus: string;
  activeKeyId: string;
  streamStatus: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  wsConnected,
  systemStatus,
  activeKeyId,
  streamStatus
}) => {
  const [timeUtc, setTimeUtc] = useState('');
  const [timeLocal, setTimeLocal] = useState('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      setTimeLocal(now.toLocaleTimeString());
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 min-h-[4rem] max-h-[4rem] flex-shrink-0 w-full bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs sticky top-0 z-30">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="bg-sky-700 text-white p-2 rounded-md shadow-sm">
          <Shield className="w-5 h-5 text-sky-100" />
        </div>
        <div>
          <div className="flex items-center space-x-2 flex-nowrap">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">SecureLink</h1>
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 tracking-wider flex-shrink-0">
              TRL 3/4 POC
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium whitespace-nowrap">Cyber-Secure Tactical Datalink System</p>
        </div>
      </div>

      {/* Center Tactical Status Badges */}
      <div className="hidden xl:flex items-center space-x-2.5 flex-shrink-0">
        {/* System Online Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs whitespace-nowrap flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-500">System:</span>
          <span className="font-semibold text-slate-800">{systemStatus || 'ONLINE'}</span>
        </div>

        {/* Cryptography Badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-100 text-xs text-sky-800 whitespace-nowrap flex-shrink-0">
          <Lock className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
          <span className="font-medium">AES-256-GCM</span>
          <span className="font-semibold text-sky-900">ACTIVE ({activeKeyId})</span>
        </div>

        {/* Telemetry Stream Status */}
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs whitespace-nowrap flex-shrink-0 ${
          streamStatus === 'PAUSED'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          <Radio className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Telemetry:</span>
          <span className="font-bold">{streamStatus === 'PAUSED' ? 'PAUSED' : 'CONNECTED'}</span>
        </div>

        {/* WebSocket Live Sync */}
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs border whitespace-nowrap flex-shrink-0 ${
          wsConnected 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {wsConnected ? <Wifi className="w-3 h-3 text-emerald-600 flex-shrink-0" /> : <WifiOff className="w-3 h-3 text-rose-600 flex-shrink-0" />}
          <span className="font-mono text-[11px]">{wsConnected ? 'LIVE STREAM' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Right User & Live Time */}
      <div className="flex items-center space-x-4">
        {/* Live System Time */}
        <div className="flex items-center space-x-2 text-right">
          <Clock className="w-4 h-4 text-slate-400" />
          <div className="text-xs font-mono text-slate-700">
            <span className="font-semibold text-slate-900">{timeUtc}</span>
            <span className="hidden sm:inline text-slate-400 ml-2">({timeLocal})</span>
          </div>
        </div>

        {/* Operator Badge */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 text-xs">
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden sm:block">
            <div className="font-semibold text-slate-800 leading-tight">OPERATOR-PRIMARY</div>
            <div className="text-[10px] text-slate-400 leading-tight">Secured Session</div>
          </div>
        </div>
      </div>
    </header>
  );
};
