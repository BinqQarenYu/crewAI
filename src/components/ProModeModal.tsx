import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Zap,
  GitBranch,
  CheckCircle2,
  ShieldCheck,
  Play,
  Pause,
  FastForward,
  Sparkles,
  AlertTriangle,
  Compass,
  History,
  Infinity as InfinityIcon,
  Users,
  Gauge,
  Wrench,
  RefreshCw,
  Key,
  Clock,
  ArrowUpRight,
  Layers,
  LayoutDashboard,
  Sliders,
  Scale,
  ShieldAlert
} from 'lucide-react';
import { CURATED_TARGET_REPOS } from '../utils/repoWorkforceMapping';
import { ProDashboard } from './ProDashboard';
import {
  evaluateConstitutionalRisk,
  type ConstitutionalRiskAssessment
} from '../utils/constitutionalValidator';


interface ProModeAuditFinding {
  id: string;
  category: 'fatal_flaw' | 'wrong_assumption' | 'false_logic' | 'runtime_error';
  title: string;
  flawAnalysis: string;
  recommendedFix: string;
  status: 'resolved_in_goal' | 'queued_for_next_goal' | 'verified';
}

interface ProModeJobState {
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
  auditFindings?: ProModeAuditFinding[];
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

interface ProModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRepo: string;
  selectedBranch: string;
  onRepoChange: (repo: string) => void;
  onBranchChange: (branch: string) => void;
  onOpenConstitutionalAudit?: (goalPrompt?: string) => void;
}


const NINE_STEPS = [
  {
    num: 1,
    short: 'Connect GitHub',
    title: '1. Connect to GitHub',
    desc: 'Authenticated PAT & repository access'
  },
  {
    num: 2,
    short: 'Select Project',
    title: '2. Select Target Project',
    desc: 'Repository & safe autonomous branch policy'
  },
  {
    num: 3,
    short: 'Formulate 24h Goal',
    title: '3. Formulate Goal & 24h Job',
    desc: 'Decompose objective into a 24-hour sprint'
  },
  {
    num: 4,
    short: 'Delegate to Crews',
    title: '4. Delegate Tasks to Crews',
    desc: 'Assign atomic tasks across 8-Agent Org'
  },
  {
    num: 5,
    short: 'Slowly & Surely',
    title: '5. Slowly & Surely Finish',
    desc: 'Paced execution with 0 rate-limit breaches'
  },
  {
    num: 6,
    short: 'Find & Fix (6 / 6.1)',
    title: '6 & 6.1. Find Errors & Formulate Fix',
    desc: 'Jules VM AST/PyTest self-healing loop'
  },
  {
    num: 7,
    short: 'Look Forward',
    title: '7. Look Forward Assessment',
    desc: 'Deep proactive horizon alignment to goal'
  },
  {
    num: 8,
    short: 'Look Backward',
    title: '8. Look Backward & Fix Drift',
    desc: 'Deep retrospective audit of completed work'
  },
  {
    num: 9,
    short: 'Push & Update Repo',
    title: '9. Push & Update Repo',
    desc: 'Auto-upload & push workspace via saved PAT'
  },
  {
    num: 10,
    short: 'End-But-Not-End',
    title: '10. End-But-Not-End (Versioning)',
    desc: 'Ship semantic version & evolve continuously'
  }
];

/**
 * Custom hook that automatically triggers a Constitutional Scan every time
 * a new autonomous 24-hour goal is formulated or modified on the job submission screen.
 */
