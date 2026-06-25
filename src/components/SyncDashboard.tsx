import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Terminal, 
  Music, 
  Image as ImageIcon,
  Clock,
  Settings
} from 'lucide-react';

interface CoverStats {
  embedded: number;
  folder: number;
  fallback: number;
}

interface SyncStats {
  totalDiscovered: number;
  newAdded: number;
  updated: number;
  failed: number;
  covers: CoverStats;
}

interface SyncStatusResponse {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: string | null;
  error: string | null;
  stats: SyncStats;
  logs: string[];
}

export const SyncDashboard = () => {
  const [syncState, setSyncState] = useState<SyncStatusResponse>({
    status: 'idle',
    lastSyncTime: null,
    error: null,
    stats: {
      totalDiscovered: 0,
      newAdded: 0,
      updated: 0,
      failed: 0,
      covers: { embedded: 0, folder: 0, fallback: 0 }
    },
    logs: []
  });
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Poll status endpoint
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        const data = await res.json();
        setSyncState(data);
      }
    } catch (err) {
      console.error('[SyncDashboard] Error fetching sync status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll more frequently if actively syncing
    const intervalTime = syncState.status === 'syncing' ? 2000 : 8000;
    const interval = setInterval(fetchStatus, intervalTime);
    return () => clearInterval(interval);
  }, [syncState.status]);

  const handleTriggerSync = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Sync triggered successfully.');
        fetchStatus();
      } else if (res.status === 409) {
        setActionMessage('Sync already in progress.');
      } else {
        const data = await res.json();
        setActionMessage(`Error: ${data.error || 'Failed to start sync'}`);
      }
    } catch (err: any) {
      setActionMessage(`Network Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (syncState.status) {
      case 'syncing':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Syncing Library...
          </span>
        );
      case 'success':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Success
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Idle
          </span>
        );
    }
  };

  const formatLastSync = (timeStr: string | null) => {
    if (!timeStr) return 'Never';
    try {
      const date = new Date(timeStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="bg-[#121212] border border-[#232323] rounded-xl p-6 space-y-6 max-w-5xl mx-auto text-text-main shadow-lg select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#232323] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-text-main">Library Diagnostics & Sync</h2>
          </div>
          <p className="text-xs text-text-muted">
            Track background indexing, file parsing, and artwork statistics in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={handleTriggerSync}
            disabled={loading || syncState.status === 'syncing'}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-black text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
            Trigger Scan
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3 text-xs flex items-center gap-2 text-text-muted">
          <AlertCircle className="w-4 h-4 text-primary" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Grid Status Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Discovered */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-medium">Discovered Files</span>
            <Music className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black">{syncState.stats.totalDiscovered}</div>
            <div className="text-[10px] text-text-muted">Total files on storage</div>
          </div>
        </div>

        {/* Tracks Added */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-medium">New Added</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-emerald-400">+{syncState.stats.newAdded}</div>
            <div className="text-[10px] text-text-muted">Imported this session</div>
          </div>
        </div>

        {/* Tracks Updated */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-medium">Synced/Updated</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-blue-400">{syncState.stats.updated}</div>
            <div className="text-[10px] text-text-muted">Metadata refreshes</div>
          </div>
        </div>

        {/* Skipped / Failed */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-medium">Skipped/Failed</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-rose-400">{syncState.stats.failed}</div>
            <div className="text-[10px] text-text-muted">Unsupported or corrupted</div>
          </div>
        </div>
      </div>

      {/* Cover Art Statistics */}
      <div className="bg-[#181818] border border-[#262626] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold">Cover Art Statistics</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#202020] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] text-text-muted">Embedded Metadata</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-cyan-400">{syncState.stats.covers.embedded}</span>
              <span className="text-[9px] text-text-muted">tracks</span>
            </div>
          </div>

          <div className="bg-[#202020] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] text-text-muted">Folder-Level Files</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-purple-400">{syncState.stats.covers.folder}</span>
              <span className="text-[9px] text-text-muted">tracks</span>
            </div>
          </div>

          <div className="bg-[#202020] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] text-text-muted">Deterministic Fallbacks</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-zinc-400">{syncState.stats.covers.fallback}</span>
              <span className="text-[9px] text-text-muted">tracks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Sync Terminal */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-text-muted">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Sync Output Terminal</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span>Last Sync: {formatLastSync(syncState.lastSyncTime)}</span>
          </div>
        </div>
        
        <div className="bg-[#0b0c10] border border-[#222] rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-60 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 shadow-inner">
          {syncState.logs && syncState.logs.length > 0 ? (
            syncState.logs.map((line, idx) => {
              let textClass = 'text-zinc-300';
              if (line.includes('[!]') || line.toLowerCase().includes('error')) {
                textClass = 'text-rose-400 font-semibold';
              } else if (line.includes('[*]') || line.toLowerCase().includes('warning')) {
                textClass = 'text-amber-400';
              } else if (line.includes('[+]') || line.toLowerCase().includes('success')) {
                textClass = 'text-emerald-400 font-semibold';
              }
              return (
                <div key={idx} className={`${textClass} leading-5 break-all whitespace-pre-wrap`}>
                  {line}
                </div>
              );
            })
          ) : (
            <div className="text-zinc-600 text-center py-6 italic select-none">
              No sync log outputs available. Trigger a scan to display terminal feeds.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
