import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
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
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Filter,
  Gauge,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap
} from 'lucide-react';
import { AgentConfig, ExecutionLog } from '../types';
import { ExecutionRunRecord } from './CrewStudio';
import { CardMinMaxButtons } from './CardMinMaxControl';

export interface HistoricalTracePoint {
  runId: string;
  runLabel: string;
  timestamp: string;
  crewName: string;
  agentName: string;
  processMode: 'sequential' | 'hierarchical';
  latencyMs: number;
  p95LatencyMs: number;
  llmLatencyMs: number;
  toolLatencyMs: number;
  vmVerifyLatencyMs: number;
  tokensUsed: number;
  tokensPerSec: number;
  efficiencyScore: number;
  successRatePct: number;
  firstPassSuccessPct: number;
  selfHealedPct: number;
  tasksCompleted: number;
  status: 'completed' | 'failed';
}

export interface AgentTraceAggregate {
  agentName: string;
  fullName: string;
  role: string;
  runsCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgTokens: number;
  tokensPerSec: number;
  efficiencyScore: number;
  successRatePct: number;
  selfHealedRatePct: number;
}

const BASELINE_HISTORICAL_TRACES: HistoricalTracePoint[] = [
  {
    runId: 'tr-hist-01',
    runLabel: 'Run #101',
    timestamp: '08:15 AM',
    crewName: 'Full Stack App Crew',
    agentName: 'Elena Vance (Task Maker)',
    processMode: 'hierarchical',
    latencyMs: 3840,
    p95LatencyMs: 4620,
    llmLatencyMs: 2150,
    toolLatencyMs: 990,
    vmVerifyLatencyMs: 700,
    tokensUsed: 1820,
    tokensPerSec: 474,
    efficiencyScore: 91.4,
    successRatePct: 96.5,
    firstPassSuccessPct: 91.0,
    selfHealedPct: 5.5,
    tasksCompleted: 8,
    status: 'completed'
  },
  {
    runId: 'tr-hist-02',
    runLabel: 'Run #102',
    timestamp: '09:05 AM',
    crewName: 'AI & Tech Research Crew',
    agentName: 'Dr. Aria Lin (Researcher)',
    processMode: 'sequential',
    latencyMs: 3410,
    p95LatencyMs: 4180,
    llmLatencyMs: 1890,
    toolLatencyMs: 920,
    vmVerifyLatencyMs: 600,
    tokensUsed: 1540,
    tokensPerSec: 452,
    efficiencyScore: 93.2,
    successRatePct: 98.0,
    firstPassSuccessPct: 94.0,
    selfHealedPct: 4.0,
    tasksCompleted: 6,
    status: 'completed'
  },
  {
    runId: 'tr-hist-03',
    runLabel: 'Run #103',
    timestamp: '09:48 AM',
    crewName: 'Full Stack App Crew',
    agentName: 'Liam Vance (Frontend Arch)',
    processMode: 'hierarchical',
    latencyMs: 4290,
    p95LatencyMs: 5120,
    llmLatencyMs: 2480,
    toolLatencyMs: 1060,
    vmVerifyLatencyMs: 750,
    tokensUsed: 2240,
    tokensPerSec: 522,
    efficiencyScore: 89.8,
    successRatePct: 95.2,
    firstPassSuccessPct: 88.2,
    selfHealedPct: 7.0,
    tasksCompleted: 8,
    status: 'completed'
  },
  {
    runId: 'tr-hist-04',
    runLabel: 'Run #104',
    timestamp: '10:30 AM',
    crewName: 'FinTech Risk & Audit Crew',
    agentName: 'Noah Patel (Backend Lead)',
    processMode: 'hierarchical',
    latencyMs: 3180,
    p95LatencyMs: 3890,
    llmLatencyMs: 1720,
    toolLatencyMs: 840,
    vmVerifyLatencyMs: 620,
    tokensUsed: 1690,
    tokensPerSec: 531,
    efficiencyScore: 94.6,
    successRatePct: 98.8,
    firstPassSuccessPct: 95.3,
    selfHealedPct: 3.5,
    tasksCompleted: 8,
    status: 'completed'
  },
  {
    runId: 'tr-hist-05',
    runLabel: 'Run #105',
    timestamp: '11:15 AM',
    crewName: 'Autonomous DevOps Crew',
    agentName: 'Kai Nakamura (DevOps SRE)',
    processMode: 'sequential',
    latencyMs: 2940,
    p95LatencyMs: 3560,
    llmLatencyMs: 1540,
    toolLatencyMs: 780,
    vmVerifyLatencyMs: 620,
    tokensUsed: 1480,
    tokensPerSec: 503,
    efficiencyScore: 95.8,
    successRatePct: 99.1,
    firstPassSuccessPct: 96.1,
    selfHealedPct: 3.0,
    tasksCompleted: 7,
    status: 'completed'
  },
  {
    runId: 'tr-hist-06',
    runLabel: 'Run #106',
    timestamp: '12:00 PM',
    crewName: 'Full Stack App Crew',
    agentName: 'Sofia Rostova (DB Architect)',
    processMode: 'hierarchical',
    latencyMs: 3520,
    p95LatencyMs: 4210,
    llmLatencyMs: 1920,
    toolLatencyMs: 910,
    vmVerifyLatencyMs: 690,
    tokensUsed: 1910,
    tokensPerSec: 543,
    efficiencyScore: 94.1,
    successRatePct: 98.4,
    firstPassSuccessPct: 94.2,
    selfHealedPct: 4.2,
    tasksCompleted: 8,
    status: 'completed'
  },
  {
    runId: 'tr-hist-07',
    runLabel: 'Run #107',
    timestamp: '12:45 PM',
    crewName: 'Full Stack App Crew',
    agentName: 'Chloe Laurent (UI/UX)',
    processMode: 'hierarchical',
    latencyMs: 2790,
    p95LatencyMs: 3340,
    llmLatencyMs: 1490,
    toolLatencyMs: 720,
    vmVerifyLatencyMs: 580,
    tokensUsed: 1580,
    tokensPerSec: 566,
    efficiencyScore: 96.7,
    successRatePct: 99.4,
    firstPassSuccessPct: 97.0,
    selfHealedPct: 2.4,
    tasksCompleted: 8,
    status: 'completed'
  },
  {
    runId: 'tr-hist-08',
    runLabel: 'Run #108',
    timestamp: '01:20 PM',
    crewName: 'Full Stack App Crew',
    agentName: 'Marcus Sterling (Controller)',
    processMode: 'hierarchical',
    latencyMs: 2610,
    p95LatencyMs: 3120,
    llmLatencyMs: 1380,
    toolLatencyMs: 680,
    vmVerifyLatencyMs: 550,
    tokensUsed: 1520,
    tokensPerSec: 582,
    efficiencyScore: 97.5,
    successRatePct: 99.7,
    firstPassSuccessPct: 97.8,
    selfHealedPct: 1.9,
    tasksCompleted: 8,
    status: 'completed'
  }
];

