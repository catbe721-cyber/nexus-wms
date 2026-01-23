import React from 'react';
import { Settings, Database, RefreshCw, Trash2, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

interface SettingsPageProps {
  gasConfig: { url: string; enabled: boolean };
  onSyncGas: () => void;
  isSyncing: boolean;
  onInitializeApp: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ gasConfig, onSyncGas, isSyncing, onInitializeApp }) => {

  const [isResetting, setIsResetting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleInitialize = () => {
    setIsResetting(true);
    setProgress(0);

    const duration = 5000; // 5 seconds
    const intervalTime = 100;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / steps) * 100, 100);
      setProgress(newProgress);

      if (currentStep >= steps) {
        clearInterval(timer);
        // Wait a tiny bit for UI to show 100%
        setTimeout(() => {
          onInitializeApp();
          setIsResetting(false);
          setProgress(0);
        }, 200);
      }
    }, intervalTime);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white font-display uppercase tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          System Settings
        </h2>
        <p className="text-slate-400 mt-2">Manage system connections, synchronization, and administrative tasks.</p>
      </div>

      {/* Cloud Connection Status */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cloud Connection</h3>
              <p className="text-sm text-slate-400">Google Sheets Integration Status</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Connected
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Connected Database URL</label>
              <div className="flex items-center gap-2 p-3 bg-black/40 rounded-lg border border-white/10 text-slate-300 text-sm font-mono break-all">
                <span className="opacity-50 select-none">https://</span>
                {gasConfig.url.replace('https://', '')}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manual Actions</label>
              <button
                onClick={onSyncGas}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Reload from Cloud'}
              </button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                System auto-saves changes. Use this to refresh data from Google Sheets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 backdrop-blur-md rounded-xl border border-red-500/20 overflow-hidden relative group">
        <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

        <div className="p-6 border-b border-red-500/10 flex justify-between items-center bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/30">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-100">Danger Zone</h3>
              <p className="text-sm text-red-300/60">Irreversible administrative actions</p>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h4 className="text-red-200 font-bold mb-1">Initialize Application</h4>
            <p className="text-sm text-slate-400">
              Permanently delete all local Transaction History, Inventory Data, and Products.
              This will overwrite the Cloud Database with an empty state.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {!isResetting ? (
              <button
                onClick={handleInitialize}
                className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-400"
              >
                <Trash2 className="w-5 h-5" />
                Initialize App
              </button>
            ) : (
              <div className="w-48">
                <div className="flex justify-between text-xs text-red-300 mb-1 font-bold uppercase tracking-wider">
                  <span>Resetting...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-4 bg-red-900/40 rounded-full overflow-hidden border border-red-500/30">
                  <div
                    className="h-full bg-red-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-600 mt-10">
        NexusWMS v2.0 • System ID: {gasConfig.url ? 'GAS-CONNECTED' : 'LOCAL-ONLY'}
      </div>

    </div>
  );
};

export default SettingsPage;