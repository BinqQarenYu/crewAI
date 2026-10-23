import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  ShieldCheck,
  Wrench,
  GitBranch,
  Compass,
  History,
  Infinity as InfinityIcon,
  Zap,
  Clock,
  ArrowUpRight,
  FastForward
} from 'lucide-react';

export interface ProDashboardJobState {
  jobId: string;
  isActive: boolean;
  isPaused: boolean;
  githubConnected: boolean;
  selectedRepo: string;
  targetBranch: string;
  branchPolicy: 'jules_autonomous_branch' | 'direct_main';
  maxHealAttempts: number;
  consecutiveFailures: number;
  primaryGoal: string;
  currentStepNumber: number;
  cycleHoursElapsed: number;
  cycleTotalHours: number;
  healthScorePct: number;
  currentVersion: string;
  evolutionCycleCount: number;
  rateLimitGuard: {
    pacingMode: 'safe_steady' | 'eco_conservator' | 'balanced_hybrid';
    cooldownSecondsBetweenTasks: number;
    providerBreachesCount: number;
    activeKeySlot: string;
    rpmUtilizationPct: number;
    requestsCompletedSafely: number;
  };
  delegatedTasks: Array<{
    id: string;
    stepOrder: number;
    title: string;
    assignedCrewRole: string;
    agentName: string;
    status: 'completed' | 'running' | 'healing' | 'queued';
    progressPct: number;
  }>;
  errorAndFixLedger: Array<{
    id: string;
    timestamp: string;
    modulePath: string;
    detectedError: string;
    formulatedFix: string;
    status: 'fixed_verified' | 'formulating' | 'monitoring';
    attemptNumber: number;
  }>;
  forwardAssessment: {
    lastEvaluatedAt: string;
    alignmentScorePct: number;
    upcomingBottlenecks: string[];
    nextHorizonActions: string[];
    summary: string;
  };
  backwardAssessment: {
    lastAuditedAt: string;
    retrospectiveScorePct: number;
    completedMilestonesVerified: number;
    driftCorrectionsApplied: string[];
    summary: string;
  };
  versionHistory: Array<{
    version: string;
    releasedAt: string;
    branch: string;
    highlights: string;
    testsPassed: string;
  }>;
  updatedAt: string;
}

interface ProDashboardProps {
  proState: ProDashboardJobState;
  onSelectStep: (stepNumber: number) => void;
  onSwitchToSetup: () => void;
  isAdvancing?: boolean;
}

const LIFECYCLE_STEPS_META = [
  {
    step: 1,
    code: '01',
    name: 'Connect GitHub',
    owner: 'OAuth / PAT Bridge',
    windowHours: '0.0h – 0.5h',
    summary: 'Verify repository permissions and sync AST metadata.'
  },
  {
    step: 2,
    code: '02',
    name: 'Select Project',
    owner: 'Workspace Router',
    windowHours: '0.5h – 1.0h',
    summary: 'Lock target repository and isolated jules/autonomous-* branch.'
  },
  {
    step: 3,
    code: '03',
    name: 'Formulate 24h Goal',
    owner: 'Elena Vance (Task Maker)',
    windowHours: '1.0h – 2.5h',
    summary: 'Synthesize primary objective into atomic 24-hour sprint contracts.'
  },
  {
    step: 4,
    code: '04',
    name: 'Delegate to Crews',
    owner: '8-Agent Workforce',
    windowHours: '2.5h – 6.0h',
    summary: 'Dispatch tasks across Research, UI/UX, Frontend, Backend, DB & SRE.'
  },
  {
    step: 5,
    code: '05',
    name: 'Slowly & Surely Finish',
    owner: 'Argon Quota Governor',
    windowHours: '6.0h – 14.0h',
    summary: 'Execute tasks with strict cooldowns and zero rate-limit breaches.'
  },
  {
    step: 6,
    code: '06 / 6.1',
    name: 'Find Errors & Formulate Fix',
    owner: 'Google Jules Cloud VM',
    windowHours: '14.0h – 18.0h',
    summary: 'Run PyTest & AST diagnostics and auto-synthesize verified patches.'
  },
  {
    step: 7,
    code: '07',
    name: 'Look Forward',
    owner: 'Marcus Sterling (Controller)',
    windowHours: '18.0h – 20.5h',
    summary: 'Deep proactive assessment aligned with the primary 24h goal.'
  },
  {
    step: 8,
    code: '08',
    name: 'Look Backward & Fix',
    owner: 'Sentinel-Sec Auditor',
    windowHours: '20.5h – 22.5h',
    summary: 'Retrospective audit of completed work to eliminate architectural drift.'
  },
  {
    step: 9,
    code: '09',
    name: 'End-But-Not-End',
    owner: 'Release Orchestrator',
    windowHours: '22.5h – 24.0h',
    summary: 'Publish verified semantic version and roll into the next evolution cycle.'
  }
];

