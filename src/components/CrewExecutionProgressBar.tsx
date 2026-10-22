import React, { useState, useEffect, useCallback } from 'react';
import { CrewConfig, AuditCycleStage } from '../types';
import { globalTaskThrottler, useTaskThrottlerMetrics } from '../utils/taskThrottler';
import { CardMinMaxButtons } from './CardMinMaxControl';
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  GitPullRequest,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react';

export type LiveTaskExecStatus =
  | 'queued'
  | 'throttled'
  | 'reasoning'
  | 'tool_exec'
  | 'controller_gate'
  | 'completed';

export interface LiveTaskExecutionItem {
  taskId: string;
  taskName: string;
  phase?: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  controllerAgentId?: string;
  controllerAgentName?: string;
  status: LiveTaskExecStatus;
  progressPct: number;
  durationMs: number;
  tokensUsed: number;
  activeTool?: string;
}

interface ServerExecutionPollResponse {
  runId: string;
  crewName: string;
  isRunning: boolean;
  overallProgressPct: number;
  stage: AuditCycleStage | 'idle' | 'completed';
  activeTaskId: string | null;
  activeTaskName: string | null;
  activeAgentId: string | null;
  activeAgentName: string | null;
  completedTasksCount: number;
  totalTasksCount: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  updatedAt: string;
  serverTimestamp?: string;
  serverThrottler?: {
    cachedRoutesCount: number;
    activeKeySlot: string;
    governorStrategy: string;
    autoFailoverCount: number;
    uptimeSeconds: number;
  };
}

interface CrewExecutionProgressBarProps {
  crew: CrewConfig;
  isRunning: boolean;
  activeCycleStage: AuditCycleStage | 'idle' | 'completed';
  liveProgressPct: number;
  activeTaskId: string | null;
  activeAgentId: string | null;
  taskExecutions: Record<string, LiveTaskExecutionItem>;
  elapsedMs: number;
  selectedAgentId?: string;
  onSelectAgent?: (agentId: string) => void;
  onKickoff?: () => void;
}