function useProGoalConstitutionalScan(params: {
  isOpen: boolean;
  goalText: string;
  formulatedSignal: number;
  branchPolicy: 'jules_autonomous_branch' | 'direct_main';
  cooldownSeconds: number;
  targetRepo: string;
}) {
  const { isOpen, goalText, formulatedSignal, branchPolicy, cooldownSeconds, targetRepo } = params;
  const [scanCount, setScanCount] = useState<number>(1);
  const [lastScannedAt, setLastScannedAt] = useState<string>(() => new Date().toLocaleTimeString());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [riskAssessment, setRiskAssessment] = useState<ConstitutionalRiskAssessment>(() =>
    evaluateConstitutionalRisk(goalText, { branchPolicy, cooldownSeconds, targetRepo })
  );

  // Instant deterministic Constitutional Risk evaluation whenever goal or job parameters change
  useEffect(() => {
    if (!isOpen) return;
    const nextAssessment = evaluateConstitutionalRisk(goalText, {
      branchPolicy,
      cooldownSeconds,
      targetRepo
    });
    setRiskAssessment(nextAssessment);
  }, [isOpen, goalText, branchPolicy, cooldownSeconds, targetRepo]);

  // Automatic server-side SQLite constitutional audit trigger whenever a new 24-hour goal is formulated
  useEffect(() => {
    if (!isOpen || !goalText.trim()) return;
    let cancelled = false;
    setIsScanning(true);

    const nextAssessment = evaluateConstitutionalRisk(goalText, {
      branchPolicy,
      cooldownSeconds,
      targetRepo
    });
    setRiskAssessment(nextAssessment);

    fetch('/api/fullstack/constitution/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposedGoal: goalText,
        testCommand: 'pytest tests/ -v',
        targetPath: targetRepo,
        actor: 'Jules Autonomous Agent'
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(() => {
        if (cancelled) return;
        setScanCount((c) => c + 1);
        setLastScannedAt(new Date().toLocaleTimeString());
      })
      .catch(() => {
        if (!cancelled) {
          setScanCount((c) => c + 1);
          setLastScannedAt(new Date().toLocaleTimeString());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsScanning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formulatedSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerManualScan = useCallback(
    async (overrideGoal?: string) => {
      const targetGoal = overrideGoal ?? goalText;
      setIsScanning(true);
      const nextAssessment = evaluateConstitutionalRisk(targetGoal, {
        branchPolicy,
        cooldownSeconds,
        targetRepo
      });
      setRiskAssessment(nextAssessment);
      try {
        await fetch('/api/fullstack/constitution/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposedGoal: targetGoal,
            testCommand: 'pytest tests/ -v',
            targetPath: targetRepo,
            actor: 'Jules Autonomous Agent'
          })
        });
      } catch {
        // ignore network error
      } finally {
        setScanCount((c) => c + 1);
        setLastScannedAt(new Date().toLocaleTimeString());
        setIsScanning(false);
      }
      return nextAssessment;
    },
    [goalText, branchPolicy, cooldownSeconds, targetRepo]
  );

  return {
    riskAssessment,
    scanCount,
    lastScannedAt,
    isScanning,
    triggerManualScan
  };
}

export const ProModeModal: React.FC<ProModeModalProps> = ({

  isOpen,
  onClose,
  selectedRepo,
  onRepoChange,
  onBranchChange,
  onOpenConstitutionalAudit
}) => {

  const [proState, setProState] = useState<ProModeJobState | null>(null);
  const [goalInput, setGoalInput] = useState<string>('');
  const [repoInput, setRepoInput] = useState<string>(selectedRepo || 'bingkltech/crewAI');
  const [branchPolicy, setBranchPolicy] = useState<'jules_autonomous_branch' | 'direct_main'>(
    'jules_autonomous_branch'
  );
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(12);
  const [patInput, setPatInput] = useState<string>('');
  const [showPatInput, setShowPatInput] = useState<boolean>(false);
  const [isFormulating, setIsFormulating] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [autoCycleDemo, setAutoCycleDemo] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'dashboard' | 'setup'>('dashboard');
  const [formulatedSignal, setFormulatedSignal] = useState<number>(0);

  const {
    riskAssessment,
    scanCount: constitutionalScanCount,
    lastScannedAt: lastConstitutionalScanAt,
    isScanning: isScanningConstitution,
    triggerManualScan: triggerConstitutionalScan
  } = useProGoalConstitutionalScan({
    isOpen,
    goalText:
      goalInput ||
      proState?.primaryGoal ||
      'Use message_content_text(msg) from crewai.utilities.agent_utils to collapse multimodal LLMMessage.content safely and verify with pytest.',
    formulatedSignal,
    branchPolicy,
    cooldownSeconds,
    targetRepo: repoInput
  });

  const fetchProStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pro/status');
      if (res.ok) {
        const data: ProModeJobState = await res.json();
        setProState(data);
        setGoalInput((prev) => {
          if (!prev && data.primaryGoal) {
            setFormulatedSignal((s) => s + 1);
            return data.primaryGoal;
          }
          return prev || data.primaryGoal;
        });
        setBranchPolicy(data.branchPolicy);
        setCooldownSeconds(data.rateLimitGuard.cooldownSecondsBetweenTasks);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);


  useEffect(() => {
    if (isOpen) {
      fetchProStatus();
      setRepoInput(selectedRepo || 'bingkltech/crewAI');
    }
  }, [isOpen, selectedRepo, fetchProStatus]);

  useEffect(() => {
    if (!isOpen || !autoCycleDemo || proState?.isPaused) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/pro/advance-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (res.ok) {
          const data: ProModeJobState = await res.json();
          setProState(data);
          window.dispatchEvent(new CustomEvent('crewai:pro-status-updated', { detail: data }));
          if (data.currentStepNumber === 9) {
            window.dispatchEvent(new CustomEvent('crewai:push-entire-app'));
          }
        }
      } catch {
        // ignore
      }
    }, 4500);
    return () => clearInterval(timer);
  }, [isOpen, autoCycleDemo, proState?.isPaused]);

  if (!isOpen) return null;

  const handleConnectPat = async () => {
    if (!patInput.trim()) return;
    try {
      const res = await fetch('/api/github/connect-pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: patInput.trim() })
      });
      if (res.ok) {
        localStorage.setItem('crewai_github_token', patInput.trim());
        window.dispatchEvent(new Event('github-pat-updated'));
        setPatInput('');
        setShowPatInput(false);
        setStatusBanner('GitHub PAT verified and connected to Pro Mode Autopilot.');
        setTimeout(() => setStatusBanner(null), 3500);
        fetchProStatus();
      }
    } catch {
      // ignore
    }
  };

  const handleFormulateGoal = async (fromAuditRecommendations = false) => {
    setIsFormulating(true);
    try {
      const res = await fetch('/api/pro/formulate-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawGoal: goalInput,
          selectedRepo: repoInput,
          fromAuditRecommendations
        })
      });
      if (res.ok) {
        const data = await res.json();
        const nextGoal = data.formulatedGoal || goalInput;
        if (data.formulatedGoal) {
          setGoalInput(data.formulatedGoal);
        }
        if (data.state) {
          setProState(data.state);
          window.dispatchEvent(
            new CustomEvent('crewai:pro-status-updated', { detail: data.state })
          );
        }
        // Automatically trigger the Constitutional Scan hook for the newly formulated 24-hour goal
        setFormulatedSignal((s) => s + 1);
        const scanResult = evaluateConstitutionalRisk(nextGoal, {
          branchPolicy,
          cooldownSeconds,
          targetRepo: repoInput
        });
        const taskCount = data.tasksCreatedCount || data.state?.delegatedTasks?.length || 5;
        setStatusBanner(
          `Step 3 → Step 4: Formulated new 24h goal, auto-triggered Constitutional Scan (Risk Score: ${scanResult.riskScore}/100 · ${scanResult.riskTier}), and created ${taskCount} CrewAI tasks.`
        );
        setTimeout(() => setStatusBanner(null), 5000);
      }
    } finally {
      setIsFormulating(false);
    }
  };

  const handleStartOrUpdateAutopilot = async () => {
    // Pre-flight Constitutional Risk check before launching 24-hour autonomous job
    const latestScan = await triggerConstitutionalScan(goalInput);
    if (latestScan.auditReport.status === 'BLOCKED') {
      setStatusBanner(
        `Constitutional Guardrail Blocked 24h Job Submission (Risk Score: ${latestScan.riskScore}/100). Click "Auto-Remediate 24h Goal" below to resolve ${latestScan.auditReport.violations
          .map((v) => v.articleCode)
          .join(', ')} before launching.`
      );
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch('/api/pro/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedRepo: repoInput,
          primaryGoal: goalInput,
          branchPolicy,
          cooldownSeconds
        })
      });
      if (res.ok) {
        const data: ProModeJobState = await res.json();
        setProState(data);
        window.dispatchEvent(new CustomEvent('crewai:pro-status-updated', { detail: data }));
        onRepoChange(repoInput);
        if (branchPolicy === 'jules_autonomous_branch') {
          onBranchChange(data.targetBranch);
        }
        // Automatically use the previously connected GitHub PAT to upload & push workspace
        window.dispatchEvent(new CustomEvent('crewai:push-entire-app'));
        setStatusBanner(
          `24-Hour Pro Autopilot synchronized on ${repoInput} (${data.targetBranch}) with Constitutional Risk Score ${latestScan.riskScore}/100 (${latestScan.riskTier}).`
        );
        setTimeout(() => setStatusBanner(null), 4500);
      }
    } finally {
      setIsStarting(false);
    }
  };


  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/pro/toggle-pause', { method: 'POST' });
      if (res.ok) {
        const data: ProModeJobState = await res.json();
        setProState(data);
        window.dispatchEvent(new CustomEvent('crewai:pro-status-updated', { detail: data }));
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateCreditGovernor = async (payload: {
    cooldownSeconds?: number;
    simulateCreditsExhausted?: boolean;
    restoreCredits?: boolean;
    probeOllama?: boolean;
  }) => {
    try {
      if (typeof payload.cooldownSeconds === 'number') {
        setCooldownSeconds(payload.cooldownSeconds);
      }
      const res = await fetch('/api/pro/credit-governor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setProState(data.state);
          window.dispatchEvent(
            new CustomEvent('crewai:pro-status-updated', { detail: data.state })
          );
        }
        const fb = data.ollamaFallback || data.state?.rateLimitGuard?.ollamaFallback;
        if (payload.simulateCreditsExhausted === true) {
          setStatusBanner(
            fb?.available
              ? `All Gemini credits marked used → Automatically switched to Local Ollama (${fb.model} at ${fb.endpoint}) with 0 rate-limit breaches.`
              : `All Gemini credits marked used → Probed Ollama at ${fb?.endpoint || 'http://127.0.0.1:11434'} ("if possible only"). Ollama is currently offline, so waiting patiently with 0 breaches.`
          );
        } else if (payload.simulateCreditsExhausted === false || payload.restoreCredits) {
          setStatusBanner(
            'Gemini AI credit pool restored to 93% — "Time in the World" patient wait governor active (0 rate-limit breaches).'
          );
        } else if (payload.probeOllama) {
          setStatusBanner(
            fb?.available
              ? `Ollama node online at ${fb.endpoint} (${fb.model}) — Ready for conditional fallback if all Gemini credits are used.`
              : `Probed Ollama at ${fb?.endpoint || 'http://127.0.0.1:11434'} ("if possible only") — Currently offline; Patient Gemini Governor active.`
          );
        } else if (typeof payload.cooldownSeconds === 'number') {
          setStatusBanner(
            `Updated Step 5 "Time in the World" patient wait pacing to ${payload.cooldownSeconds}s between calls (No Rush · Never Hit Limit).`
          );
        }
        setTimeout(() => setStatusBanner(null), 4500);
      }
    } catch {
      // ignore
    }
  };

  const handleStepSelectOrAdvance = async (targetStep?: number) => {
    setIsAdvancing(true);
    try {
      const res = await fetch('/api/pro/advance-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetStep ? { targetStep } : {})
      });
      if (res.ok) {
        const data: ProModeJobState = await res.json();
        setProState(data);
        window.dispatchEvent(new CustomEvent('crewai:pro-status-updated', { detail: data }));
        if (data.currentStepNumber === 9) {
          window.dispatchEvent(new CustomEvent('crewai:push-entire-app'));
          setStatusBanner(
            `Step 9 (Push & Update Repo): Auto-uploading & pushing verified workspace to ${data.selectedRepo} (${data.targetBranch}) using your saved GitHub PAT.`
          );
          setTimeout(() => setStatusBanner(null), 4500);
        } else if (data.currentStepNumber === 10) {
          window.dispatchEvent(new CustomEvent('crewai:push-entire-app'));
          setStatusBanner(
            `Step 10 (End-But-Not-End): Version ${data.currentVersion} promoted — rolling into Evolution Cycle #${data.evolutionCycleCount} and syncing to GitHub.`
          );
          setTimeout(() => setStatusBanner(null), 4500);
        }
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const activeStep = proState?.currentStepNumber || 5;
  const ghConnected =
    proState?.githubConnected || Boolean(localStorage.getItem('crewai_github_token'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-6xl bg-[#0B0F19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Executive Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#131B2E] to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EB6658] to-amber-500 flex items-center justify-center shadow-lg shadow-[#EB6658]/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  PRO MODE · 24-Hour Autonomous Software Evolution
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {proState?.currentVersion || 'v1.2.0'} · Cycle #{proState?.evolutionCycleCount || 3}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                    proState?.isPaused
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  }`}
                >
                  {proState?.isPaused ? 'PAUSED (HITL OVERRIDE)' : `STEP ${activeStep}/10 ACTIVE`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connect GitHub → Select Project → Formulate 24h Goal → Delegate to Crews → Slowly & Surely Finish → Self-Heal (6/6.1) → Look Forward & Backward → Push & Update Repo (9) → End-But-Not-End (10)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeModalTab === 'dashboard'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Pro Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('setup')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeModalTab === 'setup'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>10-Step Setup & Controls</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoCycleDemo((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                autoCycleDemo
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Automatically cycle through the 10 autonomous steps every 4.5s"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoCycleDemo ? 'animate-spin' : ''}`} />
              <span>{autoCycleDemo ? 'Live Auto-Step: ON' : 'Live Auto-Step: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleStepSelectOrAdvance()}
              disabled={isAdvancing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Advance to the next step in the 10-step autonomous cycle"
            >
              <FastForward className="w-3.5 h-3.5 text-[#EB6658]" />
              <span>Next Phase</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePause}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                proState?.isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40'
              }`}
            >
              {proState?.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume 24h Job</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Job</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
              aria-label="Close Pro Mode Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusBanner && (
          <div className="px-6 py-2 bg-emerald-950/90 border-b border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[11px] font-mono text-emerald-300 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeModalTab === 'dashboard' && proState && (
            <ProDashboard
              proState={proState}
              onSelectStep={(stepNum) => handleStepSelectOrAdvance(stepNum)}
              onSwitchToSetup={() => setActiveModalTab('setup')}
              onFormulateFromAudit={() => handleFormulateGoal(true)}
              onUpdateCreditGovernor={handleUpdateCreditGovernor}
              onOpenConstitutionalAudit={onOpenConstitutionalAudit}
              isAdvancing={isAdvancing}
              isFormulating={isFormulating}
            />
          )}


          {/* 10-Step Horizontal Pipeline Bar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#EB6658]" />
                10-Step Continuous Autonomous Lifecycle (Click any step to inspect / jump)
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-300">
                  24h Elapsed:{' '}
                  <strong className="text-white">
                    {proState?.cycleHoursElapsed ?? 6.5}h / {proState?.cycleTotalHours ?? 24}h
                  </strong>
                </span>
                <span className="text-emerald-400">
                  Health Score: <strong>{proState?.healthScorePct ?? 98.4}%</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
              {NINE_STEPS.map((st) => {
                const isCurrent = activeStep === st.num;
                const isDone = activeStep > st.num;
                return (
                  <button
                    key={st.num}
                    type="button"
                    onClick={() => handleStepSelectOrAdvance(st.num)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-[#EB6658]/15 border-[#EB6658] text-white shadow-sm'
                        : isDone
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200 hover:bg-emerald-950/50'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isCurrent
                            ? 'bg-[#EB6658] text-white'
                            : isDone
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Step {st.num === 6 ? '6 & 6.1' : st.num}
                      </span>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] font-bold leading-tight">{st.short}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 1: Steps 1, 2, 3 — Simplified Setup & 24h Goal Formulation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Steps 1 & 2: Connect GitHub + Select Project */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#EB6658]" />
                  <h3 className="text-sm font-bold text-white">
                    Steps 1 & 2 · Connect GitHub & Select Project
                  </h3>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    ghConnected
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {ghConnected ? 'GitHub Connected' : 'Token Optional / Ready'}
                </span>
              </div>

              {/* Step 1: GitHub Connection */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    1. GitHub Repository Bridge
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPatInput((p) => !p)}
                    className="text-[11px] text-[#EB6658] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>{ghConnected ? 'Update PAT' : 'Connect PAT'}</span>
                  </button>
                </div>
                {showPatInput && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="ghp_... or github_pat_..."
                      className="flex-1 bg-slate-900 text-xs text-white px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-[#EB6658]"
                    />
                    <button
                      type="button"
                      onClick={handleConnectPat}
                      className="px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Uses your connected GitHub session to pull repository AST and push verified autonomous branches.
                </p>
              </div>

              {/* Step 2: Project & Branch Policy */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    2. Select Target Repository
                  </label>
                  <select
                    aria-label="Select Target Repository"
                    value={
                      CURATED_TARGET_REPOS.some((r) => r.displayRepo === repoInput)
                        ? repoInput
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setRepoInput(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-950 text-xs text-slate-100 px-3 py-2 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658] mb-2"
                  >
                    {CURATED_TARGET_REPOS.map((r) => (
                      <option key={r.displayRepo} value={r.displayRepo}>
                        {r.displayRepo} — {r.label}
                      </option>
                    ))}
                    <option value="custom">Custom GitHub Repository (owner/repo)</option>
                  </select>
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repository"
                    className="w-full bg-slate-950 text-xs font-mono text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Autonomous Branch Policy
                    </label>
                    <select
                      aria-label="Select Branch Policy"
                      value={branchPolicy}
                      onChange={(e) =>
                        setBranchPolicy(
                          e.target.value as 'jules_autonomous_branch' | 'direct_main'
                        )
                      }
                      className="w-full bg-slate-950 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
                    >
                      <option value="jules_autonomous_branch">
                        Safe Branch (jules/autonomous-*)
                      </option>
                      <option value="direct_main">Direct to Main Branch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Step 5 &quot;Time in the World&quot; Wait
                    </label>
                    <select
                      aria-label="Select Pacing Cooldown"
                      value={cooldownSeconds}
                      onChange={(e) => {
                        const sec = Number(e.target.value);
                        setCooldownSeconds(sec);
                        handleUpdateCreditGovernor({ cooldownSeconds: sec });
                      }}
                      className="w-full bg-slate-950 text-xs font-mono text-emerald-300 px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
                    >
                      <option value={15}>15s Patient Pacing (Safe)</option>
                      <option value={20}>20s No-Rush Guard (Recommended)</option>
                      <option value={30}>30s Deep Credit Conservator</option>
                      <option value={60}>60s &quot;All the Time in the World&quot;</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Formulate Goal & 24h Job (Guarded by Immutable Constitution) */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">
                      Step 3 · Formulate Goal from Audit &amp; Form Step 4 Tasks
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormulateGoal(true)}
                      disabled={isFormulating}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {isFormulating
                          ? 'Forming Goal & Tasks...'
                          : 'Feed Audit Goal to Step 3 & Form Tasks'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormulateGoal(false)}
                      disabled={isFormulating}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Refine &amp; Form Tasks</span>
                    </button>
                  </div>
                </div>

                {/* Immutable App Constitution Anchor */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300">
                      Immutable App Constitution (Locked Past Context — Never Revised)
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      {proState?.immutableConstitution?.version || 'CONSTITUTION-v1.0-IMMUTABLE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {proState?.immutableConstitution?.coreIdentity ||
                      'CrewAI Studio: 8-Agent Autonomous Software Engineering Platform with 4-Graph Architecture Alignment, Zero-Breach Rate-Limit Governor, and Authenticated GitHub PAT Sync.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {(proState?.immutableConstitution?.nonNegotiableInvariants || []).map(
                      (inv, idx) => (
                        <div
                          key={idx}
                          className="text-[10px] text-slate-400 bg-slate-900/70 px-2 py-1 rounded border border-slate-800/80 truncate"
                          title={inv}
                        >
                          {inv}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs text-slate-400 block">
                      Step 3 Formulated 24-Hour Goal (Auto-scanned against Constitution on every formulation):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const conflictSample =
                          'Refactor agent memory logger to call str(msg.content) directly, edit frozen docs/v1.0/agents.mdx, and git push --force without running tests.';
                        setGoalInput(conflictSample);
                        setFormulatedSignal((s) => s + 1);
                      }}
                      className="text-[11px] font-semibold text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Simulate Risky 24h Goal (Test Hook)
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="Describe what you want your CrewAI autonomous workforce to build, optimize, and verify over the next 24 hours..."
                    className="w-full bg-slate-950 text-xs text-slate-100 p-3 rounded-xl border border-slate-800 outline-none focus:border-[#EB6658] leading-relaxed"
                  />
                </div>

                {/* Automated Constitutional Risk Score Panel on the Job Submission Screen */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2.5 transition ${
                    riskAssessment.auditReport.status === 'BLOCKED'
                      ? 'bg-red-950/30 border-red-500/40'
                      : riskAssessment.riskScore > 0
                      ? 'bg-amber-950/25 border-amber-500/40'
                      : 'bg-emerald-950/20 border-emerald-500/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {riskAssessment.auditReport.status === 'BLOCKED' ? (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                          <span>Constitutional Risk Score</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono ${
                              riskAssessment.auditReport.status === 'BLOCKED'
                                ? 'text-red-300'
                                : riskAssessment.riskScore > 0
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }`}
                          >
                            {riskAssessment.riskTier}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {isScanningConstitution
                            ? 'Scanning formulated 24h goal against CONST-01..06...'
                            : `Auto-Scan #${constitutionalScanCount} at ${lastConstitutionalScanAt} · ${riskAssessment.auditReport.passedArticleIds.length}/6 Principles Passed`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 tabular-nums">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-slate-400">RISK SCORE</div>
                        <div
                          className={`text-lg font-black font-mono ${
                            riskAssessment.auditReport.status === 'BLOCKED'
                              ? 'text-red-400'
                              : riskAssessment.riskScore > 0
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {riskAssessment.riskScore}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Gauge Bar */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        riskAssessment.auditReport.status === 'BLOCKED'
                          ? 'bg-red-500'
                          : riskAssessment.riskScore > 0
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(4, riskAssessment.riskScore)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-200 leading-relaxed">
                    {riskAssessment.riskSummary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2">
                      {riskAssessment.auditReport.status === 'BLOCKED' && (
                        <button
                          type="button"
                          onClick={() => {
                            const remediated = riskAssessment.auditReport.remediatedGoal;
                            setGoalInput(remediated);
                            setBranchPolicy('jules_autonomous_branch');
                            setFormulatedSignal((s) => s + 1);
                            setStatusBanner(
                              'Auto-remediated 24-hour goal to eliminate all Constitutional conflicts (Risk Score reset to 0/100).'
                            );
                            setTimeout(() => setStatusBanner(null), 4000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold cursor-pointer"
                        >
                          Auto-Remediate 24h Goal (Reset Risk to 0/100)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => triggerConstitutionalScan(goalInput)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Re-Scan Now
                      </button>
                    </div>

                    {onOpenConstitutionalAudit && (
                      <button
                        type="button"
                        onClick={() => onOpenConstitutionalAudit(goalInput)}
                        className="text-[11px] font-semibold text-amber-300 hover:text-white underline cursor-pointer"
                      >
                        Open Full Constitutional Audit →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Target Branch:{' '}
                    <strong className="font-mono text-slate-200">
                      {branchPolicy === 'jules_autonomous_branch'
                        ? proState?.targetBranch || 'jules/autonomous-v1.3'
                        : 'main'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                    Risk: {riskAssessment.riskScore}/100
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleStartOrUpdateAutopilot}
                  disabled={isStarting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition cursor-pointer ${
                    riskAssessment.auditReport.status === 'BLOCKED'
                      ? 'bg-red-600/85 hover:bg-red-600 shadow-red-500/20'
                      : 'bg-[#EB6658] hover:bg-[#d95547] shadow-[#EB6658]/20'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    {isStarting
                      ? 'Synchronizing 24h Job...'
                      : riskAssessment.auditReport.status === 'BLOCKED'
                      ? `Blocked by Constitutional Risk (${riskAssessment.riskScore}/100)`
                      : `Launch / Sync 24-Hour Autonomous Job (Risk: ${riskAssessment.riskScore}/100)`}
                  </span>
                </button>
              </div>
            </div>
          </div>


          {/* Row 2: Step 4 (Crew Delegation) & Step 5 (Slowly & Surely Rate-Limit Guard) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Step 4: Delegated Crew Tasks */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">
                    Step 4 · Newly Formed &amp; Delegated CrewAI Tasks (From Step 3 Goal)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">
                  {proState?.delegatedTasks.length || 5} Tasks Formed · Constitution-Guarded
                </span>
              </div>

              <div className="space-y-2.5">
                {(proState?.delegatedTasks || []).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          #{task.stepOrder}
                        </span>
                        <span className="text-xs font-bold text-white">{task.title}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                          task.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : task.status === 'running'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : task.status === 'healing'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {task.status} · {task.progressPct}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        Agent: <strong className="text-slate-200">{task.agentName}</strong> (
                        {task.assignedCrewRole})
                      </span>
                      {task.constitutionGuard && (
                        <span className="font-mono text-[10px] text-amber-300">
                          {task.constitutionGuard}
                        </span>
                      )}
                    </div>

                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          task.status === 'completed'
                            ? 'bg-emerald-500'
                            : task.status === 'healing'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${task.progressPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 5: Slowly & Surely Finish (Patient Gemini Credit Governor & Conditional Ollama Fallback) */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Step 5 · Slowly &amp; Surely (Patient Credit Guard + Ollama)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    0 BREACHES · NO RUSH
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  We have all the time in the world: tasks willingly wait ({proState?.rateLimitGuard.cooldownSecondsBetweenTasks ?? 20}s pacing) and rotate Gemini key slots at &le;65% RPM so limits are never hit. If all Gemini credits are used up, it automatically tries local Ollama <em>if possible only</em>.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Gemini Credits Left</div>
                    <div className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5 tabular-nums">
                      {proState?.rateLimitGuard.allGeminiCreditsExhausted
                        ? '0% (Exhausted)'
                        : `${proState?.rateLimitGuard.geminiCreditsRemainingPct ?? 93}% Pool`}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Patient Wait Pacing</div>
                    <div className="text-lg font-mono font-extrabold text-sky-400 mt-0.5 tabular-nums">
                      {proState?.rateLimitGuard.cooldownSecondsBetweenTasks ?? 20}s No-Rush
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Patient Waits Run</div>
                    <div className="text-lg font-mono font-extrabold text-slate-100 mt-0.5 tabular-nums">
                      {proState?.rateLimitGuard.patientWaitsCount ?? 18} ({proState?.rateLimitGuard.totalPatientWaitSeconds ?? 360}s)
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Ollama (If Possible)</div>
                    <div className="text-sm font-mono font-extrabold text-amber-300 mt-1 truncate">
                      {proState?.rateLimitGuard.ollamaFallback?.status === 'active_fallback'
                        ? 'Active Fallback'
                        : proState?.rateLimitGuard.ollamaFallback?.available
                        ? 'Online Standby'
                        : 'Standby (If Possible)'}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
                  <div className="text-[11px] text-slate-300 leading-snug">
                    {proState?.rateLimitGuard.ollamaFallback?.note ||
                      'Standby ("if possible only") — Will probe & route to local Ollama if all Gemini credits are used up.'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateCreditGovernor({
                          simulateCreditsExhausted: !proState?.rateLimitGuard.allGeminiCreditsExhausted,
                          probeOllama: true
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
                    >
                      {proState?.rateLimitGuard.allGeminiCreditsExhausted
                        ? 'Restore Gemini Credits'
                        : 'Simulate Credit Exhaustion → Try Ollama'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateCreditGovernor({ probeOllama: true })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Probe Ollama
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-200 font-medium">Active Engine / Slot:</span>
                </div>
                <span className="font-mono text-emerald-300 font-bold truncate max-w-[220px]">
                  {proState?.rateLimitGuard.activeKeySlot || 'Free Pool + Patient Governor'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Step 6 & 6.1 (Find Errors & Formulate Fixes) + Steps 7 & 8 (Forward & Backward Deep Assessments) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Step 6 & 6.1: Error Detection & Self-Healing Ledger */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Steps 6 & 6.1 · Find Errors & Formulate Fix
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-300">
                  Max {proState?.maxHealAttempts ?? 3} Tries Guard
                </span>
              </div>

              <div className="space-y-2.5">
                {(proState?.errorAndFixLedger || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-300">{item.modulePath}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Attempt #{item.attemptNumber} · Verified Fix
                      </span>
                    </div>
                    <div className="text-slate-300">
                      <strong className="text-rose-400">6. Found:</strong> {item.detectedError}
                    </div>
                    <div className="text-slate-200">
                      <strong className="text-emerald-400">6.1. Formulated Fix:</strong>{' '}
                      {item.formulatedFix}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps 7 & 8: Deep Forward Assessment & Deep Backward Assessment */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Step 7: Look Forward */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-sky-400" />
                      <h3 className="text-sm font-bold text-white">7 · Look Forward</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-sky-300">
                      {proState?.forwardAssessment.alignmentScorePct ?? 97.8}% Goal Aligned
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {proState?.forwardAssessment.summary}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Proactive Horizon Actions:
                    </div>
                    {(proState?.forwardAssessment.nextHorizonActions || []).map((act, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-200 flex items-start gap-1.5"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                  Evaluated: {proState?.forwardAssessment.lastEvaluatedAt || 'Just now'}
                </div>
              </div>

              {/* Step 8: Look Backward */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white">8 · Look Backward & Fix</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {proState?.backwardAssessment.retrospectiveScorePct ?? 99.1}% Verified
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {proState?.backwardAssessment.summary}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Retrospective Drift Fixes Applied:
                    </div>
                    {(proState?.backwardAssessment.driftCorrectionsApplied || []).map((fix, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-200 flex items-start gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                  Milestones Audited: {proState?.backwardAssessment.completedMilestonesVerified ?? 14}{' '}
                  · {proState?.backwardAssessment.lastAuditedAt || '6 mins ago'}
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Step 9 (Push & Update Repo) & Step 10 (End-But-Not-End Continuous Versioning) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <InfinityIcon className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">
                  Step 9 · Push & Update Repo &nbsp;→&nbsp; Step 10 · End-But-Not-End (Continuous Versioning)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepSelectOrAdvance(9)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Step 9: Push & Update Repo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStepSelectOrAdvance(10)}
                  className="px-2.5 py-1 rounded-lg bg-[#EB6658]/20 hover:bg-[#EB6658]/30 text-[#EB6658] border border-[#EB6658]/40 text-xs font-bold transition cursor-pointer"
                >
                  Step 10: End-But-Not-End (Version Bump)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(proState?.versionHistory || []).map((ver, idx) => (
                <div
                  key={`${ver.version}-${idx}`}
                  className={`p-3 rounded-xl border ${
                    idx === 0
                      ? 'bg-slate-950 border-[#EB6658]/50'
                      : 'bg-slate-950/70 border-slate-800'
                  } space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-sm text-white">
                      {ver.version}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {ver.testsPassed}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-sky-400">{ver.branch}</div>
                  <p className="text-xs text-slate-300 leading-snug">{ver.highlights}</p>
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
