import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  Scale,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Play,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  FileCode
} from 'lucide-react';
import {
  IMPACT_SIMULATION_PRESETS,
  simulateConstitutionalImpact,
  type ConstitutionalImpactSimulationResult
} from '../utils/constitutionalValidator';

interface DelegatedTaskPreview {
  id: string;
  stepOrder: number;
  title: string;
  assignedCrewRole: string;
  agentName: string;
  status: 'completed' | 'running' | 'healing' | 'queued';
  progressPct: number;
}

interface ConstitutionalImpactAnalysisProps {
  primaryGoal: string;
  delegatedTasks: DelegatedTaskPreview[];
  onQueueVerifiedTask?: (task: {
    title: string;
    directive: string;
    agentName: string;
    assignedCrewRole: string;
  }) => void;
  onOpenConstitutionalAudit?: (goalPrompt?: string) => void;
}

export const ConstitutionalImpactAnalysis: React.FC<ConstitutionalImpactAnalysisProps> = ({
  delegatedTasks,
  onQueueVerifiedTask,
  onOpenConstitutionalAudit
}) => {
  const defaultPreset = IMPACT_SIMULATION_PRESETS[0];
  const [taskTitle, setTaskTitle] = useState<string>(defaultPreset.taskTitle);
  const [taskDirective, setTaskDirective] = useState<string>(defaultPreset.taskDirective);
  const [targetModule, setTargetModule] = useState<string>(defaultPreset.targetModule);
  const [assignedAgent, setAssignedAgent] = useState<string>(defaultPreset.assignedAgent);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [queuedConfirmation, setQueuedConfirmation] = useState<string | null>(null);

  const [simResult, setSimResult] = useState<ConstitutionalImpactSimulationResult>(() =>
    simulateConstitutionalImpact({
      taskTitle: defaultPreset.taskTitle,
      taskDirective: defaultPreset.taskDirective,
      targetModule: defaultPreset.targetModule,
      assignedAgent: defaultPreset.assignedAgent
    })
  );

  // Automatically re-compute impact simulation whenever proposed task inputs change
  useEffect(() => {
    const next = simulateConstitutionalImpact({
      taskTitle,
      taskDirective,
      targetModule,
      assignedAgent
    });
    setSimResult(next);
  }, [taskTitle, taskDirective, targetModule, assignedAgent]);

  const handleRunSimulationAndLog = async (
    overrideTitle?: string,
    overrideDirective?: string,
    overrideModule?: string,
    overrideAgent?: string
  ) => {
    const titleToUse = overrideTitle ?? taskTitle;
    const directiveToUse = overrideDirective ?? taskDirective;
    const moduleToUse = overrideModule ?? targetModule;
    const agentToUse = overrideAgent ?? assignedAgent;

    setIsSimulating(true);
    const computed = simulateConstitutionalImpact({
      taskTitle: titleToUse,
      taskDirective: directiveToUse,
      targetModule: moduleToUse,
      assignedAgent: agentToUse
    });
    setSimResult(computed);

    try {
      await fetch('/api/fullstack/constitution/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedGoal: `[Impact Simulation: ${titleToUse}] ${directiveToUse}`,
          testCommand: 'pytest tests/ -v',
          targetPath: moduleToUse,
          actor: 'Constitutional Auditor'
        })
      });
    } catch {
      // ignore network error
    } finally {
      setTimeout(() => setIsSimulating(false), 220);
    }
  };

  const handleNeutralizeDrift = () => {
    const cleanDirective = simResult.neutralizedTaskDirective;
    const cleanModule = /^docs\/v\d+/i.test(targetModule)
      ? targetModule.replace(/^docs\/v\d+(?:\.\d+)*/i, 'docs/edge/en')
      : targetModule;

    setTaskDirective(cleanDirective);
    setTargetModule(cleanModule);
    handleRunSimulationAndLog(taskTitle, cleanDirective, cleanModule, assignedAgent);
  };

  const handleQueueTask = () => {
    const directiveToQueue =
      simResult.overallDriftPct > 0 ? simResult.neutralizedTaskDirective : taskDirective;
    const cleanModule = /^docs\/v\d+/i.test(targetModule)
      ? targetModule.replace(/^docs\/v\d+(?:\.\d+)*/i, 'docs/edge/en')
      : targetModule;

    if (simResult.overallDriftPct > 0) {
      setTaskDirective(directiveToQueue);
      setTargetModule(cleanModule);
    }

    onQueueVerifiedTask?.({
      title: `${taskTitle} (0% Drift Verified)`,
      directive: directiveToQueue,
      agentName: assignedAgent.split('·')[0].trim() || 'Google Jules VM',
      assignedCrewRole: assignedAgent.includes('·')
        ? assignedAgent.split('·')[1].trim()
        : 'Constitutional Pre-Cleared Task'
    });

    setQueuedConfirmation(
      `Queued "${taskTitle}" into Step 4 Workforce after verifying 0% Constitutional Drift.`
    );
    setTimeout(() => setQueuedConfirmation(null), 4000);
  };

  const chartData = simResult.principleImpacts.map((p) => ({
    code: p.articleCode,
    title: p.articleTitle,
    integrityPct: p.projectedIntegrityPct,
    driftPct: p.driftPct,
    driftLevel: p.driftLevel
  }));

  return (
    <div className="bg-slate-900/70 border border-amber-500/35 rounded-xl p-4 space-y-4">
      {/* Top Header & Scenario Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-300 tabular-nums">
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>PRE-QUEUE CONSTITUTIONAL IMPACT ANALYSIS SIMULATOR</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-300">
              Simulates Core Principle Drift Before Task Is Queued
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1">
            Constitutional Impact Analysis &amp; Pre-Queue Principle Drift Simulator
          </h3>
        </div>

        {/* Preset Simulation Scenarios */}
        <div className="flex flex-wrap items-center gap-1.5">
          {IMPACT_SIMULATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setTaskTitle(preset.taskTitle);
                setTaskDirective(preset.taskDirective);
                setTargetModule(preset.targetModule);
                setAssignedAgent(preset.assignedAgent);
                handleRunSimulationAndLog(
                  preset.taskTitle,
                  preset.taskDirective,
                  preset.targetModule,
                  preset.assignedAgent
                );
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                preset.mode === 'CRITICAL_DRIFT'
                  ? 'bg-red-950/40 hover:bg-red-900/50 text-red-200 border-red-500/40'
                  : preset.mode === 'LATENT_DRIFT'
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border-amber-500/40'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border-emerald-500/40'
              }`}
            >
              {preset.mode === 'CRITICAL_DRIFT' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : preset.mode === 'LATENT_DRIFT' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main 12-Column Simulation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 5 Columns: Proposed Task Input & Quick Load from Step 4 Queue */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Proposed Task Candidate (Pre-Queue Sandbox)
              </span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                Sim ID: {simResult.simulationId.slice(-8)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Proposed Task Title</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#EB6658]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Target Module Path</label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetModule}
                    onChange={(e) => setTargetModule(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-[#EB6658]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Proposed Task Execution Directive (Simulated Against CONST-01..06):
              </label>
              <textarea
                rows={3}
                value={taskDirective}
                onChange={(e) => setTaskDirective(e.target.value)}
                placeholder="Describe what the proposed task will do before queuing..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-[#EB6658] leading-relaxed"
              />
            </div>

            {/* Load any existing Step 4 task to inspect its Constitutional Drift */}
            {delegatedTasks.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 font-semibold">
                  Or click an existing Step 4 task to simulate its constitutional drift:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {delegatedTasks.slice(0, 4).map((dt) => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => {
                        setTaskTitle(dt.title);
                        setTaskDirective(
                          `${dt.title} — Assigned to ${dt.agentName} (${dt.assignedCrewRole}). Verify behavior with pytest unit tests and message_content_text(msg).`
                        );
                        setAssignedAgent(`${dt.agentName} · ${dt.assignedCrewRole}`);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition cursor-pointer truncate max-w-[210px]"
                      title={dt.title}
                    >
                      #{dt.stepOrder} {dt.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleRunSimulationAndLog()}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{isSimulating ? 'Simulating Impact...' : 'Run Impact Simulation'}</span>
            </button>

            <div className="flex items-center gap-2">
              {simResult.overallDriftPct > 0 && (
                <button
                  type="button"
                  onClick={handleNeutralizeDrift}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Neutralize Drift (0%)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleQueueTask}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>
                  {simResult.overallDriftPct > 0
                    ? 'Auto-Neutralize & Queue Task'
                    : 'Queue Verified Task'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Simulated Drift Summary + Recharts BarChart + 6-Principle Impact Matrix */}
        <div className="lg:col-span-7 space-y-3">
          {/* Top Simulation Verdict & Metrics Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
              simResult.queueVerdict === 'BLOCKED_CRITICAL_DRIFT'
                ? 'bg-red-950/30 border-red-500/40'
                : simResult.queueVerdict === 'LATENT_DRIFT_WARNING'
                ? 'bg-amber-950/25 border-amber-500/40'
                : 'bg-emerald-950/25 border-emerald-500/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {simResult.queueVerdict === 'BLOCKED_CRITICAL_DRIFT' ? (
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              ) : simResult.queueVerdict === 'LATENT_DRIFT_WARNING' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-extrabold text-white flex flex-wrap items-center gap-2">
                  <span>
                    {simResult.queueVerdict === 'BLOCKED_CRITICAL_DRIFT'
                      ? 'CRITICAL CONSTITUTIONAL DRIFT DETECTED — DO NOT QUEUE UNPATCHED'
                      : simResult.queueVerdict === 'LATENT_DRIFT_WARNING'
                      ? 'POTENTIAL LATENT PRINCIPLE DRIFT DETECTED — GUARDRAILS RECOMMENDED'
                      : 'ZERO CONSTITUTIONAL DRIFT — 100% ALIGNED TO QUEUE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {simResult.driftingPrinciplesCount === 0
                    ? 'All 6 core principles maintain 100% projected integrity after task execution.'
                    : `${simResult.driftingPrinciplesCount} of 6 core principles show projected drift (${simResult.criticalDriftCount} critical · ${simResult.latentDriftCount} latent) at ${simResult.simulatedAt}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 tabular-nums shrink-0">
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400">PROJECTED DRIFT</div>
                <div
                  className={`text-lg font-black font-mono ${
                    simResult.overallDriftPct >= 50
                      ? 'text-red-400'
                      : simResult.overallDriftPct > 0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {simResult.overallDriftPct}%
                </div>
              </div>
              <div className="text-right border-l border-slate-800 pl-4">
                <div className="text-[10px] font-mono text-slate-400">POST-TASK HEALTH</div>
                <div
                  className={`text-lg font-black font-mono ${
                    simResult.projectedConstitutionHealthPct === 100
                      ? 'text-emerald-400'
                      : simResult.projectedConstitutionHealthPct >= 65
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {simResult.projectedConstitutionHealthPct}%
                </div>
              </div>
            </div>
          </div>

          {queuedConfirmation && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{queuedConfirmation}</span>
            </div>
          )}

          {/* Recharts BarChart: Projected Principle Integrity vs Potential Drift across CONST-01..06 */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[11px]">
              <span className="font-bold text-slate-200">
                Simulated Post-Task Principle Integrity &amp; Drift Profile (CONST-01 – CONST-06)
              </span>
              <span className="font-mono text-slate-400 tabular-nums">
                Green = 100% Intact · Amber = Latent Drift · Red = Critical Drift
              </span>
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 6, right: 12, left: -22, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="code"
                    stroke="#64748B"
                    tick={{ fill: '#CBD5E1', fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    unit="%"
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
                  <ReferenceLine y={100} stroke="#10B981" strokeDasharray="3 3" />
                  <Bar
                    dataKey="integrityPct"
                    name="Projected Principle Integrity %"
                    radius={[4, 4, 0, 0]}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.code}
                        fill={
                          entry.driftLevel === 'CRITICAL_DRIFT'
                            ? '#EF4444'
                            : entry.driftLevel === 'LATENT_DRIFT'
                            ? '#F59E0B'
                            : '#10B981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6-Principle Detailed Impact & Drift Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {simResult.principleImpacts.map((imp) => (
              <div
                key={imp.articleCode}
                className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                  imp.driftLevel === 'CRITICAL_DRIFT'
                    ? 'bg-red-950/25 border-red-500/40'
                    : imp.driftLevel === 'LATENT_DRIFT'
                    ? 'bg-amber-950/20 border-amber-500/35'
                    : 'bg-slate-950/90 border-slate-800/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                  <span className="font-bold text-white">
                    {imp.articleCode} · {imp.category}
                  </span>
                  <span
                    className={
                      imp.driftLevel === 'CRITICAL_DRIFT'
                        ? 'text-red-400 font-bold'
                        : imp.driftLevel === 'LATENT_DRIFT'
                        ? 'text-amber-300 font-bold'
                        : 'text-emerald-400'
                    }
                  >
                    {imp.driftPct === 0
                      ? '0% Drift (100% Intact)'
                      : `-${imp.driftPct}% Drift (${imp.projectedIntegrityPct}% Integrity)`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                  {imp.driftAnalysis}
                </p>

                {imp.driftPct > 0 && (
                  <div className="text-[10px] text-emerald-300 font-medium pt-0.5 border-t border-slate-800/80">
                    Guardrail Fix: {imp.mitigationGuardrail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