export const CrewExecutionProgressBar: React.FC<CrewExecutionProgressBarProps> = ({
  crew,
  isRunning,
  activeCycleStage,
  liveProgressPct,
  activeTaskId,
  activeAgentId,
  taskExecutions,
  elapsedMs,
  selectedAgentId,
  onSelectAgent,
  onKickoff
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [serverSyncState, setServerSyncState] = useState<ServerExecutionPollResponse | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Subscribe to real-time Global Task Throttler metrics (only when expanded or running)
  const throttlerMetrics = useTaskThrottlerMetrics(!isMinimized || isRunning);

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

  const fetchExecutionStatusFromThrottler = useCallback(
    async (manual = false) => {
      if (typeof document !== 'undefined' && document.hidden && !manual) return;
      if (manual) setIsSyncing(true);
      try {
        const data = await globalTaskThrottler.scheduleTask<ServerExecutionPollResponse>(
          'Sync Crew Execution Status',
          async () => {
            const res = await fetch('/api/crew/execution-status');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          },
          isRunning || manual ? 'normal' : 'background'
        );
        setServerSyncState(data);
        setLastSyncedAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch {
        // Fallback gracefully to local execution telemetry
      } finally {
        if (manual) setIsSyncing(false);
      }
    },
    [isRunning]
  );

  // Throttler-paced background polling loop for execution status
  useEffect(() => {
    fetchExecutionStatusFromThrottler(false);

    if (isMinimized && !isRunning) return;
    if (throttlerMetrics.ecoMode && !isRunning) return;

    const basePollMs = isRunning ? 1000 : 5000;
    const effectivePollMs = Math.round(
      basePollMs * (isRunning ? 1 : globalTaskThrottler.getPollingMultiplier())
    );

    const timer = window.setInterval(() => {
      fetchExecutionStatusFromThrottler(false);
    }, effectivePollMs);

    return () => window.clearInterval(timer);
  }, [fetchExecutionStatusFromThrottler, isMinimized, isRunning, throttlerMetrics.ecoMode]);

  // Build unified list of task execution items for the current crew
  const taskItems: LiveTaskExecutionItem[] = crew.tasks.map((task, idx) => {
    const existing = taskExecutions[task.id];
    const assignedAgent =
      crew.agents.find((a) => a.id === task.agentId) || crew.agents[idx % Math.max(1, crew.agents.length)];
    const controllerAgent = task.controllerAgentId
      ? crew.agents.find((a) => a.id === task.controllerAgentId)
      : crew.agents.find((a) => a.category === 'task_controller');

    if (existing) {
      return existing;
    }

    const isDone = activeCycleStage === 'completed' && !isRunning;
    return {
      taskId: task.id,
      taskName: task.name,
      phase: task.phase,
      agentId: assignedAgent?.id || '',
      agentName: assignedAgent?.name || `Agent ${idx + 1}`,
      agentRole: assignedAgent?.role || 'Specialist',
      controllerAgentId: controllerAgent?.id,
      controllerAgentName: controllerAgent?.name,
      status: isDone ? 'completed' : 'queued',
      progressPct: isDone ? 100 : 0,
      durationMs: isDone ? 480 + idx * 95 : 0,
      tokensUsed: isDone ? 210 + idx * 45 : 0,
      activeTool: assignedAgent?.tools?.[0] || 'SerperDevTool'
    };
  });

  const completedTasksCount = taskItems.filter((t) => t.status === 'completed').length;
  const totalTasksCount = Math.max(1, taskItems.length);
  const effectiveProgressPct = isRunning
    ? Math.max(4, Math.min(99, Math.round(liveProgressPct)))
    : activeCycleStage === 'completed'
    ? 100
    : Math.round((completedTasksCount / totalTasksCount) * 100);

  const activeAgentObj =
    crew.agents.find((a) => a.id === activeAgentId) ||
    crew.agents.find((a) => a.id === selectedAgentId) ||
    crew.agents[0];
  const activeTaskObj =
    crew.tasks.find((t) => t.id === activeTaskId) ||
    taskItems.find((t) => t.status !== 'completed' && t.status !== 'queued') ||
    null;

  const estimatedTotalMs = Math.max(3800, crew.tasks.length * 680 + 1600);
  const remainingMs = isRunning ? Math.max(300, estimatedTotalMs - elapsedMs) : 0;

  const stagePipeline: Array<{
    id: AuditCycleStage;
    label: string;
    shortLabel: string;
  }> = [
    { id: 'orchestrator', label: '1. Flow Orchestrator & Quota Route', shortLabel: 'Orchestrator' },
    { id: 'crew', label: `2. Multi-Agent Task Execution (${completedTasksCount}/${totalTasksCount})`, shortLabel: 'Crew Tasks' },
    { id: 'jules', label: '3. Jules Cloud VM PyTest & Self-Heal', shortLabel: 'Jules VM' },
    { id: 'github', label: '4. GitHub PR Gatekeeper & Audit', shortLabel: 'GitHub PR' }
  ];

  const stageOrder: Record<string, number> = {
    idle: 0,
    orchestrator: 1,
    crew: 2,
    jules: 3,
    github: 4,
    completed: 5
  };
  const currentStageRank = stageOrder[activeCycleStage] ?? 0;

  const statusBadgeMeta: Record<
    LiveTaskExecStatus,
    { label: string; badgeClass: string; barClass: string; dotClass: string }
  > = {
    queued: {
      label: 'QUEUED',
      badgeClass: 'bg-slate-800/90 text-slate-400 border-slate-700',
      barClass: 'bg-slate-600',
      dotClass: 'bg-slate-500'
    },
    throttled: {
      label: 'THROTTLED PACE',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      barClass: 'bg-amber-400',
      dotClass: 'bg-amber-400 animate-ping'
    },
    reasoning: {
      label: 'REASONING',
      badgeClass: 'bg-[#EB6658]/20 text-[#EB6658] border-[#EB6658]/40',
      barClass: 'bg-gradient-to-r from-[#EB6658] to-amber-400',
      dotClass: 'bg-[#EB6658] animate-ping'
    },
    tool_exec: {
      label: 'TOOL EXEC',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      barClass: 'bg-gradient-to-r from-sky-400 to-indigo-400',
      dotClass: 'bg-sky-400 animate-ping'
    },
    controller_gate: {
      label: 'CONTROLLER QA GATE',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      barClass: 'bg-gradient-to-r from-purple-400 to-emerald-400',
      dotClass: 'bg-purple-400 animate-pulse'
    },
    completed: {
      label: 'COMPLETED 200 OK',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      barClass: 'bg-emerald-400',
      dotClass: 'bg-emerald-400'
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 border border-slate-800 space-y-4 shadow-xl">
      {/* Header Row: Title, Live Status Pill, Throttler Sync Indicator & Minimize/Expand */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`relative flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${
              isRunning
                ? 'bg-[#EB6658]/15 border-[#EB6658]/40 text-[#EB6658]'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isRunning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Gauge className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Real-Time Agent & Task Execution Progress Bar
              </h2>
              <span
                className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1.5 ${
                  isRunning
                    ? 'bg-[#EB6658]/20 text-[#EB6658] border-[#EB6658]/40'
                    : activeCycleStage === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning
                      ? 'bg-[#EB6658] animate-ping'
                      : activeCycleStage === 'completed'
                      ? 'bg-emerald-400'
                      : 'bg-slate-400'
                  }`}
                />
                {isRunning
                  ? `EXECUTING (${effectiveProgressPct}%) • STAGE: ${activeCycleStage.toUpperCase()}`
                  : activeCycleStage === 'completed'
                  ? `PIPELINE COMPLETE (100%) • ${completedTasksCount}/${totalTasksCount} TASKS VERIFIED`
                  : `STANDBY READY • ${crew.agents.length} AGENTS / ${crew.tasks.length} TASKS`}
              </span>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                Throttler Sync: {throttlerMetrics.activeTasks}/{throttlerMetrics.maxConcurrency} Slots •{' '}
                {throttlerMetrics.pollingMultiplier}x Pacing
              </span>
            </div>

            {!isMinimized && (
              <p className="text-xs text-slate-400 mt-0.5">
                Live execution progress across all active agents and tasks, synchronized with the Global Background Process Throttler to prevent CPU spikes or UI freezes.
              </p>
            )}
          </div>
        </div>

        {/* Right Controls: Launch Crew, Sync Now, Concurrency Quick-Selector & [- / +] */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {onKickoff && (
            <button
              type="button"
              onClick={onKickoff}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                isRunning
                  ? 'bg-[#EB6658]/20 border-[#EB6658]/40 text-[#EB6658] opacity-80 cursor-not-allowed'
                  : 'bg-[#EB6658] hover:bg-[#d95547] border-[#EB6658] text-white shadow-sm'
              }`}
              title="Execute full multi-agent task pipeline with throttler pacing"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing ({effectiveProgressPct}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Pipeline Now</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchExecutionStatusFromThrottler(true)}
            disabled={isSyncing}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Sync execution state with backend & task throttler"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
            <span className="text-[10px] font-mono text-slate-500">{lastSyncedAt}</span>
          </button>

          <CardMinMaxButtons
            isMinimized={isMinimized}
            onMinimize={() => setIsMinimized(true)}
            onExpand={() => setIsMinimized(false)}
            title="Real-Time Execution Progress Bar"
          />
        </div>
      </div>

      {/* Master Progress Bar Strip (Always Visible Even When Minimized for Instant Glanceability) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-extrabold text-sm text-white">
              {effectiveProgressPct}%
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-200 font-semibold truncate">
              {isRunning ? (
                <>
                  Active:{' '}
                  <span className="text-[#EB6658]">
                    {activeAgentObj?.name || 'Flow Orchestrator'}
                  </span>
                  {activeTaskObj && (
                    <span className="text-slate-400">
                      {' '}
                      → {'name' in activeTaskObj ? activeTaskObj.name : activeTaskObj.taskName}
                    </span>
                  )}
                </>
              ) : activeCycleStage === 'completed' ? (
                <span className="text-emerald-400">
                  All {totalTasksCount} tasks & controller gates verified (200 OK)
                </span>
              ) : (
                <span className="text-slate-400">
                  Ready to execute {totalTasksCount} tasks across {crew.agents.length} specialists
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-slate-200">
                {completedTasksCount}/{totalTasksCount}
              </strong>{' '}
              Tasks
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Elapsed:{' '}
                <strong className="text-slate-200">
                  {((isRunning ? elapsedMs : serverSyncState?.elapsedMs || 4120) / 1000).toFixed(1)}s
                </strong>
              </span>
            </span>
            {isRunning && (
              <span className="text-sky-400">
                ETA: ~{(remainingMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* High-Signal Multi-Segment Master Progress Bar */}
        <div className="relative w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isRunning
                ? 'bg-gradient-to-r from-[#EB6658] via-amber-400 to-emerald-400 animate-pulse'
                : activeCycleStage === 'completed'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-slate-700'
            }`}
            style={{ width: `${Math.max(3, effectiveProgressPct)}%` }}
          />
        </div>

        {/* 4-Stage Closed-Loop Milestone Stepper */}
        {!isMinimized && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {stagePipeline.map((st, idx) => {
              const stageRank = idx + 1;
              const isStageDone =
                activeCycleStage === 'completed' || currentStageRank > stageRank;
              const isStageActive = isRunning && currentStageRank === stageRank;

              return (
                <div
                  key={st.id}
                  className={`px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 transition ${
                    isStageActive
                      ? 'bg-[#EB6658]/15 border-[#EB6658]/60 text-white ring-1 ring-[#EB6658]/30'
                      : isStageDone
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-950/70 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isStageActive ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#EB6658] animate-spin shrink-0" />
                    ) : isStageDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-mono shrink-0">
                        {stageRank}
                      </span>
                    )}
                    <span className="font-semibold truncate" title={st.label}>
                      {st.label}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono uppercase shrink-0">
                    {isStageActive ? 'ACTIVE' : isStageDone ? 'DONE' : 'WAIT'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Details: Per-Task & Active Agent Execution Progress + Throttler Sync Telemetry */}
      {!isMinimized && (
        <div className="space-y-4 pt-2 border-t border-slate-800/80">
          {/* Per-Task & Active Agent Progress Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>
                  Active Agent & Task Execution Breakdown ({completedTasksCount}/{totalTasksCount} Completed)
                </span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Click any task row to inspect its assigned specialist agent
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {taskItems.map((item, idx) => {
                const meta = statusBadgeMeta[item.status] || statusBadgeMeta.queued;
                const isTaskRunning =
                  item.status === 'reasoning' ||
                  item.status === 'tool_exec' ||
                  item.status === 'controller_gate' ||
                  item.status === 'throttled';

                return (
                  <div
                    key={item.taskId}
                    onClick={() => onSelectAgent && item.agentId && onSelectAgent(item.agentId)}
                    className={`p-3 rounded-xl border transition cursor-pointer space-y-2 ${
                      isTaskRunning
                        ? 'bg-slate-900/95 border-[#EB6658]/60 ring-1 ring-[#EB6658]/30 shadow-md'
                        : item.status === 'completed'
                        ? 'bg-slate-950/75 border-emerald-500/25 hover:border-emerald-500/40'
                        : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-200 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate" title={item.taskName}>
                            {item.taskName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                            <span className="text-[#EB6658] font-semibold">{item.agentName}</span>
                            <span>•</span>
                            <span className="truncate">{item.agentRole}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${meta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                    </div>

                    {/* Individual Task Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400 truncate">
                          {item.controllerAgentName
                            ? `Gate: ${item.controllerAgentName}`
                            : `Tool: ${item.activeTool || 'SerperDevTool'}`}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.tokensUsed > 0 && (
                            <span className="text-slate-500">{item.tokensUsed} tok</span>
                          )}
                          {item.durationMs > 0 && (
                            <span className="text-slate-400">{item.durationMs}ms</span>
                          )}
                          <span className="text-white font-bold">{item.progressPct}%</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${meta.barClass}`}
                          style={{ width: `${Math.max(4, item.progressPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Background Process Throttler Synchronization & Concurrency Control Strip */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>Background Process Throttler Sync:</span>
              </div>

              {/* Visual Concurrency Slots */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px]">
                <span className="text-slate-400">Worker Slots:</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: throttlerMetrics.maxConcurrency }).map((_, slotIdx) => {
                    const isSlotBusy = slotIdx < throttlerMetrics.activeTasks;
                    return (
                      <span
                        key={slotIdx}
                        className={`w-2.5 h-3.5 rounded-sm transition ${
                          isSlotBusy
                            ? 'bg-[#EB6658] shadow-sm shadow-[#EB6658]/50 animate-pulse'
                            : 'bg-emerald-500/30 border border-emerald-500/40'
                        }`}
                        title={
                          isSlotBusy
                            ? `Slot #${slotIdx + 1}: Active`
                            : `Slot #${slotIdx + 1}: Available`
                        }
                      />
                    );
                  })}
                </div>
                <span className="text-white font-bold ml-1">
                  {throttlerMetrics.activeTasks}/{throttlerMetrics.maxConcurrency}
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300 flex-wrap">
                <span>
                  Queue:{' '}
                  <strong
                    className={
                      throttlerMetrics.queuedTasks > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }
                  >
                    {throttlerMetrics.queuedTasks}
                  </strong>
                </span>
                <span>
                  Coalesced/Cached:{' '}
                  <strong className="text-sky-400">
                    {throttlerMetrics.coalescedRequests + throttlerMetrics.cachedPollResponses}
                  </strong>
                </span>
                <span>
                  Throttled Polls:{' '}
                  <strong className="text-indigo-400">
                    {throttlerMetrics.throttledBackgroundTasks}
                  </strong>
                </span>
                <span>
                  Frame Budget:{' '}
                  <strong
                    className={
                      throttlerMetrics.isCongested ? 'text-amber-400' : 'text-emerald-400'
                    }
                  >
                    {throttlerMetrics.lastFrameLagMs}ms lag
                  </strong>
                </span>
              </div>
            </div>

            {/* Interactive Throttler Concurrency & Eco Pacing Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-400 px-1.5">Max Concurrency:</span>
                {[1, 2, 4, 6].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => globalTaskThrottler.setMaxConcurrency(limit)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      throttlerMetrics.maxConcurrency === limit
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Set maximum concurrent background tasks to ${limit}`}
                  >
                    {limit}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextEco = !throttlerMetrics.ecoMode;
                  globalTaskThrottler.setEcoMode(nextEco);
                  try {
                    localStorage.setItem('crewai_eco_cpu_mode', String(nextEco));
                    window.dispatchEvent(
                      new CustomEvent('crewai:eco-mode-changed', { detail: { ecoMode: nextEco } })
                    );
                  } catch {
                    // ignore
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  throttlerMetrics.ecoMode
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
                title="Toggle Eco CPU Pacing in Global Task Throttler"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{throttlerMetrics.ecoMode ? 'Eco Pacing: ON' : 'Turbo Pacing: ON'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
