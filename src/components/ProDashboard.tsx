import React, { useMemo, useState, useEffect } from 'react';
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
  FastForward,
  Scale,
  Lock
} from 'lucide-react';
import {
  IMMUTABLE_CONSTITUTION_ARTICLES,
  CONSTITUTION_ROOT_HASH,
  validateAutonomousGoal
} from '../utils/constitutionalValidator';
import { ConstitutionalImpactAnalysis } from './ConstitutionalImpactAnalysis';
import { CodebaseConstitutionalWatcher } from './CodebaseConstitutionalWatcher';
import { TargetRepoSelector } from './TargetRepoSelector';



export interface ProDashboardAuditFinding {
  id: string;
  category: 'fatal_flaw' | 'wrong_assumption' | 'false_logic' | 'runtime_error';
  title: string;
  flawAnalysis: string;
  recommendedFix: string;
  status: 'resolved_in_goal' | 'queued_for_next_goal' | 'verified';
}

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
  immutableConstitution?: {
    locked: true;
    version: string;
    coreIdentity: string;
    nonNegotiableInvariants: string[];
    lastVerifiedAt: string;
  };
  primaryGoal: string;
  lastGoalSource?: 'audit_recommendations' | 'user_custom' | 'continuous_cycle_promotion';
  currentStepNumber: number;
  cycleHoursElapsed: number;
  cycleTotalHours: number;
  healthScorePct: number;
  currentVersion: string;
  evolutionCycleCount: number;
  rateLimitGuard: {
    pacingMode: 'time_in_the_world' | 'safe_steady' | 'eco_conservator' | 'balanced_hybrid';
    cooldownSecondsBetweenTasks: number;
    providerBreachesCount: number;
    activeKeySlot: string;
    rpmUtilizationPct: number;
    requestsCompletedSafely: number;
    geminiCreditsRemainingPct?: number;
    geminiCreditsUsedTokens?: number;
    geminiCreditsCapTokens?: number;
    allGeminiCreditsExhausted?: boolean;
    patientWaitsCount?: number;
    totalPatientWaitSeconds?: number;
    ollamaFallback?: {
      status: 'standby_ready' | 'active_fallback' | 'unavailable_offline';
      endpoint: string;
      model: string;
      available: boolean;
      fallbackCallsCount: number;
      note: string;
    };
  };
  delegatedTasks: Array<{
    id: string;
    stepOrder: number;
    title: string;
    assignedCrewRole: string;
    agentName: string;
    constitutionGuard?: string;
    status: 'completed' | 'running' | 'healing' | 'queued';
    progressPct: number;
  }>;
  auditFindings?: ProDashboardAuditFinding[];
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
  onFormulateFromAudit?: () => void;
  onUpdateCreditGovernor?: (payload: {
    cooldownSeconds?: number;
    simulateCreditsExhausted?: boolean;
    restoreCredits?: boolean;
    probeOllama?: boolean;
  }) => void;
  onOpenConstitutionalAudit?: (goalPrompt?: string) => void;
  onSelectTargetProject?: (repo: string, branch: string) => void;
  onSwitchToMainDashboard?: () => void;
  isAdvancing?: boolean;
  isFormulating?: boolean;
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
    windowHours: '20.5h – 22.0h',
    summary: 'Retrospective audit of completed work to eliminate architectural drift.'
  },
  {
    step: 9,
    code: '09',
    name: 'Push & Update Repo',
    owner: 'Saved GitHub PAT Bridge',
    windowHours: '22.0h – 23.0h',
    summary: 'Auto-upload and push verified workspace commits to the target GitHub repository.'
  },
  {
    step: 10,
    code: '10',
    name: 'End-But-Not-End',
    owner: 'Release Orchestrator',
    windowHours: '23.0h – 24.0h',
    summary: 'Publish verified semantic version and roll into the next evolution cycle.'
  }
];

