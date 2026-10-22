import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  Clock,
  Zap,
  GitMerge,
  Activity,
  Calendar,
  Flame,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  CheckCircle2,
  Layers,
  Cpu
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';
import { ExecutionLog } from '../types';
import {
  HistoricalMergePattern,
  CodebaseIndexTarget,
  MergeVelocityBucket
} from './PredictiveSchedulerModule';

interface PredictiveInsightsPayload {
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

interface PredictiveInsightsDashboardProps {
  crewName: string;
  selectedRepo: string;
  latestPrTrigger?: number | null;
  onEmitAuditLog?: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

export const PredictiveInsightsDashboard: React.FC<PredictiveInsightsDashboardProps> = ({
  crewName,
  selectedRepo,
  latestPrTrigger,
  onEmitAuditLog,
  onNotify
}) => {
  const [data, setData] = useState<PredictiveInsightsPayload | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeChartView, setActiveChartView] = useState<'cadence_24h' | 'weekly_trend' | 'subsystem_latency'>('cadence_24h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spikeBoost, setSpikeBoost] = useState(0);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/jules/predictive-scheduler');
      if (!res.ok) return;
      const json: PredictiveInsightsPayload = await res.json();
      setData(json);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useEffect(() => {
    if (latestPrTrigger && latestPrTrigger > 0) {
      fetchInsights();
    }
  }, [latestPrTrigger, fetchInsights]);

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

  // Enrich 24h velocity buckets for Recharts ComposedChart
  const hourlyChartData = useMemo(() => {
    if (!data) return [];
    return data.velocityTimeline.map((b, idx) => {
      const boost = b.isCurrentWindow || idx === 7 ? spikeBoost : Math.round(spikeBoost * 0.35);
      const mergedPrs = b.mergedPrs + boost;
      const predictedSessions = b.predictedSessions + Math.round(boost * 1.15);
      const indexingLikelihoodPct = Math.min(
        99,
        Math.round(52 + (mergedPrs / 25) * 44 + (b.isPeakWindow ? 6 : 0))
      );
      return {
        window: b.windowLabel,
        shortWindow: b.windowLabel.slice(0, 5),
        mergedPrs,
        predictedSessions,
        indexingLikelihoodPct,
        preWarmLeadMin: b.preWarmLeadMin,
        isPeakWindow: b.isPeakWindow,
        isCurrentWindow: Boolean(b.isCurrentWindow)
      };
    });
  }, [data, spikeBoost]);

  // 7-Day Historical Merge Pattern & Pre-Fetch Hit Rate Trend
  const weeklyTrendData = useMemo(() => {
    const base = [
      { day: 'Mon', historicalMerges: 38, julesIndexingRuns: 42, preWarmHitPct: 91.2, coldWaitSavedMin: 11.4 },
      { day: 'Tue', historicalMerges: 46, julesIndexingRuns: 51, preWarmHitPct: 93.5, coldWaitSavedMin: 14.2 },
      { day: 'Wed', historicalMerges: 52, julesIndexingRuns: 58, preWarmHitPct: 94.8, coldWaitSavedMin: 16.5 },
      { day: 'Thu', historicalMerges: 49, julesIndexingRuns: 54, preWarmHitPct: 94.1, coldWaitSavedMin: 15.1 },
      { day: 'Fri', historicalMerges: 61, julesIndexingRuns: 67, preWarmHitPct: 96.0, coldWaitSavedMin: 18.9 },
      { day: 'Sat', historicalMerges: 34, julesIndexingRuns: 39, preWarmHitPct: 95.4, coldWaitSavedMin: 10.8 },
      {
        day: 'Sun (Today)',
        historicalMerges: 55 + spikeBoost * 2,
        julesIndexingRuns: 62 + spikeBoost * 2,
        preWarmHitPct: data?.predictionConfidencePct || 96.4,
        coldWaitSavedMin: Number(((data?.totalMinutesSavedSession || 48.5) * 0.38).toFixed(1))
      }
    ];
    return base;
  }, [data, spikeBoost]);

  // Subsystem Cold vs. Warm Latency & Indexing Likelihood Data
  const subsystemChartData = useMemo(() => {
    if (!data) return [];
    return data.indexTargets.map((t) => ({
      name: t.subsystem.split(' ').slice(0, 3).join(' '),
      fullName: t.subsystem,
      coldWaitSec: t.coldWaitSec,
      warmWaitSec: t.warmWaitSec,
      hitProbabilityPct: t.hitProbabilityPct,
      astNodesK: Number((t.astNodesCount / 1000).toFixed(1)),
      status: t.status
    }));
  }, [data]);

