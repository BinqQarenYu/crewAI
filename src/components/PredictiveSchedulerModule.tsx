import React, { useState, useEffect, useCallback } from 'react';
import { ExecutionLog } from '../types';
import {
  Clock,
  Zap,
  Database,
  GitMerge,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  FolderGit2,
  FileCode,
  Timer,
  Flame,
  ArrowRight
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

export interface HistoricalMergePattern {
  id: string;
  patternName: string;
  triggerSignal: string;
  coChangedPaths: string[];
  historicalMergeCount: number;
  avgFollowUpMinutes: number;
  confidencePct: number;
  predictedWindow: string;
  associatedTargetId: string;
}

export interface CodebaseIndexTarget {
  id: string;
  subsystem: string;
  repo: string;
  paths: string[];
  astNodesCount: number;
  vectorChunksCount: number;
  cacheSizeMb: number;
  status: 'warm_cached' | 'suggested_prefetch' | 'stale';
  hitProbabilityPct: number;
  coldWaitSec: number;
  warmWaitSec: number;
  lastIndexedAt: string;
  ttlMinutes: number;
  triggerPattern: string;
}

export interface MergeVelocityBucket {
  windowLabel: string;
  mergedPrs: number;
  predictedSessions: number;
  preWarmLeadMin: number;
  isPeakWindow: boolean;
  isCurrentWindow?: boolean;
}

interface PredictiveSchedulerPayload {
  autoPreFetchEnabled: boolean;
  predictionConfidencePct: number;
  avgColdStartMs: number;
  avgWarmIndexMs: number;
  waitTimeReductionPct: number;
  totalMinutesSavedSession: number;
  totalPreFetchesRun: number;
  lastPatternScanAt: string;
  warmSnapshotsReady: number;
  totalSnapshots: number;
  velocityTimeline: MergeVelocityBucket[];
  historicalPatterns: HistoricalMergePattern[];
  indexTargets: CodebaseIndexTarget[];
  timestamp?: string;
}

interface PredictiveSchedulerModuleProps {
  crewName: string;
  selectedRepo: string;
  latestPrTrigger?: number | null;
  onEmitAuditLog?: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

export const PredictiveSchedulerModule: React.FC<PredictiveSchedulerModuleProps> = ({
  crewName,
  selectedRepo,
  latestPrTrigger,
  onEmitAuditLog,
  onNotify
}) => {
  const [data, setData] = useState<PredictiveSchedulerPayload | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prefetchingId, setPrefetchingId] = useState<string | null>(null);
  const [selectedWindowIdx, setSelectedWindowIdx] = useState<number>(7);

  const fetchSchedulerState = useCallback(async () => {
    try {
      const res = await fetch('/api/jules/predictive-scheduler');
      if (!res.ok) return;
      const json: PredictiveSchedulerPayload = await res.json();
      setData(json);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchSchedulerState();
  }, [fetchSchedulerState]);

  // Automatically re-analyze merge patterns when a new PR is intercepted or merged during Kickoff
  useEffect(() => {
    if (latestPrTrigger && latestPrTrigger > 0) {
      (async () => {
        try {
          const res = await fetch('/api/jules/predictive-scheduler/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repo: selectedRepo || 'crewAIInc/crewAI',
              crewName,
              recentPrNumber: latestPrTrigger
            })
          });
          if (res.ok) {
            const json = await res.json();
            setData(json);
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [latestPrTrigger, crewName, selectedRepo]);

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setIsExpanded(!detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  const handleAnalyzePatterns = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/jules/predictive-scheduler/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: selectedRepo || 'crewAIInc/crewAI',
          crewName
        })
      });
      if (res.ok) {
        const json: PredictiveSchedulerPayload = await res.json();
        setData(json);

        onEmitAuditLog?.({
          stage: 'orchestrator',
          severity: 'info',
          traceId: `tr-pred-${Date.now().toString().slice(-4)}`,
          spanId: 'sp-merge-scan',
          agentName: 'Predictive Index Scheduler',
          type: 'system',
          title: `Analyzed Historical PR Merge Patterns (${selectedRepo || 'crewAIInc/crewAI'})`,
          content: `Scanned 24h merge cadence & co-change AST clusters for "${crewName}". Prediction confidence: ${json.predictionConfidencePct}%. Warm snapshots ready: ${json.warmSnapshotsReady}/${json.totalSnapshots}.`,
          meta: {
            durationMs: 185,
            model: 'Predictive Co-Change Analyzer',
            branch: 'main'
          }
        });

        onNotify?.(
          'success',
          `Merge patterns analyzed (${json.predictionConfidencePct}% confidence) — ${json.warmSnapshotsReady}/${json.totalSnapshots} indexes warm.`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrefetchTarget = async (targetId?: string, prefetchAll = false) => {
    setPrefetchingId(prefetchAll ? 'ALL' : targetId || null);
    try {
      const res = await fetch('/api/jules/predictive-scheduler/prefetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, prefetchAll })
      });
      if (res.ok) {
        const json: PredictiveSchedulerPayload & { newlyWarmed?: number } = await res.json();
        setData(json);

        const targetObj = json.indexTargets.find((t) => t.id === targetId);
        const label = prefetchAll
          ? `All ${json.totalSnapshots} Codebase Subsystems`
          : targetObj?.subsystem || targetId;

        onEmitAuditLog?.({
          stage: 'jules',
          severity: 'success',
          traceId: `tr-prefetch-${Date.now().toString().slice(-4)}`,
          spanId: 'sp-ast-warm',
          agentName: 'Google Jules Pre-Warm Indexer',
          type: 'jules_vm',
          title: `Pre-Fetched Codebase AST & Vector Index: ${label}`,
          content: `Pre-warmed AST symbols, vector embeddings, and PyTest fixture graph into Jules Cloud VM RAM cache. Session indexing wait time reduced from ${(
            json.avgColdStartMs / 1000
          ).toFixed(1)}s cold -> ${(json.avgWarmIndexMs / 1000).toFixed(2)}s warm (-${
            json.waitTimeReductionPct
          }%).`,
          meta: {
            durationMs: 310,
            model: 'Jules AST Pre-Fetcher',
            exitCode: 0
          }
        });

        onNotify?.(
          'success',
          `Pre-fetched ${label} — Jules wait time reduced to ${(json.avgWarmIndexMs / 1000).toFixed(
            2
          )}s (-${json.waitTimeReductionPct}%).`
        );
      }
    } finally {
      setPrefetchingId(null);
    }
  };

  const handleToggleAutoPreFetch = async () => {
    if (!data) return;
    try {
      const res = await fetch('/api/jules/predictive-scheduler/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data.autoPreFetchEnabled })
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        onNotify?.(
          'success',
          `Predictive Auto Pre-Fetch ${json.autoPreFetchEnabled ? 'enabled (T-15m lead window)' : 'paused'}.`
        );
      }
    } catch {
      // ignore
    }
  };

  if (!data) return null;

  const suggestedCount = data.indexTargets.filter((t) => t.status !== 'warm_cached').length;
  const activeBucket = data.velocityTimeline[selectedWindowIdx] || data.velocityTimeline[7];

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/95 via-indigo-950/20 to-slate-900/95 border border-indigo-500/30 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Predictive Scheduler & Codebase Pre-Fetch Indexer
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Flame className="w-3 h-3 text-amber-400" />
                -{data.waitTimeReductionPct}% JULES WAIT TIME
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {(data.avgColdStartMs / 1000).toFixed(1)}s Cold → {(data.avgWarmIndexMs / 1000).toFixed(2)}s Warm
              </span>
            </div>
            {isExpanded && (
              <p className="text-xs text-slate-400 mt-0.5">
                Analyzes historical PR merge cadence & file co-change graphs to pre-warm AST symbols, vector chunks, and PyTest fixtures ahead of autonomous Jules VM sessions.
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleAutoPreFetch}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all flex items-center gap-1.5 ${
              data.autoPreFetchEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Automatically pre-fetch codebase AST & embeddings 15 minutes before predicted PR merge windows"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                data.autoPreFetchEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{data.autoPreFetchEnabled ? 'Auto Pre-Fetch: ON (T-15m)' : 'Auto Pre-Fetch: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleAnalyzePatterns}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Scanning PR History...' : 'Analyze PR Merge Patterns'}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrefetchTarget(undefined, true)}
            disabled={prefetchingId === 'ALL'}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {prefetchingId === 'ALL'
                ? 'Pre-Warming Indexes...'
                : suggestedCount > 0
                ? `Pre-Fetch Suggested (${suggestedCount})`
                : 'Refresh Warm Snapshots'}
            </span>
          </button>

          <CardMinMaxButtons
            isMinimized={!isExpanded}
            onMinimize={() => setIsExpanded(false)}
            onExpand={() => setIsExpanded(true)}
            title="Predictive Scheduler"
            className="ml-auto"
          />
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 4 Top KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Jules Index Boot Latency
                </div>
                <div className="text-lg font-extrabold text-emerald-400 font-mono flex items-baseline gap-1.5 mt-0.5">
                  <span>{(data.avgWarmIndexMs / 1000).toFixed(2)}s</span>
                  <span className="text-xs text-slate-500 line-through">
                    {(data.avgColdStartMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {data.waitTimeReductionPct}% cold-start wait eliminated
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Warm AST & Vector Snapshots
                </div>
                <div className="text-lg font-extrabold text-indigo-300 font-mono mt-0.5">
                  {data.warmSnapshotsReady} / {data.totalSnapshots} Ready
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Pre-mounted in Jules Cloud VM RAM
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  PR Merge Pattern Accuracy
                </div>
                <div className="text-lg font-extrabold text-sky-400 font-mono mt-0.5">
                  {data.predictionConfidencePct}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Co-change & temporal cadence model
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <GitMerge className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Cumulative Wait Time Saved
                </div>
                <div className="text-lg font-extrabold text-amber-400 font-mono mt-0.5">
                  {data.totalMinutesSavedSession} mins
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Across {data.totalPreFetchesRun} pre-warmed Jules runs
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
          {/* Left Column (5 cols): 24h Merge Velocity Timeline & Co-Change Patterns */}
          <div className="lg:col-span-5 space-y-3">
            {/* 24-Hour Historical PR Merge Velocity & Pre-Warm Schedule */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>24h PR Merge Cadence & Pre-Warm Schedule</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Last scan: {data.lastPatternScanAt}
                </span>
              </div>

              {/* Bar Chart */}
              <div className="grid grid-cols-8 gap-1.5 items-end h-24 pt-2 px-1">
                {data.velocityTimeline.map((bucket, idx) => {
                  const heightPct = Math.min(100, Math.max(20, Math.round((bucket.mergedPrs / 24) * 100)));
                  const isSelected = idx === selectedWindowIdx;
                  return (
                    <button
                      key={bucket.windowLabel}
                      type="button"
                      onClick={() => setSelectedWindowIdx(idx)}
                      className="flex flex-col items-center gap-1 group focus:outline-none"
                      title={`${bucket.windowLabel}: ${bucket.mergedPrs} merged PRs • Pre-warm T-${bucket.preWarmLeadMin}m`}
                    >
                      <span className="text-[9px] font-mono text-slate-400 group-hover:text-white">
                        {bucket.mergedPrs}
                      </span>
                      <div className="w-full h-14 bg-slate-900 rounded-md flex items-end p-0.5 border border-slate-800/80">
                        <div
                          className={`w-full rounded transition-all ${
                            bucket.isCurrentWindow
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                              : isSelected
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                              : bucket.isPeakWindow
                              ? 'bg-indigo-500/60 group-hover:bg-indigo-400'
                              : 'bg-slate-700 group-hover:bg-slate-600'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-[9px] font-mono truncate max-w-full ${
                          bucket.isCurrentWindow
                            ? 'text-emerald-400 font-bold'
                            : isSelected
                            ? 'text-indigo-300 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {bucket.windowLabel.slice(0, 5)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Window Detail Strip */}
              {activeBucket && (
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px]">
                      {activeBucket.windowLabel} UTC
                    </span>
                    <span className="text-slate-300">
                      <strong>{activeBucket.mergedPrs}</strong> historical merges →{' '}
                      <strong className="text-emerald-400">{activeBucket.predictedSessions}</strong> Jules runs
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Pre-Warm Trigger: T-{activeBucket.preWarmLeadMin}m
                  </span>
                </div>
              )}
            </div>

            {/* Historical PR Co-Change & Merge Patterns */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-sky-400" />
                  <span>Detected PR Merge Co-Change Patterns</span>
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  {data.historicalPatterns.length} Active Rules
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {data.historicalPatterns.map((pat) => (
                  <div
                    key={pat.id}
                    className="p-2.5 rounded-lg bg-slate-900/75 border border-slate-800/90 hover:border-indigo-500/40 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-slate-200 leading-snug">
                        {pat.patternName}
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                        {pat.confidencePct}% conf
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{pat.triggerSignal}</div>
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {pat.coChangedPaths.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 font-mono text-[10px] border border-slate-800"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-400 border-t border-slate-800/60">
                      <span>
                        {pat.historicalMergeCount} merges • Follow-up avg {pat.avgFollowUpMinutes}m
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePrefetchTarget(pat.associatedTargetId, false)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        <span>{pat.predictedWindow}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Codebase Pre-Fetch Indexing Targets Queue */}
          <div className="lg:col-span-7 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pre-Fetched Codebase Indexing Snapshots (AST + Vector + PyTest Conftest)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pre-warming these subtrees eliminates git clone + symbol parsing + embedding latency when Jules spins up an autonomous coding VM.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                  Repo: {selectedRepo || 'crewAIInc/crewAI'}
                </span>
              </div>

              <div className="space-y-2.5">
                {data.indexTargets.map((target) => {
                  const isWarm = target.status === 'warm_cached';
                  const isThisPrefetching = prefetchingId === target.id || prefetchingId === 'ALL';
                  const speedupPct = Math.round(
                    ((target.coldWaitSec - target.warmWaitSec) / target.coldWaitSec) * 100
                  );

                  return (
                    <div
                      key={target.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isWarm
                          ? 'bg-slate-900/75 border-emerald-500/30'
                          : 'bg-indigo-950/20 border-amber-500/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <FolderGit2
                              className={`w-4 h-4 ${
                                isWarm ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            />
                            <span className="text-xs font-bold text-white">{target.subsystem}</span>
                            {isWarm ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                WARM CACHED (TTL {target.ttlMinutes}m)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Sparkles className="w-3 h-3" />
                                SUGGESTED PRE-FETCH ({target.hitProbabilityPct}% Hit Prob)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <span>Trigger Pattern:</span>
                            <span className="text-slate-300 font-medium">{target.triggerPattern}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePrefetchTarget(target.id, false)}
                          disabled={isThisPrefetching}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            isWarm
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm'
                          }`}
                        >
                          <Cpu className={`w-3.5 h-3.5 ${isThisPrefetching ? 'animate-spin' : ''}`} />
                          <span>
                            {isThisPrefetching
                              ? 'Indexing...'
                              : isWarm
                              ? 'Refresh Index'
                              : 'Pre-Fetch Now'}
                          </span>
                        </button>
                      </div>

                      {/* Indexed Paths */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {target.paths.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-mono text-[10px] border border-slate-800"
                          >
                            <FileCode className="w-3 h-3 text-indigo-400" />
                            {p}
                          </span>
                        ))}
                      </div>

                      {/* Metrics Footer */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                        <div>
                          <span className="text-slate-500">AST Symbols:</span>{' '}
                          <span className="text-slate-200 font-semibold">
                            {target.astNodesCount.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Vector Chunks:</span>{' '}
                          <span className="text-slate-200 font-semibold">
                            {target.vectorChunksCount} ({target.cacheSizeMb} MB)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Wait Time:</span>{' '}
                          <span className="text-emerald-400 font-bold">
                            {target.coldWaitSec}s → {target.warmWaitSec}s (-{speedupPct}%)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500">Indexed:</span>{' '}
                          <span className="text-slate-300">{target.lastIndexedAt}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Architecture Callout */}
            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Zero-Wait Jules Handshake:</strong> When Kickoff triggers Stage 3 (Google Jules VM), pre-warmed AST & PyTest snapshots mount in <strong>~1.1s</strong> instead of cloning and parsing from scratch.
                </span>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 shrink-0">
                RAM Snapshot Hit Rate: {data.predictionConfidencePct}%
              </span>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};