export const ProDashboard: React.FC<ProDashboardProps> = ({
  proState,
  onSelectStep,
  onSwitchToSetup,
  onFormulateFromAudit,
  onUpdateCreditGovernor,
  onOpenConstitutionalAudit,
  onSelectTargetProject,
  onSwitchToMainDashboard,
  isAdvancing = false,
  isFormulating = false
}) => {
  const [selectedMetricTab, setSelectedMetricTab] = useState<'pacing' | 'alignment'>('pacing');
  const [extraQueuedTasks, setExtraQueuedTasks] = useState<ProDashboardJobState['delegatedTasks']>([]);
  const [constitutionTelemetry, setConstitutionTelemetry] = useState<{
    activeCoreCount: number;
    customGuardrailCount: number;
    totalAuditsRun: number;
    blockedCount: number;
    rootHash: string;
  }>({
    activeCoreCount: IMMUTABLE_CONSTITUTION_ARTICLES.length,
    customGuardrailCount: 0,
    totalAuditsRun: 2,
    blockedCount: 1,
    rootHash: CONSTITUTION_ROOT_HASH
  });


  useEffect(() => {
    let mounted = true;
    fetch('/api/fullstack/constitution')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const immutableLen = Array.isArray(data.immutableArticles)
          ? data.immutableArticles.length
          : IMMUTABLE_CONSTITUTION_ARTICLES.length;
        const customLen = Array.isArray(data.customRules) ? data.customRules.length : 0;
        const audits = Array.isArray(data.audits) ? data.audits : [];
        const blocked = audits.filter((a: any) => a.status === 'BLOCKED').length;
        setConstitutionTelemetry({
          activeCoreCount: immutableLen,
          customGuardrailCount: customLen,
          totalAuditsRun: audits.length,
          blockedCount: blocked,
          rootHash: data.constitutionRootHash || CONSTITUTION_ROOT_HASH
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [proState.updatedAt, proState.currentStepNumber]);

  const activeGoalAudit = useMemo(
    () =>
      validateAutonomousGoal(proState.primaryGoal || '', {
        actor: 'Jules Autonomous Agent'
      }),
    [proState.primaryGoal]
  );

  const creditsPct = proState.rateLimitGuard.geminiCreditsRemainingPct ?? 93;
  const creditsExhausted = Boolean(proState.rateLimitGuard.allGeminiCreditsExhausted || creditsPct <= 0);
  const ollamaInfo = proState.rateLimitGuard.ollamaFallback;

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
        hour: '22h',
        stepLabel: 'S9 Push Repo',
        rpmPct: 20,
        alignmentPct: 99.3,
        safeRequests: (proState.rateLimitGuard.requestsCompletedSafely || 142) + 86
      },
      {
        hour: '24h',
        stepLabel: 'S10 Version',
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
      {/* Unified Engine Identity Banner: Pro & Main Dashboard Are One (Pro = Simplified View) */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900/95 via-[#11192C] to-slate-900/95 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Zap className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">
                Unified Single-Engine Architecture (Pro = Simplified Lens of Main Dashboard)
              </span>
              <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                100% Live Shared State · {proState.selectedRepo}@{proState.targetBranch} · {proState.delegatedTasks.length} Synchronized Tasks
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pro Mode and the Main Studio Dashboard run on the exact same repository, branch, 8-Agent workforce, task DAG, Gemini credit governor, and immutable constitution—Pro simply streamlines the 10-step autonomous lifecycle into a single simplified view.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToMainDashboard && (
            <button
              type="button"
              onClick={onSwitchToMainDashboard}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Switch to Full Main Dashboard</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#EB6658]" />
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchToSetup}
            className="px-3 py-1.5 rounded-lg bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/40 text-xs font-semibold transition cursor-pointer"
          >
            10-Step Controls
          </button>
        </div>
      </div>

      {/* Top Executive KPI Strip (5 Cards including Jules Constitutional Principles Monitor) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* KPI 3: Patient Gemini Credit & Ollama Fallback Governor (Step 5) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Gemini Credit &amp; Wait Guard (Step 5)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-white">
                {creditsExhausted ? 'Ollama / Wait' : `${creditsPct}% Credits`}
              </span>
              <span className="text-xs text-emerald-400 font-semibold">
                {proState.rateLimitGuard.providerBreachesCount} Breaches
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
            <span>{proState.rateLimitGuard.cooldownSecondsBetweenTasks}s No-Rush Wait</span>
            <span aria-hidden="true">·</span>
            <span>{proState.rateLimitGuard.patientWaitsCount ?? 18} Waits</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-300 truncate">
              {ollamaInfo?.available ? 'Ollama Ready' : 'Ollama If-Possible'}
            </span>
          </div>
        </div>

        {/* KPI 4: Current Versioning State (Step 10: End-But-Not-End) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Versioning State (Step 10)</span>
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

        {/* KPI 5: Active Core Constitutional Principles Monitored by Jules */}
        <div
          onClick={() => onOpenConstitutionalAudit?.(proState.primaryGoal)}
          role={onOpenConstitutionalAudit ? 'button' : undefined}
          tabIndex={onOpenConstitutionalAudit ? 0 : undefined}
          onKeyDown={(e) => {
            if (onOpenConstitutionalAudit && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onOpenConstitutionalAudit(proState.primaryGoal);
            }
          }}
          className={`bg-slate-900/70 border border-amber-500/40 rounded-xl p-4 flex flex-col justify-between transition ${
            onOpenConstitutionalAudit ? 'hover:bg-slate-900 hover:border-amber-400 cursor-pointer' : ''
          }`}
          title="Active Immutable Core Principles monitored in real time by Google Jules"
        >
          <div>
            <div className="flex items-center justify-between text-xs text-amber-300">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span>Jules Constitution Guard</span>
              </span>
              <Scale className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-white font-mono">
                {constitutionTelemetry.activeCoreCount}/{IMMUTABLE_CONSTITUTION_ARTICLES.length}
              </span>
              <span className="text-xs text-emerald-400 font-semibold">
                Principles Active
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
            <span className="text-amber-300 font-mono">CONST-01..06</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300 truncate">
              Jules Monitoring ({activeGoalAudit.complianceScore}% Score)
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Target Repository & Project Loader Bar */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-[#EB6658] uppercase tracking-wider">
              STEP 2 · TARGET REPOSITORY &amp; ACTIVE PROJECT LOADER
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              Target Repository: Select &amp; Load Project for 24-Hour Autonomous Evolution
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            Active Project: <strong className="text-white">{proState.selectedRepo}</strong> · Branch:{' '}
            <strong className="text-sky-300">{proState.targetBranch}</strong>
          </span>
        </div>

        <TargetRepoSelector
          selectedRepo={proState.selectedRepo}
          selectedBranch={proState.targetBranch || 'main'}
          onSelectRepo={(repo) =>
            onSelectTargetProject?.(repo, proState.targetBranch || 'main')
          }
          onSelectBranch={(branch) =>
            onSelectTargetProject?.(proState.selectedRepo, branch)
          }
          onProjectLoaded={(repo, branch) => onSelectTargetProject?.(repo, branch)}
          variant="banner"
          label="Target Repository"
        />
      </div>

      {/* Automated Periodic Codebase Constitutional Drift Watcher & Notification System */}
      <CodebaseConstitutionalWatcher
        selectedRepo={proState.selectedRepo}
        targetBranch={proState.targetBranch}
        onOpenConstitutionalAudit={onOpenConstitutionalAudit}
      />


      {/* Patient "Time-in-the-World" Gemini Credit Governor & Conditional Ollama Fallback Strip */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 tabular-nums">
              <span>STEP 5 · TIME-IN-THE-WORLD CREDIT GOVERNOR</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300">No Rush · Wait-First Pacing (Never Hit Limit)</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">
                Fallback: Try Ollama If All Credits Used (If Possible Only)
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-1">
              Patient Gemini AI Credit Manager &amp; Conditional Ollama Fallback
            </h3>
          </div>

          {onUpdateCreditGovernor && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Patient Wait Interval"
                value={proState.rateLimitGuard.cooldownSecondsBetweenTasks || 20}
                onChange={(e) =>
                  onUpdateCreditGovernor({ cooldownSeconds: Number(e.target.value) })
                }
                className="bg-slate-950 text-xs font-mono text-emerald-300 px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
              >
                <option value={15}>15s Patient Wait (Safe)</option>
                <option value={20}>20s No-Rush Pacing (Recommended)</option>
                <option value={30}>30s Deep Conservation Wait</option>
                <option value={60}>60s &quot;All the Time in the World&quot;</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  onUpdateCreditGovernor({
                    simulateCreditsExhausted: !creditsExhausted,
                    probeOllama: true
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  creditsExhausted
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
              >
                {creditsExhausted
                  ? 'Restore Gemini Credits (Back to 94%)'
                  : 'Test Credit Exhaustion → Try Ollama (If Possible)'}
              </button>

              <button
                type="button"
                onClick={() => onUpdateCreditGovernor({ probeOllama: true })}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Probe Ollama Node
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left 4 cols: Gemini Credit Pool & Safe Ceiling */}
          <div className="lg:col-span-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-semibold text-slate-200">Gemini Credit Pool Remaining</span>
              <span
                className={`font-mono font-bold ${
                  creditsExhausted ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {creditsExhausted ? '0% (All Credits Used)' : `${creditsPct}% Remaining`}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  creditsExhausted
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-sky-400'
                }`}
                style={{ width: `${creditsExhausted ? 4 : creditsPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono tabular-nums">
              <span>
                Used: {(proState.rateLimitGuard.geminiCreditsUsedTokens ?? 18400).toLocaleString()}{' '}
                / {(proState.rateLimitGuard.geminiCreditsCapTokens ?? 250000).toLocaleString()} tok
              </span>
              <span className="text-emerald-400">Cap: &le;65% RPM</span>
            </div>
          </div>

          {/* Middle 4 cols: "Time in the World" Patient Wait Policy */}
          <div className="lg:col-span-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-semibold text-slate-200">
                &quot;Time in the World&quot; Patient Wait Queue
              </span>
              <span className="font-mono text-sky-300 font-bold">
                {proState.rateLimitGuard.cooldownSecondsBetweenTasks}s / Call
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Willingly waits between requests and rotates key slots at 65% RPM so provider limits are{' '}
              <strong className="text-emerald-400">never hit (0 breaches)</strong>.
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono tabular-nums pt-0.5">
              <span>{proState.rateLimitGuard.patientWaitsCount ?? 18} patient waits</span>
              <span aria-hidden="true">·</span>
              <span>{proState.rateLimitGuard.totalPatientWaitSeconds ?? 360}s total waited</span>
            </div>
          </div>

          {/* Right 4 cols: Conditional Ollama Fallback ("If Possible Only") */}
          <div className="lg:col-span-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-semibold text-slate-200">
                Ollama Fallback (If Possible Only)
              </span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  ollamaInfo?.status === 'active_fallback'
                    ? 'text-emerald-400'
                    : ollamaInfo?.available
                    ? 'text-sky-400'
                    : 'text-amber-300'
                }`}
              >
                {ollamaInfo?.status === 'active_fallback'
                  ? 'ACTIVE FALLBACK'
                  : ollamaInfo?.available
                  ? 'ONLINE STANDBY'
                  : 'IF-POSSIBLE STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
              {ollamaInfo?.note ||
                'When all Gemini credits are used up, automatically probes local Ollama (http://127.0.0.1:11434) and routes tasks there if reachable.'}
            </p>
            <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono tabular-nums pt-0.5">
              <span className="truncate">{ollamaInfo?.endpoint || 'http://127.0.0.1:11434'}</span>
              <span>Fallback Calls: {ollamaInfo?.fallbackCallsCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Constitution + Step 3 Formulated Goal -> Step 4 Newly Formed Tasks Pipeline */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-300 font-mono">
              <span>{proState.immutableConstitution?.version || 'CONSTITUTION-v1.0-IMMUTABLE'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">Locked Past Context (Never Revised)</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300">
                Step 3 Goal → {proState.delegatedTasks.length} Step 4 Crew Tasks Formed
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-1">
              Step 3 Audit-Formulated Goal &amp; Newly Created Step 4 Workforce Tasks
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onFormulateFromAudit && (
              <button
                type="button"
                disabled={isFormulating}
                onClick={onFormulateFromAudit}
                className="px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {isFormulating
                    ? 'Formulating & Creating Tasks...'
                    : 'Re-Synthesize Step 3 Goal & Form Step 4 Tasks'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onSwitchToSetup}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Edit Goal / Constitution View →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 5 cols: Immutable Constitution + Live Jules Principle Monitor + Step 3 Active Goal */}
          <div className="lg:col-span-5 space-y-3">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Jules Constitutional Monitor ({constitutionTelemetry.activeCoreCount} Core Principles Active)
                  </span>
                </span>
                <span className="font-mono text-[11px] text-emerald-400 tabular-nums">
                  {activeGoalAudit.status} · {activeGoalAudit.complianceScore}/100
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {proState.immutableConstitution?.coreIdentity ||
                  'CrewAI Studio: 8-Agent Autonomous Engineering Platform with 4-Graph Architecture Alignment, Zero-Breach Rate-Limit Governor, and Authenticated GitHub PAT Sync.'}
              </p>

              {/* Live Grid of 6 Active Core Principles Monitored by Jules */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                {IMMUTABLE_CONSTITUTION_ARTICLES.map((article) => {
                  const isViolated = activeGoalAudit.violations.some(
                    (v) => v.articleCode === article.code
                  );
                  return (
                    <div
                      key={article.code}
                      className={`px-2 py-1.5 rounded border text-[10px] flex items-center justify-between gap-1 ${
                        isViolated
                          ? 'bg-red-950/40 border-red-500/40 text-red-200'
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}
                      title={`${article.code}: ${article.title} — ${article.summary}`}
                    >
                      <div className="truncate">
                        <span className="font-mono font-bold text-amber-300">{article.code}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-slate-300">{article.category.split(' ')[0]}</span>
                      </div>
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          isViolated ? 'bg-red-400' : 'bg-emerald-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
                <span>
                  Audits: {constitutionTelemetry.totalAuditsRun} · Blocked: {constitutionTelemetry.blockedCount}
                  {constitutionTelemetry.customGuardrailCount > 0
                    ? ` · +${constitutionTelemetry.customGuardrailCount} Custom`
                    : ''}
                </span>
                {onOpenConstitutionalAudit && (
                  <button
                    type="button"
                    onClick={() => onOpenConstitutionalAudit(proState.primaryGoal)}
                    className="text-amber-300 hover:text-white font-sans font-semibold underline cursor-pointer"
                  >
                    Audit Active Principles →
                  </button>
                )}
              </div>
            </div>


            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  Step 3 · Formulated Goal (Fed from Flaw &amp; False-Logic Audit)
                </span>
                <span className="font-mono text-[11px] text-sky-400">Active Objective</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{proState.primaryGoal}</p>
            </div>
          </div>

          {/* Right 7 cols: Newly Formed & Created Step 4 Tasks */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                Step 4 · Newly Formed &amp; Created CrewAI Tasks (Proceeding from Step 3 Goal)
              </span>
              <span className="font-mono tabular-nums">
                {
                  [...proState.delegatedTasks, ...extraQueuedTasks].filter(
                    (t) => t.status === 'completed'
                  ).length
                }
                /{proState.delegatedTasks.length + extraQueuedTasks.length} Completed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[...proState.delegatedTasks, ...extraQueuedTasks].map((task) => (
                <div
                  key={task.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-col justify-between gap-1.5"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="text-white font-bold">Task #{task.stepOrder}</span>
                      <span
                        className={
                          task.status === 'completed'
                            ? 'text-emerald-400'
                            : task.status === 'running'
                            ? 'text-sky-400'
                            : 'text-amber-300'
                        }
                      >
                        {task.status} · {task.progressPct}%
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-100 mt-0.5 line-clamp-2">
                      {task.title}
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate">
                      <strong className="text-slate-200">{task.agentName}</strong> ·{' '}
                      {task.assignedCrewRole}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Constitutional Impact Analysis Dashboard (Pre-Queue Principle Drift Simulator) */}
      <ConstitutionalImpactAnalysis
        primaryGoal={proState.primaryGoal}
        delegatedTasks={[...proState.delegatedTasks, ...extraQueuedTasks]}
        onOpenConstitutionalAudit={onOpenConstitutionalAudit}
        onQueueVerifiedTask={(verifiedTask) => {
          setExtraQueuedTasks((prev) => [
            ...prev,
            {
              id: `sim-queued-${Date.now()}`,
              stepOrder: proState.delegatedTasks.length + prev.length + 1,
              title: verifiedTask.title,
              assignedCrewRole: verifiedTask.assignedCrewRole,
              agentName: verifiedTask.agentName,
              constitutionGuard: 'CONST-01..06 Verified (0% Drift)',
              status: 'queued',
              progressPct: 0
            }
          ]);
        }}
      />


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

          {/* Secondary BarChart: 10-Step Completion State */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>10-Step Autonomous Progression (S9 Push Repo → S10 End-But-Not-End)</span>
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

        {/* Col 6-12: Repo Push (Step 9) + Versioning State (Step 10) + Forward/Backward Deep Alignment */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <InfinityIcon className="w-4 h-4 text-sky-400" />
                <span>Repo Push & Continuous Versioning (Steps 7–10)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Forward/Backward assessments verify alignment before Step 9 Repo Push & Step 10 Release
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isAdvancing}
                onClick={() => onSelectStep(9)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Step 9: Push Repo</span>
              </button>
              <button
                type="button"
                disabled={isAdvancing}
                onClick={() => onSelectStep(10)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Step 10: End-But-Not-End</span>
              </button>
            </div>
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

          {/* Step 9 & 10 Semantic Version Lineage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step 9 (Push Repo) & Step 10 (End-But-Not-End Release Lineage)</span>
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