export const ProDashboard: React.FC<ProDashboardProps> = ({
  proState,
  onSelectStep,
  onSwitchToSetup,
  isAdvancing = false
}) => {
  const [selectedMetricTab, setSelectedMetricTab] = useState<'pacing' | 'alignment'>('pacing');

  const activeStep = proState.currentStepNumber || 5;
  const cycleProgressPct = Math.min(
    100,
    Math.round(((proState.cycleHoursElapsed || 6.5) / (proState.cycleTotalHours || 24)) * 100)
  );

  // Build 24-hour trajectory dataset for the Recharts visualization
  const timelineChartData = useMemo(() => {
    const elapsed = proState.cycleHoursElapsed || 6.5;
    const baseRpm = proState.rateLimitGuard.rpmUtilizationPct || 28;
    const points = [
      { hour: '00h', stepLabel: 'S1-S2', rpmPct: 14, alignmentPct: 94.0, safeRequests: 12 },
      { hour: '03h', stepLabel: 'S3 Goal', rpmPct: 22, alignmentPct: 95.4, safeRequests: 38 },
      { hour: '06h', stepLabel: 'S4 Crew', rpmPct: baseRpm, alignmentPct: 96.8, safeRequests: 84 },
      {
        hour: '09h',
        stepLabel: 'S5 Paced',
        rpmPct: Math.min(48, baseRpm + 6),
        alignmentPct: 97.5,
        safeRequests: 126
      },
      {
        hour: '12h',
        stepLabel: 'S5 Paced',
        rpmPct: Math.min(45, baseRpm + 3),
        alignmentPct: 98.0,
        safeRequests: proState.rateLimitGuard.requestsCompletedSafely || 142
      },
      {
        hour: '15h',
        stepLabel: 'S6/6.1 Heal',
        rpmPct: 31,
        alignmentPct: proState.forwardAssessment.alignmentScorePct || 97.8,
        safeRequests: (proState.rateLimitGuard.requestsCompletedSafely || 142) + 28
      },
      {
        hour: '18h',
        stepLabel: 'S7 Forward',
        rpmPct: 26,
        alignmentPct: 98.7,
        safeRequests: (proState.rateLimitGuard.requestsCompletedSafely || 142) + 52
      },
      {
        hour: '21h',
        stepLabel: 'S8 Backward',
        rpmPct: 24,
        alignmentPct: proState.backwardAssessment.retrospectiveScorePct || 99.1,
        safeRequests: (proState.rateLimitGuard.requestsCompletedSafely || 142) + 74
      },
      {
        hour: '24h',
        stepLabel: 'S9 Version',
        rpmPct: 18,
        alignmentPct: 99.5,
        safeRequests: (proState.rateLimitGuard.requestsCompletedSafely || 142) + 96
      }
    ];
    return points.map((pt, idx) => ({
      ...pt,
      isCurrentHorizon: Math.abs(idx * 3 - elapsed) <= 1.8
    }));
  }, [
    proState.cycleHoursElapsed,
    proState.rateLimitGuard.rpmUtilizationPct,
    proState.rateLimitGuard.requestsCompletedSafely,
    proState.forwardAssessment.alignmentScorePct,
    proState.backwardAssessment.retrospectiveScorePct
  ]);

  // Step progress bar chart data for all 9 steps
  const stepCompletionBarData = useMemo(() => {
    return LIFECYCLE_STEPS_META.map((item) => {
      const completion =
        item.step < activeStep ? 100 : item.step === activeStep ? 68 : 12;
      return {
        name: `S${item.step === 6 ? '6/6.1' : item.step}`,
        fullTitle: item.name,
        stepNum: item.step,
        completion,
        status:
          item.step < activeStep
            ? 'Completed'
            : item.step === activeStep
            ? 'Active'
            : 'Scheduled'
      };
    });
  }, [activeStep]);

  const activeStepMeta =
    LIFECYCLE_STEPS_META.find((s) => s.step === activeStep) || LIFECYCLE_STEPS_META[4];

  const totalErrorsFound = proState.errorAndFixLedger.length;
  const verifiedFixesCount = proState.errorAndFixLedger.filter(
    (e) => e.status === 'fixed_verified'
  ).length;
  const selfHealSuccessRate =
    totalErrorsFound > 0 ? Math.round((verifiedFixesCount / totalErrorsFound) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 24-Hour Lifecycle Clock & Active Step */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>24-Hour Lifecycle Progress</span>
              <Clock className="w-4 h-4 text-[#EB6658]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-white">
                {proState.cycleHoursElapsed}h
              </span>
              <span className="text-xs text-slate-400">
                / {proState.cycleTotalHours}h ({cycleProgressPct}%)
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#EB6658] to-amber-400 transition-all duration-500"
                style={{ width: `${cycleProgressPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
              <span className="text-white font-semibold">Step {activeStepMeta.code}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{activeStepMeta.name}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Self-Healing Engine (Steps 6 & 6.1) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Self-Healing Status (6 / 6.1)</span>
              <Wrench className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-emerald-400">
                {selfHealSuccessRate}%
              </span>
              <span className="text-xs text-slate-400">
                ({verifiedFixesCount}/{totalErrorsFound} patched)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
            <span>Failures: {proState.consecutiveFailures}/{proState.maxHealAttempts} max</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300">Jules VM Active</span>
          </div>
        </div>

        {/* KPI 3: Rate-Limit Safety Governor (Step 5) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Rate-Limit Safety (Step 5)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-white">
                {proState.rateLimitGuard.providerBreachesCount} Breaches
              </span>
              <span className="text-xs text-emerald-400 font-semibold">100% Safe</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
            <span>{proState.rateLimitGuard.cooldownSecondsBetweenTasks}s Cooldown</span>
            <span aria-hidden="true">·</span>
            <span>{proState.rateLimitGuard.rpmUtilizationPct}% RPM</span>
            <span aria-hidden="true">·</span>
            <span>{proState.rateLimitGuard.requestsCompletedSafely} calls</span>
          </div>
        </div>

        {/* KPI 4: Current Versioning State (Step 9: End-But-Not-End) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Versioning State (Step 9)</span>
              <InfinityIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-sky-300 font-mono">
                {proState.currentVersion}
              </span>
              <span className="text-xs text-slate-400">
                Evolution Cycle #{proState.evolutionCycleCount}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 truncate font-mono">
            <GitBranch className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="text-slate-200 truncate">{proState.targetBranch}</span>
          </div>
        </div>
      </div>

      {/* Middle Row: 24-Hour Autonomous Lifecycle Visualizer + Active Step Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Recharts 24-Hour Lifecycle & Step Completion Visualization */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#EB6658]" />
                <span>24-Hour Autonomous Lifecycle Telemetry</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time rate-limit headroom and forward/backward goal alignment across the 24h cycle
              </p>
            </div>

            {/* Interactive Chart Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMetricTab('pacing')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                  selectedMetricTab === 'pacing'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Quota Pacing & RPM
              </button>
              <button
                type="button"
                onClick={() => setSelectedMetricTab('alignment')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                  selectedMetricTab === 'alignment'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Goal Alignment %
              </button>
            </div>
          </div>

          {/* Primary AreaChart */}
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedMetricTab === 'pacing' ? (
                <AreaChart
                  data={timelineChartData}
                  margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="proRpmGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="hour"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                      color: '#F8FAFC'
                    }}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Safety Ceiling (85% RPM)',
                      fill: '#FBBF24',
                      fontSize: 10,
                      position: 'insideTopRight'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rpmPct"
                    name="RPM Quota Utilization %"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#proRpmGradient)"
                  />
                </AreaChart>
              ) : (
                <AreaChart
                  data={timelineChartData}
                  margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="proAlignGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="hour"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[90, 100]}
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                      color: '#F8FAFC'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="alignmentPct"
                    name="Forward/Backward Goal Alignment %"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#proAlignGradient)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Secondary BarChart: 9-Step Completion State */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>9-Step Autonomous Progression</span>
              <span className="font-mono text-[11px] text-slate-300">
                Click any step on the right to inspect or trigger phase
              </span>
            </div>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stepCompletionBarData}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '11px',
                      color: '#F8FAFC'
                    }}
                  />
                  <Bar dataKey="completion" name="Step Completion %" radius={[4, 4, 0, 0]}>
                    {stepCompletionBarData.map((entry) => (
                      <Cell
                        key={`cell-${entry.stepNum}`}
                        fill={
                          entry.stepNum < activeStep
                            ? '#10B981'
                            : entry.stepNum === activeStep
                            ? '#EB6658'
                            : '#334155'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Interactive 9-Step Lifecycle Inspector */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-white">Active Lifecycle Step Matrix</h3>
              <p className="text-xs text-slate-400">
                Select any step to transition or inspect autonomous execution
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToSetup}
              className="text-xs font-semibold text-[#EB6658] hover:underline cursor-pointer"
            >
              Configure Steps 1–3 →
            </button>
          </div>

          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {LIFECYCLE_STEPS_META.map((item) => {
              const isCurrent = item.step === activeStep;
              const isDone = item.step < activeStep;
              return (
                <button
                  key={item.step}
                  type="button"
                  disabled={isAdvancing}
                  onClick={() => onSelectStep(item.step)}
                  className={`w-full p-2.5 rounded-lg border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#EB6658]/15 border-[#EB6658] text-white'
                      : isDone
                      ? 'bg-slate-950/90 border-emerald-500/25 text-slate-200 hover:border-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="font-mono text-[#EB6658]">{item.code}.</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {item.summary}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono tabular-nums">
                      <span>{item.owner}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.windowHours}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                    {isDone ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    ) : isCurrent ? (
                      <span className="text-[#EB6658] font-bold">Active</span>
                    ) : (
                      <span className="text-slate-500">Queued</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Self-Healing Diagnostic Monitor (6 & 6.1) + Forward/Backward Alignment + Versioning State (Step 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Col 1-5: Self-Healing Status Monitor (Steps 6 & 6.1) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>Self-Healing Engine (Steps 6 & 6.1)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated error detection (6) and verified AST/PyTest patch synthesis (6.1)
                </p>
              </div>
              <button
                type="button"
                disabled={isAdvancing}
                onClick={() => onSelectStep(6)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold transition cursor-pointer shrink-0"
              >
                Run Heal Pass
              </button>
            </div>

            {/* Self-healing ledger entries */}
            <div className="space-y-2.5">
              {proState.errorAndFixLedger.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="text-amber-300 font-semibold truncate">
                      {entry.modulePath}
                    </span>
                    <span className="tabular-nums">
                      Attempt {entry.attemptNumber}/{proState.maxHealAttempts} · {entry.timestamp}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-rose-400 font-semibold">Step 6 Error: </span>
                    {entry.detectedError}
                  </div>
                  <div className="text-slate-200">
                    <span className="text-emerald-400 font-semibold">Step 6.1 Fix: </span>
                    {entry.formulatedFix}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>Circuit Breaker: Halt after {proState.maxHealAttempts} consecutive fails</span>
            <span className="text-emerald-400 font-semibold">Status: Healthy</span>
          </div>
        </div>

        {/* Col 6-12: Versioning State (Step 9) + Forward/Backward Deep Alignment */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <InfinityIcon className="w-4 h-4 text-sky-400" />
                <span>Continuous Versioning & Goal Alignment (Steps 7, 8 & 9)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Forward/Backward assessments verify alignment before promoting each semantic release
              </p>
            </div>
            <button
              type="button"
              disabled={isAdvancing}
              onClick={() => onSelectStep(9)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Promote Next Version (Step 9)</span>
            </button>
          </div>

          {/* Forward (Step 7) & Backward (Step 8) Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  Step 7 · Look Forward
                </span>
                <span className="font-mono text-sky-300 font-bold tabular-nums">
                  {proState.forwardAssessment.alignmentScorePct}% Aligned
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {proState.forwardAssessment.summary}
              </p>
              <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="truncate">
                  {proState.forwardAssessment.nextHorizonActions[0]}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  Step 8 · Look Backward
                </span>
                <span className="font-mono text-purple-300 font-bold tabular-nums">
                  {proState.backwardAssessment.retrospectiveScorePct}% Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {proState.backwardAssessment.summary}
              </p>
              <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {proState.backwardAssessment.completedMilestonesVerified} milestones verified
                </span>
              </div>
            </div>
          </div>

          {/* Step 9 Semantic Version Lineage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step 9 · End-But-Not-End Release Lineage</span>
              <span className="font-mono text-slate-300 tabular-nums">
                Active Branch: {proState.targetBranch}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {proState.versionHistory.slice(0, 3).map((ver, idx) => (
                <div
                  key={`${ver.version}-${idx}`}
                  className={`p-3 rounded-lg border space-y-1 ${
                    idx === 0
                      ? 'bg-slate-950 border-[#EB6658]/60'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                    <span className="font-extrabold text-white">{ver.version}</span>
                    <span className="text-emerald-400 text-[11px]">{ver.testsPassed}</span>
                  </div>
                  <div className="text-[11px] font-mono text-sky-400 truncate">{ver.branch}</div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
                    {ver.highlights}
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono">{ver.releasedAt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