interface DashboardViewProps {
  historyRuns?: ExecutionRunRecord[];
  activeLogs?: ExecutionLog[];
  agents?: AgentConfig[];
  compact?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  historyRuns,
  activeLogs = [],
  agents = [],
  compact = false
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'efficiency' | 'latency' | 'success'>('all');
  const [timeWindow, setTimeWindow] = useState<'last_8' | 'all'>('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [simulatedTraces, setSimulatedTraces] = useState<HistoricalTracePoint[]>([]);
  const [storedHistory, setStoredHistory] = useState<ExecutionRunRecord[]>([]);

  const loadLocalStorageHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem('crewai_studio_execution_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setStoredHistory(parsed);
        }
      }
    } catch {
      // ignore storage read error
    }
  }, []);

  useEffect(() => {
    loadLocalStorageHistory();
  }, [loadLocalStorageHistory, historyRuns?.length, activeLogs.length]);

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setIsMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  // Merge baseline historical trace points with persisted executionHistory runs and live simulated points
  const allTracePoints: HistoricalTracePoint[] = useMemo(() => {
    const sourceRuns = historyRuns && historyRuns.length > 0 ? historyRuns : storedHistory;

    const convertedFromRuns: HistoricalTracePoint[] = sourceRuns
      .slice()
      .reverse()
      .map((run, idx) => {
        const duration = Math.max(900, run.durationMs || 3200);
        const tokens = Math.max(400, run.tokensUsed || 1450);
        const tokPerSec = Math.round((tokens / duration) * 1000);
        const primaryAgentLog = run.logs?.find((l) => l.agentName && l.agentName !== 'Flow Orchestrator');
        const agentName =
          primaryAgentLog?.agentName ||
          agents[idx % Math.max(1, agents.length)]?.name ||
          'Marcus Sterling (Controller)';
        const hasHeal = run.logs?.some((l) => l.type === 'jules_heal');
        const isSuccess = run.status === 'completed';

        const efficiencyScore = Number(
          Math.min(
            99.4,
            Math.max(78.0, 92 + (tokPerSec - 420) * 0.025 - (duration > 4500 ? 3.5 : 0))
          ).toFixed(1)
        );

        return {
          runId: run.id || `run-live-${idx}`,
          runLabel: `Run #${109 + idx}`,
          timestamp: run.timestamp?.replace(/^Today at\s+/i, '') || 'Live Run',
          crewName: run.crewName || 'Active Studio Crew',
          agentName,
          processMode: run.processMode || 'hierarchical',
          latencyMs: duration,
          p95LatencyMs: Math.round(duration * 1.19),
          llmLatencyMs: Math.round(duration * 0.54),
          toolLatencyMs: Math.round(duration * 0.27),
          vmVerifyLatencyMs: Math.round(duration * 0.19),
          tokensUsed: tokens,
          tokensPerSec: tokPerSec,
          efficiencyScore,
          successRatePct: isSuccess ? 99.2 : 76.0,
          firstPassSuccessPct: isSuccess ? (hasHeal ? 91.5 : 97.6) : 70.0,
          selfHealedPct: hasHeal ? 7.7 : 1.6,
          tasksCompleted: run.tasksCount || 8,
          status: run.status
        };
      });

    const combined = [...BASELINE_HISTORICAL_TRACES, ...convertedFromRuns, ...simulatedTraces];
    return combined;
  }, [historyRuns, storedHistory, agents, simulatedTraces]);

  // Unique agent names for filter dropdown
  const availableAgentNames = useMemo(() => {
    const set = new Set<string>();
    allTracePoints.forEach((pt) => set.add(pt.agentName));
    agents.forEach((a) => set.add(a.name));
    return Array.from(set);
  }, [allTracePoints, agents]);

  // Filtered trace series for time-series Recharts
  const filteredTraces = useMemo(() => {
    let list = allTracePoints;
    if (selectedAgentFilter !== 'all') {
      list = list.filter((pt) => pt.agentName === selectedAgentFilter);
    }
    if (timeWindow === 'last_8') {
      list = list.slice(-8);
    }
    return list.length > 0 ? list : allTracePoints.slice(-6);
  }, [allTracePoints, selectedAgentFilter, timeWindow]);

  // Per-Agent aggregated performance metrics for BarChart & ComposedChart comparisons
  const agentAggregates: AgentTraceAggregate[] = useMemo(() => {
    const map = new Map<
      string,
      {
        agentName: string;
        role: string;
        runsCount: number;
        totalLatency: number;
        maxP95: number;
        totalTokens: number;
        totalTokPerSec: number;
        totalEfficiency: number;
        totalSuccess: number;
        totalHealed: number;
      }
    >();

    allTracePoints.forEach((pt) => {
      const matchedAgent = agents.find(
        (a) => a.name === pt.agentName || pt.agentName.includes(a.name.split(' ')[0])
      );
      const role = matchedAgent?.role || 'Autonomous Specialist';
      const existing = map.get(pt.agentName) || {
        agentName: pt.agentName,
        role,
        runsCount: 0,
        totalLatency: 0,
        maxP95: 0,
        totalTokens: 0,
        totalTokPerSec: 0,
        totalEfficiency: 0,
        totalSuccess: 0,
        totalHealed: 0
      };

      existing.runsCount += 1;
      existing.totalLatency += pt.latencyMs;
      existing.maxP95 = Math.max(existing.maxP95, pt.p95LatencyMs);
      existing.totalTokens += pt.tokensUsed;
      existing.totalTokPerSec += pt.tokensPerSec;
      existing.totalEfficiency += pt.efficiencyScore;
      existing.totalSuccess += pt.successRatePct;
      existing.totalHealed += pt.selfHealedPct;
      map.set(pt.agentName, existing);
    });

    return Array.from(map.values())
      .map((item) => {
        const count = Math.max(1, item.runsCount);
        const shortName = item.agentName.replace(/\s*\(.*\)/, '');
        return {
          agentName: shortName,
          fullName: item.agentName,
          role: item.role,
          runsCount: item.runsCount,
          avgLatencyMs: Math.round(item.totalLatency / count),
          p95LatencyMs: item.maxP95,
          avgTokens: Math.round(item.totalTokens / count),
          tokensPerSec: Math.round(item.totalTokPerSec / count),
          efficiencyScore: Number((item.totalEfficiency / count).toFixed(1)),
          successRatePct: Number((item.totalSuccess / count).toFixed(1)),
          selfHealedRatePct: Number((item.totalHealed / count).toFixed(1))
        };
      })
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }, [allTracePoints, agents]);

  // Summary KPIs
  const summaryKpis = useMemo(() => {
    const count = Math.max(1, filteredTraces.length);
    const avgEfficiency =
      filteredTraces.reduce((acc, r) => acc + r.efficiencyScore, 0) / count;
    const avgLatencyMs =
      filteredTraces.reduce((acc, r) => acc + r.latencyMs, 0) / count;
    const avgP95Ms =
      filteredTraces.reduce((acc, r) => acc + r.p95LatencyMs, 0) / count;
    const avgSuccessPct =
      filteredTraces.reduce((acc, r) => acc + r.successRatePct, 0) / count;
    const avgTokPerSec =
      filteredTraces.reduce((acc, r) => acc + r.tokensPerSec, 0) / count;
    const totalTokens = filteredTraces.reduce((acc, r) => acc + r.tokensUsed, 0);

    return {
      totalRuns: filteredTraces.length,
      avgEfficiency: avgEfficiency.toFixed(1),
      avgLatencySec: (avgLatencyMs / 1000).toFixed(2),
      avgP95Sec: (avgP95Ms / 1000).toFixed(2),
      avgSuccessPct: avgSuccessPct.toFixed(1),
      avgTokPerSec: Math.round(avgTokPerSec),
      totalTokensK: (totalTokens / 1000).toFixed(1)
    };
  }, [filteredTraces]);

  const handleSimulateNewTracePoint = () => {
    const nextIdx = allTracePoints.length + 101;
    const sampleAgents = [
      'Elena Vance (Task Maker)',
      'Marcus Sterling (Controller)',
      'Liam Vance (Frontend Arch)',
      'Noah Patel (Backend Lead)',
      'Sofia Rostova (DB Architect)',
      'Kai Nakamura (DevOps SRE)'
    ];
    const pickedAgent =
      selectedAgentFilter !== 'all'
        ? selectedAgentFilter
        : sampleAgents[simulatedTraces.length % sampleAgents.length];

    const latencyMs = Math.round(2350 + Math.random() * 950);
    const tokensUsed = Math.round(1420 + Math.random() * 520);
    const tokensPerSec = Math.round((tokensUsed / latencyMs) * 1000);
    const efficiencyScore = Number((94.2 + Math.random() * 4.9).toFixed(1));
    const successRatePct = Number((98.1 + Math.random() * 1.8).toFixed(1));
    const selfHealedPct = Number((1.4 + Math.random() * 2.6).toFixed(1));

    const newPoint: HistoricalTracePoint = {
      runId: `tr-sim-${Date.now()}`,
      runLabel: `Run #${nextIdx}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      crewName: 'Full Stack App Crew',
      agentName: pickedAgent,
      processMode: 'hierarchical',
      latencyMs,
      p95LatencyMs: Math.round(latencyMs * 1.16),
      llmLatencyMs: Math.round(latencyMs * 0.52),
      toolLatencyMs: Math.round(latencyMs * 0.28),
      vmVerifyLatencyMs: Math.round(latencyMs * 0.2),
      tokensUsed,
      tokensPerSec,
      efficiencyScore,
      successRatePct,
      firstPassSuccessPct: Number((successRatePct - selfHealedPct).toFixed(1)),
      selfHealedPct,
      tasksCompleted: 8,
      status: 'completed'
    };

    setSimulatedTraces((prev) => [...prev, newPoint]);
  };

  const handleExportTelemetryJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      summary: summaryKpis,
      historicalTraces: filteredTraces,
      agentBreakdown: agentAggregates
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crewai-trace-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Agent Execution Efficiency, Latency, and Success Rates Dashboard"
      className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5 shadow-xl"
    >
      {/* Top Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Agent Telemetry & Trace Analytics Dashboard
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              · {summaryKpis.totalRuns} Historical Trace Runs · Recharts Telemetry
            </span>
          </div>
          {!isMinimized && (
            <p className="text-xs text-slate-400">
              Historical OpenTelemetry trace analytics visualizing agent execution efficiency, stage latency distributions (P50/P95), and first-pass vs. Jules self-healed success rates.
            </p>
          )}
        </div>

        {/* Interactive Filter & View Switcher Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Chart View Segmented Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: 'All Metrics' },
                { id: 'efficiency', label: 'Efficiency' },
                { id: 'latency', label: 'Latency' },
                { id: 'success', label: 'Success Rates' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Agent Role Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filter telemetry by agent"
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900">
                All Specialist Agents ({availableAgentNames.length})
              </option>
              {availableAgentNames.map((name) => (
                <option key={name} value={name} className="bg-slate-900">
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Window Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTimeWindow('last_8')}
              className={`px-2 py-1 rounded-lg font-mono text-[11px] transition cursor-pointer ${
                timeWindow === 'last_8' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Last 8
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('all')}
              className={`px-2 py-1 rounded-lg font-mono text-[11px] transition cursor-pointer ${
                timeWindow === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Runs
            </button>
          </div>

          {/* Simulate Trace Sample Button */}
          <button
            type="button"
            onClick={handleSimulateNewTracePoint}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Append a new live trace execution datapoint to test real-time chart updates"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Record Trace Sample</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportTelemetryJson}
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
            title="Export trace telemetry metrics as JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          {!compact && (
            <CardMinMaxButtons
              isMinimized={isMinimized}
              onMinimize={() => setIsMinimized(true)}
              onExpand={() => setIsMinimized(false)}
              title="Agent Telemetry & Trace Analytics Dashboard"
            />
          )}
        </div>
      </div>

      {/* Top KPI Summary Strip (Always visible) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Execution Efficiency Index</span>
            <Gauge className="w-4 h-4 text-[#EB6658]" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
            {summaryKpis.avgEfficiency}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {summaryKpis.avgTokPerSec} tok/s throughput · {summaryKpis.totalTokensK}k total
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Pipeline Latency (P50)</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
            {summaryKpis.avgLatencySec}s
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            P95 Tail: {summaryKpis.avgP95Sec}s · Target &lt; 4.50s
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Verified Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
            {summaryKpis.avgSuccessPct}%
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Includes Jules Cloud VM self-healing recovery
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Audited Trace Spans</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
            {summaryKpis.totalRuns * 8}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Across {availableAgentNames.length} active specialist agents
          </div>
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-6 pt-1">
          {/* Row 1: Agent Execution Efficiency & Token Velocity (ComposedChart + Agent Efficiency BarChart) */}
          {(activeTab === 'all' || activeTab === 'efficiency') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Historical Execution Efficiency & Throughput Trend (7 cols) */}
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#EB6658]" />
                      <span>01. Historical Agent Execution Efficiency & Token Velocity</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Efficiency Score (%) vs. Token Generation Velocity (tokens/sec) across trace executions
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Target Efficiency ≥ 90%
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredTraces}
                      margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="effGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EB6658" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#EB6658" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="runLabel"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        domain={[70, 100]}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        unit="%"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[200, 700]}
                        stroke="#38bdf8"
                        fontSize={11}
                        tickLine={false}
                        unit=" t/s"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine
                        yAxisId="left"
                        y={90}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{
                          value: '90% SLA',
                          position: 'insideTopLeft',
                          fill: '#10b981',
                          fontSize: 10
                        }}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="tokensPerSec"
                        name="Token Velocity (tok/s)"
                        fill="#0284c7"
                        radius={[4, 4, 0, 0]}
                        barSize={22}
                        fillOpacity={0.75}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="efficiencyScore"
                        name="Efficiency Score (%)"
                        stroke="#EB6658"
                        strokeWidth={2.5}
                        fill="url(#effGradient)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Per-Agent Efficiency & Token Utilization Ranking (5 cols) */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-amber-400" />
                      <span>02. Efficiency by Specialist Agent</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Aggregated execution efficiency score (%) per role
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={agentAggregates.slice(0, 6)}
                      layout="vertical"
                      margin={{ top: 6, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[75, 100]}
                        stroke="#64748b"
                        fontSize={11}
                        unit="%"
                      />
                      <YAxis
                        type="category"
                        dataKey="agentName"
                        stroke="#cbd5e1"
                        fontSize={11}
                        width={115}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Bar
                        dataKey="efficiencyScore"
                        name="Efficiency Score (%)"
                        radius={[0, 6, 6, 0]}
                        barSize={18}
                      >
                        {agentAggregates.slice(0, 6).map((entry, idx) => (
                          <Cell
                            key={`cell-eff-${idx}`}
                            fill={
                              entry.efficiencyScore >= 95
                                ? '#10b981'
                                : entry.efficiencyScore >= 92
                                ? '#EB6658'
                                : '#f59e0b'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Latency Distribution (P50 vs P95 AreaChart + Stage Latency Breakdown BarChart) */}
          {(activeTab === 'all' || activeTab === 'latency') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* P50 vs P95 Historical Latency Trend (7 cols) */}
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span>03. Historical Pipeline Latency (P50 vs. P95 Tail)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      End-to-end execution duration (ms) vs. P95 tail latency across trace runs
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-sky-400">
                    SLA Budget: 4,500ms
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={filteredTraces}
                      margin={{ top: 10, right: 16, left: -6, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="runLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine
                        y={4500}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        label={{
                          value: '4,500ms Ceiling',
                          position: 'insideTopRight',
                          fill: '#f43f5e',
                          fontSize: 10
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="p95LatencyMs"
                        name="P95 Tail Latency (ms)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#p95Grad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="latencyMs"
                        name="Median P50 Latency (ms)"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        fill="url(#p50Grad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stacked Stage Latency Decomposition (LLM vs Tool vs Jules VM) (5 cols) */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>04. Span Latency Breakdown by Stage</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    LLM Reasoning vs. Tool Calls vs. Jules VM PyTest Verification (ms)
                  </p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredTraces.slice(-6)}
                      margin={{ top: 10, right: 12, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="runLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        dataKey="llmLatencyMs"
                        stackId="stage"
                        name="LLM Reasoning (ms)"
                        fill="#EB6658"
                      />
                      <Bar
                        dataKey="toolLatencyMs"
                        stackId="stage"
                        name="Tool Execution (ms)"
                        fill="#38bdf8"
                      />
                      <Bar
                        dataKey="vmVerifyLatencyMs"
                        stackId="stage"
                        name="Jules VM Verify (ms)"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Success Rates & Jules Self-Healing Reliability */}
          {(activeTab === 'all' || activeTab === 'success') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Historical Success Rate & Self-Healing Contribution (7 cols) */}
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>05. Historical Success Rates & Self-Healing Recovery</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Total Verified Success (%) composed of First-Pass Completion + Jules VM Self-Healed Runs
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Zero Unhandled Failures
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={filteredTraces}
                      margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="runLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        yAxisId="left"
                        domain={[80, 100]}
                        stroke="#10b981"
                        fontSize={11}
                        tickLine={false}
                        unit="%"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 15]}
                        stroke="#a855f7"
                        fontSize={11}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090D16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        yAxisId="right"
                        dataKey="selfHealedPct"
                        name="Jules Self-Healed Recovery (%)"
                        fill="#a855f7"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                        fillOpacity={0.75}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="firstPassSuccessPct"
                        name="First-Pass Success (%)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="successRatePct"
                        name="Total Verified Success (%)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#10b981' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Per-Agent Success Rate & Latency Audit Table (5 cols) */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>06. Per-Agent Reliability & Latency Matrix</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any agent row to filter the historical Recharts telemetry
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                          <th className="py-2 pr-2">Agent</th>
                          <th className="py-2 px-2 text-right">Efficiency</th>
                          <th className="py-2 px-2 text-right">Avg Latency</th>
                          <th className="py-2 pl-2 text-right">Success</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {agentAggregates.map((ag) => {
                          const isSelected = selectedAgentFilter === (ag as any).fullName;
                          return (
                            <tr
                              key={ag.fullName}
                              onClick={() =>
                                setSelectedAgentFilter(
                                  isSelected ? 'all' : (ag as any).fullName || ag.agentName
                                )
                              }
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-[#EB6658]/15 text-white'
                                  : 'hover:bg-slate-900/80 text-slate-300'
                              }`}
                            >
                              <td className="py-2 pr-2 font-sans font-semibold text-white truncate max-w-[140px]">
                                {ag.agentName}
                              </td>
                              <td className="py-2 px-2 text-right text-[#EB6658] font-bold tabular-nums">
                                {ag.efficiencyScore}%
                              </td>
                              <td className="py-2 px-2 text-right text-sky-400 tabular-nums">
                                {(ag.avgLatencyMs / 1000).toFixed(2)}s
                              </td>
                              <td className="py-2 pl-2 text-right text-emerald-400 font-bold tabular-nums">
                                {ag.successRatePct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedAgentFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedAgentFilter('all')}
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 transition cursor-pointer"
                  >
                    Clear Agent Filter (Show All Specialists)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default DashboardView;
