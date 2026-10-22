import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  AgentConfig,
  AuditCycleStage,
  AuditLogSeverity,
  ExecutionLog
} from '../types';
import {
  Terminal,
  Search,
  Filter,
  History,
  Play,
  RotateCcw,
  Cpu,
  Wrench,
  CheckCircle2,
  GitPullRequest,
  GitBranch,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Minimize2,
  Maximize2,
  Sparkles,
  ArrowRight,
  X,
  Eye,
  Code2
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

interface StructuredAuditLogPanelProps {
  logs: ExecutionLog[];
  agents: AgentConfig[];
  isRunning: boolean;
  runInput: string;
  onRunInputChange: (val: string) => void;
  onKickoff: () => void;
  fullCycleEnabled: boolean;
  onToggleFullCycle: (enabled: boolean) => void;
  activeCycleStage: AuditCycleStage | 'idle' | 'completed';
  executionHistoryCount: number;
  onOpenHistory: () => void;
  onLoadSampleCycleTrace: () => void;
  onClearLogs: () => void;
}

const STAGE_META: Record<
  AuditCycleStage,
  {
    label: string;
    shortLabel: string;
    roleSummary: string;
    badgeClass: string;
    dotClass: string;
    activeBorderClass: string;
  }
> = {
  orchestrator: {
    label: '1. Orchestrator',
    shortLabel: 'ORCHESTRATOR',
    roleSummary: 'Triggers, @persist state & Gemini quota routing (never writes code directly)',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dotClass: 'bg-purple-400',
    activeBorderClass: 'border-purple-500/60 bg-purple-500/10'
  },
  crew: {
    label: '2. Crew Agents',
    shortLabel: 'CREW AGENT',
    roleSummary: 'Multi-agent domain research, synthesis & code artifact drafting',
    badgeClass: 'bg-[#EB6658]/15 text-[#EB6658] border-[#EB6658]/30',
    dotClass: 'bg-[#EB6658]',
    activeBorderClass: 'border-[#EB6658]/60 bg-[#EB6658]/10'
  },
  jules: {
    label: '3. Jules Cloud VM',
    shortLabel: 'JULES VM',
    roleSummary: 'Isolated Google Cloud VM: runs pytest/AST & self-heals failures asynchronously',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
    activeBorderClass: 'border-blue-500/60 bg-blue-500/10'
  },
  github: {
    label: '4. GitHub PR',
    shortLabel: 'GITHUB PR',
    roleSummary: 'Pushes verified jules/auto-* branch, opens PR & reports status back to Orchestrator',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    activeBorderClass: 'border-emerald-500/60 bg-emerald-500/10'
  }
};

const SEVERITY_BADGE: Record<AuditLogSeverity, { label: string; className: string }> = {
  info: {
    label: 'INFO',
    className: 'bg-slate-800 text-slate-300 border-slate-700'
  },
  success: {
    label: '200 OK',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  warn: {
    label: 'SELF-HEAL',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  error: {
    label: 'FAULT',
    className: 'bg-red-500/15 text-red-300 border-red-500/30'
  }
};

export const StructuredAuditLogPanel: React.FC<StructuredAuditLogPanelProps> = ({
  logs,
  agents,
  isRunning,
  runInput,
  onRunInputChange,
  onKickoff,
  fullCycleEnabled,
  onToggleFullCycle,
  activeCycleStage,
  executionHistoryCount,
  onOpenHistory,
  onLoadSampleCycleTrace,
  onClearLogs
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<AuditCycleStage | 'all'>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [showCycleGuide, setShowCycleGuide] = useState<boolean>(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const streamContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll when new logs stream in
  useEffect(() => {
    if (autoScroll && streamContainerRef.current) {
      streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  // Compute stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<AuditCycleStage, number> = {
      orchestrator: 0,
      crew: 0,
      jules: 0,
      github: 0
    };
    logs.forEach((l) => {
      const st: AuditCycleStage = l.stage || (l.type === 'system' ? 'orchestrator' : 'crew');
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [logs]);

  // Unique actors present in logs + configured crew agents
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set('Flow Orchestrator', 'Flow Orchestrator');
    agents.forEach((a) => map.set(a.name, `${a.name} (Crew)`));
    map.set('Google Jules VM', 'Google Jules VM (Sandbox)');
    map.set('GitHub PR Gatekeeper', 'GitHub PR Gatekeeper');
    logs.forEach((l) => {
      if (l.agentName && !map.has(l.agentName)) {
        map.set(l.agentName, l.agentName);
      }
    });
    return Array.from(map.entries());
  }, [agents, logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const effectiveStage: AuditCycleStage =
        log.stage || (log.type === 'system' ? 'orchestrator' : 'crew');

      if (stageFilter !== 'all' && effectiveStage !== stageFilter) return false;
      if (actorFilter !== 'all' && (log.agentName || 'Flow Orchestrator') !== actorFilter) {
        return false;
      }
      if (typeFilter !== 'all') {
        if (typeFilter === 'jules_events') {
          if (log.type !== 'jules_vm' && log.type !== 'jules_heal' && effectiveStage !== 'jules') {
            return false;
          }
        } else if (typeFilter === 'warnings_heals') {
          if (log.severity !== 'warn' && log.severity !== 'error' && log.type !== 'jules_heal') {
            return false;
          }
        } else if (log.type !== typeFilter) {
          return false;
        }
      }

      if (!q) return true;
      const haystacks = [
        log.title,
        log.content,
        log.agentName || '',
        log.traceId || '',
        log.spanId || '',
        effectiveStage,
        log.type,
        log.meta?.toolName || '',
        log.meta?.model || '',
        log.meta?.keySlot || '',
        log.meta?.branch || '',
        log.meta?.repairedFault || '',
        log.meta?.prNumber ? `pr #${log.meta.prNumber}` : ''
      ];
      return haystacks.some((h) => h.toLowerCase().includes(q));
    });
  }, [logs, searchQuery, stageFilter, actorFilter, typeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySingleLog = (log: ExecutionLog, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 1800);
  };

  const handleCopyFilteredStream = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${(l.stage || 'crew').toUpperCase()}] [${l.traceId || 'tr-live'}] [${
            l.agentName || 'Orchestrator'
          }] ${l.title}\n${l.content}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
  };

  const handleExportJsonl = () => {
    const jsonl = filteredLogs.map((l) => JSON.stringify(l)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crew_jules_audit_stream_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderLogIcon = (log: ExecutionLog) => {
    if (log.type === 'jules_heal') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (log.type === 'jules_vm' || log.stage === 'jules') return <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (log.type === 'github_pr' || log.stage === 'github') return <GitPullRequest className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (log.type === 'tool_call' || log.type === 'tool_result') return <Wrench className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />;
    if (log.type === 'delegation') return <GitBranch className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (log.type === 'task_complete') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (log.type === 'thought') return <Cpu className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />;
    return <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#EB6658]/15 border border-[#EB6658]/30 text-[#EB6658]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Structured Audit Log Stream</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                {filteredLogs.length}/{logs.length} events
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Correlated telemetry across Orchestrator, Crew Agents, Google Jules VM & GitHub PR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCycleGuide((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 ${
              showCycleGuide
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="View the streamlined 4-stage Orchestrator → Crew → Jules → GitHub PR architecture"
          >
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>4-Stage Cycle Blueprint</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] text-amber-300 transition font-semibold"
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({executionHistoryCount})</span>
          </button>

          <CardMinMaxButtons
            isMinimized={isMinimized}
            onMinimize={() => setIsMinimized(true)}
            onExpand={() => setIsMinimized(false)}
            title="Structured Audit Log Stream"
            className="ml-auto"
          />
        </div>
      </div>

      {!isMinimized && (
        <>
      {/* Streamlined 4-Stage Cycle Stepper (Orchestrator -> Crew -> Jules -> GitHub PR) */}
      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Non-Convoluted Autonomous Loop (Click a stage to filter logs)</span>
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fullCycleEnabled}
              onChange={(e) => onToggleFullCycle(e.target.checked)}
              className="rounded border-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-blue-300 font-medium">Auto-Chain Jules VM + GitHub PR</span>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['orchestrator', 'crew', 'jules', 'github'] as AuditCycleStage[]).map((stageKey, idx) => {
            const meta = STAGE_META[stageKey];
            const isSelected = stageFilter === stageKey;
            const isStageRunning = isRunning && activeCycleStage === stageKey;
            const count = stageCounts[stageKey];

            return (
              <button
                key={stageKey}
                type="button"
                onClick={() => setStageFilter((prev) => (prev === stageKey ? 'all' : stageKey))}
                className={`p-2 rounded-lg border text-left transition relative overflow-hidden ${
                  isSelected
                    ? meta.activeBorderClass
                    : isStageRunning
                    ? 'border-amber-400/60 bg-amber-500/10'
                    : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-bold text-white flex items-center gap-1.5 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isStageRunning ? 'bg-amber-300 animate-ping' : meta.dotClass
                      }`}
                    />
                    <span className="truncate">{meta.label}</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {count}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{meta.roleSummary}</p>
                {idx < 3 && (
                  <ArrowRight className="w-2.5 h-2.5 text-slate-600 absolute right-1 bottom-1 hidden sm:block" />
                )}
              </button>
            );
          })}
        </div>

        {/* Collapsible Reassessed Architecture Guide */}
        {showCycleGuide && (
          <div className="p-3 rounded-lg bg-slate-900/90 border border-blue-500/30 text-[11px] space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-300">
                Reassessed Google Jules Architecture — Zero Overlap, Single Responsibility per Stage
              </span>
              <button
                type="button"
                onClick={() => setShowCycleGuide(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Instead of treating <strong>Google Jules</strong> as another conversational agent inside the Crew (which creates circular prompts and convoluted state), the system enforces a <strong>strict 4-stage pipeline</strong>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="font-bold text-purple-300 block">1. Orchestrator (Flow & Quota Router)</span>
                Owns `@persist` checkpointing, webhook/cron triggers, and Gemini Free-Pool vs. Argon routing. Dispatches the Crew.
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="font-bold text-[#EB6658] block">2. Crew (Multi-Agent Synthesis)</span>
                Specialists research, collaborate, and emit a concrete artifact (`crew.py` / patch diff). Never pushes directly to `main`.
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="font-bold text-blue-300 block">3. Google Jules (Async Cloud VM Verifier)</span>
                Spins up an isolated Cloud VM, runs `pytest` + AST checks, and self-heals broken assertions in-place until `exitCode == 0`.
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-300 block">4. GitHub PR (Immutable Merge Gate)</span>
                Commits only verified green code to `jules/auto-*`, opens a PR with test coverage telemetry, and notifies Orchestrator.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kickoff Topic Input Bar */}
      <div>
        <label className="block text-xs text-slate-400 mb-1 font-medium">
          Input Topic Variable ({'{topic}'}) — Executes Full 4-Stage Audit Loop
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={runInput}
            onChange={(e) => onRunInputChange(e.target.value)}
            placeholder="e.g. Autonomous Multi-Agent Systems"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#EB6658]"
          />
          <button
            disabled={isRunning}
            onClick={onKickoff}
            className="px-4 py-2 bg-gradient-to-r from-[#EB6658] to-[#C94C3C] disabled:opacity-50 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-[#EB6658]/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Cycle...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Kickoff Cycle</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search & Multi-Faceted Audit Filters */}
      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs by keyword, traceId, tool, agent, branch, PR #..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 outline-none focus:border-[#EB6658]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Actor / Agent Selector */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[#EB6658]"
            title="Filter by active Crew Agent, Jules VM, Orchestrator, or GitHub PR"
          >
            <option value="all">All Actors ({actorOptions.length})</option>
            {actorOptions.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          {/* Event Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[#EB6658]"
            title="Filter by execution event category"
          >
            <option value="all">All Event Types</option>
            <option value="thought">Agent Reasoning (Thought)</option>
            <option value="tool_call">Tool Invocations</option>
            <option value="delegation">Agent Delegations</option>
            <option value="jules_events">Jules Cloud VM & PyTest</option>
            <option value="warnings_heals">Self-Healing & Fault Repairs</option>
            <option value="github_pr">GitHub Branch & PR</option>
          </select>
        </div>

        {/* Quick Filter Bar & Export Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/70 text-[10px]">
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-slate-500 mr-0.5" />
            {(['all', 'orchestrator', 'crew', 'jules', 'github'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStageFilter(st)}
                className={`px-2 py-0.5 rounded font-mono uppercase transition cursor-pointer ${
                  stageFilter === st
                    ? 'bg-[#EB6658] text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {st === 'all' ? `ALL (${logs.length})` : `${st} (${stageCounts[st]})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAutoScroll((v) => !v)}
              className={`px-2 py-0.5 rounded font-mono border transition ${
                autoScroll
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
              title="Toggle auto-scroll on new streaming events"
            >
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>

            {logs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyFilteredStream}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1 transition"
                  title="Copy filtered audit log stream"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportJsonl}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1 transition"
                  title="Download structured JSONL audit log"
                >
                  <Download className="w-2.5 h-2.5 text-blue-400" />
                  <span>JSONL</span>
                </button>
                <button
                  type="button"
                  onClick={onClearLogs}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-800 transition"
                  title="Clear current log view"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Structured Log Stream Window */}
      <div
        ref={streamContainerRef}
        className="h-96 overflow-y-auto rounded-xl bg-[#090D16] border border-slate-800 p-3 space-y-2 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4 space-y-3">
            <Terminal className="w-8 h-8 text-slate-700" />
            <div className="space-y-1 max-w-sm">
              <p className="text-xs text-slate-300 font-semibold">
                Structured Audit Log Stream Ready
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Click <strong>"Kickoff Cycle"</strong> to stream live events across Orchestrator, Crew Agents, Google Jules VM, and GitHub PR—or load a sample 4-stage audit trace to inspect immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadSampleCycleTrace}
              className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Load Sample 4-Stage Cycle Trace</span>
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4 space-y-2">
            <Search className="w-7 h-7 text-slate-700" />
            <p className="text-xs text-slate-400">No execution events match your current search or stage filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStageFilter('all');
                setActorFilter('all');
                setTypeFilter('all');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px]"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const effectiveStage: AuditCycleStage =
              log.stage || (log.type === 'system' ? 'orchestrator' : 'crew');
            const stageInfo = STAGE_META[effectiveStage];
            const severityInfo = SEVERITY_BADGE[log.severity || 'info'];
            const isExpanded = !!expandedLogIds[log.id];

            return (
              <div
                key={log.id}
                onClick={() => toggleExpand(log.id)}
                className={`p-2.5 rounded-lg border transition cursor-pointer ${
                  log.type === 'jules_heal' || log.severity === 'warn'
                    ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50'
                    : effectiveStage === 'jules'
                    ? 'bg-blue-950/15 border-blue-500/25 hover:border-blue-500/45'
                    : effectiveStage === 'github'
                    ? 'bg-emerald-950/15 border-emerald-500/25 hover:border-emerald-500/45'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Top Metadata Line */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                    )}
                    {renderLogIcon(log)}
                    <span className={`px-1.5 py-0.2 rounded border font-bold ${stageInfo.badgeClass}`}>
                      {stageInfo.shortLabel}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded border font-semibold ${severityInfo.className}`}>
                      {severityInfo.label}
                    </span>
                    <span className="text-slate-200 font-bold">
                      {log.agentName || 'Flow Orchestrator'}
                    </span>
                    {log.traceId && (
                      <span className="text-slate-500 font-mono">
                        {log.traceId}
                        {log.spanId ? `:${log.spanId}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{log.timestamp}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCopySingleLog(log, e)}
                      className="text-slate-500 hover:text-slate-200 p-0.5 rounded"
                      title="Copy structured event JSON"
                    >
                      {copiedLogId === log.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Code2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Event Title & Content */}
                <div className="pl-4 space-y-1">
                  <div className="text-[11px] font-bold text-white">{log.title}</div>
                  <div className="text-slate-300 text-[11px] font-sans leading-relaxed whitespace-pre-wrap">
                    {log.content}
                  </div>

                  {/* Compact Telemetry Chips */}
                  {log.meta && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                      {log.meta.model && (
                        <span className="text-indigo-300">Model: {log.meta.model.replace('gemini/', '')}</span>
                      )}
                      {log.meta.keySlot && <span className="text-emerald-300">Slot: {log.meta.keySlot}</span>}
                      {log.meta.toolName && <span className="text-[#EB6658]">Tool: {log.meta.toolName}</span>}
                      {log.meta.durationMs !== undefined && <span>Latency: {log.meta.durationMs}ms</span>}
                      {log.meta.tokens !== undefined && <span>Tokens: {log.meta.tokens}</span>}
                      {log.meta.coveragePct !== undefined && (
                        <span className="text-blue-300">Coverage: {log.meta.coveragePct}%</span>
                      )}
                      {log.meta.exitCode !== undefined && (
                        <span className={log.meta.exitCode === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          Exit: {log.meta.exitCode}
                        </span>
                      )}
                      {log.meta.branch && <span className="text-purple-300">Branch: {log.meta.branch}</span>}
                      {log.meta.prNumber && (
                        <span className="text-emerald-400 font-bold">PR #{log.meta.prNumber}</span>
                      )}
                    </div>
                  )}

                  {/* Expanded Structured JSON Audit Inspector */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1.5 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1">
                        <span>Structured OpenTelemetry / Audit Event Payload</span>
                        <span className="text-emerald-400">schema: crewai.audit.v2</span>
                      </div>
                      <pre className="overflow-x-auto text-[10px] leading-relaxed text-slate-300">
                        {JSON.stringify(
                          {
                            id: log.id,
                            timestamp: log.isoTimestamp || log.timestamp,
                            traceId: log.traceId || 'tr-autonomous-loop',
                            spanId: log.spanId || 'sp-01',
                            stage: effectiveStage,
                            severity: log.severity || 'info',
                            actor: log.agentName || 'Flow Orchestrator',
                            eventType: log.type,
                            title: log.title,
                            meta: log.meta || {}
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}
    </div>
  );
};
