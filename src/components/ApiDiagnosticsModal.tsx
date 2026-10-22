import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Server, 
  Cpu, 
  Key, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Terminal,
  ExternalLink
} from 'lucide-react';

interface DiagnosticResult {
  id: string;
  name: string;
  category: string;
  status: 'online' | 'degraded' | 'standby' | 'unconfigured' | 'error';
  statusCode?: number;
  latencyMs: number;
  message: string;
  details?: Record<string, any>;
}

interface DiagnosticResponse {
  timestamp: string;
  totalDurationMs: number;
  overallStatus: 'operational' | 'limited';
  results: DiagnosticResult[];
}

interface ApiDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDiagnosticsModal: React.FC<ApiDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastTestedAt, setLastTestedAt] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching:', `${window.location.origin}/api/diagnostics/test-all`);
      const res = await fetch(`${window.location.origin}/api/diagnostics/test-all`);
      if (res.ok) {
        const json: DiagnosticResponse = await res.json();
        setData(json);
        setLastTestedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = data?.results || [];
  const categories = ['all', ...Array.from(new Set(results.map(r => r.category)))];
  const filteredResults = selectedCategory === 'all' 
    ? results 
    : results.filter(r => r.category === selectedCategory);

  const onlineCount = results.filter(r => r.status === 'online').length;
  const standbyCount = results.filter(r => r.status === 'standby').length;
  const errorCount = results.filter(r => r.status === 'error' || r.status === 'degraded').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-4xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">API Diagnostics & Live Health Monitor</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Real Probes
                </span>
              </div>
              <p className="text-xs text-slate-400">
                End-to-end connectivity, token validity, latency benchmarks, and active failover slots.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Re-run real HTTP test requests against all APIs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#EB6658]' : ''}`} />
              <span>{isLoading ? 'Probing...' : 'Re-test APIs'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-slate-950/40 border-b border-slate-800/80">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Online</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {onlineCount} <span className="text-xs font-normal text-slate-400">providers</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Standby / Local</span>
            </div>
            <div className="text-xl font-bold text-blue-400 mt-1">
              {standbyCount} <span className="text-xs font-normal text-slate-400">ready</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Probing Time</span>
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {data?.totalDurationMs ? `${data.totalDurationMs}ms` : '--'}
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Secret Storage</span>
            </div>
            <div className="text-xs font-semibold text-purple-300 mt-2 flex items-center gap-1">
              <span>Private .env Only</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-400 font-medium mr-1">Filter:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-[#EB6658] text-white shadow-sm'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Providers' : cat}
            </button>
          ))}
        </div>

        {/* Probes Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {isLoading && !data && (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#EB6658]" />
              <p className="text-sm">Dispatching live verification requests to configured APIs...</p>
            </div>
          )}

          {filteredResults.map((item) => {
            const isOnline = item.status === 'online';
            const isStandby = item.status === 'standby';
            const isError = item.status === 'error' || item.status === 'degraded';

            return (
              <div 
                key={item.id}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      isStandby ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      isError ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isOnline && <CheckCircle2 className="w-4 h-4" />}
                      {isStandby && <Clock className="w-4 h-4" />}
                      {isError && <AlertTriangle className="w-4 h-4" />}
                      {item.status === 'unconfigured' && <Key className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {item.latencyMs > 0 && (
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                        <Zap className="w-3 h-3 text-amber-400" />
                        {item.latencyMs}ms
                      </span>
                    )}

                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isOnline ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      isStandby ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                      isError ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Additional Details Chips if present */}
                {item.details && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap gap-2 text-[11px]">
                    {item.details.activeKeySlots && (
                      <div className="flex items-center gap-1.5 bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                        <Layers className="w-3 h-3 text-emerald-400" />
                        <span>Failover Pool: <strong>{item.details.activeKeySlots.length} Key Slots</strong> active</span>
                      </div>
                    )}
                    {item.details.verifiedInferenceModel && (
                      <div className="flex items-center gap-1.5 bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Inference Model: <strong>{item.details.verifiedInferenceModel}</strong></span>
                      </div>
                    )}
                    {item.details.models && Array.isArray(item.details.models) && item.details.models.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                        <Cpu className="w-3 h-3 text-blue-400" />
                        <span>Available Models: {item.details.models.join(', ')}</span>
                      </div>
                    )}
                    {item.details.vmTier && (
                      <div className="flex items-center gap-1.5 bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                        <Server className="w-3 h-3 text-blue-400" />
                        <span>VM Runner: <strong>{item.details.vmTier}</strong> ({item.details.projectId})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Last tested: {lastTestedAt ? lastTestedAt.toLocaleTimeString() : 'Just now'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