  const handleToggleAutoPreFetch = async () => {
    if (!data) return;
    try {
      const res = await fetch('/api/jules/predictive-scheduler/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data.autoPreFetchEnabled })
      });
      if (res.ok) {
        const json: PredictiveInsightsPayload = await res.json();
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

  const handleSimulateForecastRefresh = async () => {
    setIsRefreshing(true);
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
        const json: PredictiveInsightsPayload = await res.json();
        setData(json);
        setSpikeBoost((prev) => (prev >= 6 ? 2 : prev + 2));

        onEmitAuditLog?.({
          stage: 'orchestrator',
          severity: 'info',
          traceId: `tr-insights-${Date.now().toString().slice(-4)}`,
          spanId: 'sp-forecast',
          agentName: 'Predictive Insights Forecaster',
          type: 'system',
          title: `Updated Recharts Merge Velocity & Jules Indexing Forecast`,
          content: `Recalculated 24h PR merge density and subsystem co-change probabilities for ${
            selectedRepo || 'crewAIInc/crewAI'
          }. Peak indexing likelihood: 98% in current window (21:00–24:00 UTC).`,
          meta: {
            durationMs: 145,
            model: 'Temporal Merge Forecaster',
            branch: 'main'
          }
        });

        onNotify?.(
          'success',
          `Predictive Insights updated — Jules indexing likelihood at ${json.predictionConfidencePct}% confidence.`
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!data) return null;

  const peakBucket = hourlyChartData.reduce(
    (max, cur) => (cur.indexingLikelihoodPct > max.indexingLikelihoodPct ? cur : max),
    hourlyChartData[0] || {
      window: '21:00–24:00',
      indexingLikelihoodPct: 97,
      mergedPrs: 22,
      predictedSessions: 25,
      preWarmLeadMin: 20
    }
  );

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-sky-950/25 border border-sky-500/30 shadow-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Predictive Insights Dashboard — Historical Merge Patterns & Jules Indexing Forecast
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <Sparkles className="w-3 h-3 text-sky-400" />
                PEAK LIKELIHOOD: {peakBucket.indexingLikelihoodPct}% ({peakBucket.window} UTC)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                NEXT AUTO-INDEX: T-{peakBucket.preWarmLeadMin}m LEAD
              </span>
            </div>
            {isExpanded && (
              <p className="text-xs text-slate-400 mt-0.5">
                Visualizes 24-hour PR merge velocity, 7-day co-change cadence, and subsystem cold- vs. warm-boot latencies to forecast exactly when Google Jules will trigger codebase indexing.
              </p>
            )}
          </div>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleAutoPreFetch}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all flex items-center gap-1.5 ${
              data.autoPreFetchEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Automatically pre-fetch codebase AST & embeddings"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                data.autoPreFetchEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{data.autoPreFetchEnabled ? 'Auto Pre-Fetch: ON' : 'Auto Pre-Fetch: OFF'}</span>
          </button>

          <div className="flex items-center bg-slate-950/90 p-1 rounded-lg border border-slate-800 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setActiveChartView('cadence_24h')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeChartView === 'cadence_24h'
                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24h Merge & Trigger Curve
            </button>
            <button
              type="button"
              onClick={() => setActiveChartView('subsystem_latency')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeChartView === 'subsystem_latency'
                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Subsystem Latency Impact
            </button>
            <button
              type="button"
              onClick={() => setActiveChartView('weekly_trend')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeChartView === 'weekly_trend'
                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7-Day Velocity Trend
            </button>
          </div>

          <button
            type="button"
            onClick={handleSimulateForecastRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Forecasting...' : 'Simulate Merge Spike'}</span>
          </button>

          <CardMinMaxButtons
            isMinimized={!isExpanded}
            onMinimize={() => setIsExpanded(false)}
            onExpand={() => setIsExpanded(true)}
            title="Predictive Insights Dashboard"
            className="ml-auto"
          />
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Main Recharts Visualization Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Primary Chart Area (8 cols) */}
            <div className="lg:col-span-8 p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {activeChartView === 'cadence_24h' && (
                      <>
                        <Activity className="w-3.5 h-3.5 text-sky-400" />
                        <span>24-Hour Historical PR Merges vs. Jules Indexing Trigger Likelihood (%)</span>
                      </>
                    )}
                    {activeChartView === 'subsystem_latency' && (
                      <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Codebase Subsystem Indexing Wait Time: Cold Clone vs. Pre-Fetched AST Cache (Seconds)</span>
                      </>
                    )}
                    {activeChartView === 'weekly_trend' && (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>7-Day Historical Merge Volume & Predictive Pre-Fetch Hit Rate</span>
                      </>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {activeChartView === 'cadence_24h' &&
                      'Bars show historical merged PR volume per 3h UTC window; area & line track predicted Jules VM sessions and indexing probability.'}
                    {activeChartView === 'subsystem_latency' &&
                      'Compares cold git-clone + AST symbol parsing wait time against pre-fetched RAM snapshot mounting across repository modules.'}
                    {activeChartView === 'weekly_trend' &&
                      'Tracks daily merged PRs vs. autonomous Jules indexing sessions and pre-warmed snapshot cache hit rate over the last 7 days.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    Target: {selectedRepo || 'crewAIInc/crewAI'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Pre-Warm Threshold: ≥80%
                  </span>
                </div>
              </div>

              {/* Recharts Container */}
              <div className="w-full h-72 pt-2">
                {activeChartView === 'cadence_24h' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={hourlyChartData}
                      margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="likelihoodGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="shortWindow"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        label={{
                          value: 'PRs / Sessions',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748b',
                          fontSize: 10
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        stroke="#38bdf8"
                        tick={{ fill: '#38bdf8', fontSize: 11, fontFamily: 'monospace' }}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine
                        yAxisId="right"
                        y={80}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Auto Pre-Warm Trigger (80%)',
                          fill: '#10b981',
                          fontSize: 10,
                          position: 'insideTopRight'
                        }}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="indexingLikelihoodPct"
                        name="Jules Indexing Likelihood (%)"
                        fill="url(#likelihoodGrad)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="mergedPrs"
                        name="Historical Merged PRs"
                        radius={[4, 4, 0, 0]}
                        barSize={22}
                      >
                        {hourlyChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.isCurrentWindow
                                ? '#10b981'
                                : entry.isPeakWindow
                                ? '#6366f1'
                                : '#475569'
                            }
                          />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="predictedSessions"
                        name="Predicted Jules Sessions"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#f59e0b', strokeWidth: 1, stroke: '#0f172a' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {activeChartView === 'subsystem_latency' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subsystemChartData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        unit="s"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        dataKey="coldWaitSec"
                        name="Cold Clone + AST Parse Wait (s)"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        barSize={26}
                      />
                      <Bar
                        dataKey="warmWaitSec"
                        name="Pre-Fetched Warm Snapshot Boot (s)"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        barSize={26}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {activeChartView === 'weekly_trend' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={weeklyTrendData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="weeklyMergesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="weeklyJulesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="day"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area
                        type="monotone"
                        dataKey="historicalMerges"
                        name="Merged PRs (Daily)"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#weeklyMergesGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="julesIndexingRuns"
                        name="Pre-Warmed Jules Indexing Sessions"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#weeklyJulesGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Bottom Chart Legend Callout */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                    <span>Active UTC Window (21:00–24:00)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
                    <span>Historical Peak Merge Window</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                    <span>Predicted Jules Indexing Sessions</span>
                  </span>
                </div>
                <span className="font-mono text-[10px] text-sky-400">
                  Confidence Score: {data.predictionConfidencePct}%
                </span>
              </div>
            </div>

            {/* Right Column (4 cols): High-Level Forecast Timeline & Indexing Trigger Radar */}
            <div className="lg:col-span-4 p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upcoming Jules Indexing Forecast</span>
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    Live Forecast
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  High-probability indexing triggers predicted from recent PR merge cascades and temporal repository activity:
                </p>

                <div className="space-y-2.5">
                  {data.historicalPatterns.slice(0, 3).map((pat, index) => {
                    const target = data.indexTargets.find((t) => t.id === pat.associatedTargetId);
                    const isWarm = target?.status === 'warm_cached';

                    return (
                      <div
                        key={pat.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            #{index + 1} • {pat.predictedWindow}
                          </span>
                          <span className="text-xs font-extrabold font-mono text-sky-400">
                            {pat.confidencePct}% likely
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-100 leading-snug">
                          {pat.patternName}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Signal: <span className="text-slate-300">{pat.triggerSignal}</span>
                        </div>

                        {/* Progress Bar of Likelihood */}
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                            style={{ width: `${Math.min(100, pat.confidencePct)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                          <span className="text-slate-400 flex items-center gap-1">
                            <GitMerge className="w-3 h-3 text-indigo-400" />
                            {pat.historicalMergeCount} merges (avg +{pat.avgFollowUpMinutes}m)
                          </span>
                          {isWarm ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              Pre-Indexed
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" />
                              Queued T-15m
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Insight Box */}
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    <span>Predictive Indexing Summary</span>
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    -{data.waitTimeReductionPct}% Wait
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Jules is <strong>{peakBucket.indexingLikelihoodPct}% likely</strong> to trigger AST + vector indexing during <strong>{peakBucket.window} UTC</strong>. Pre-warming snapshots <strong>{peakBucket.preWarmLeadMin}m</strong> ahead saves <strong>~17.3s</strong> per session.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
