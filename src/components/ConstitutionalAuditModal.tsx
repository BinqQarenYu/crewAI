import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Scale,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Play,
  Plus,
  History,
  FileCode,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import {
  IMMUTABLE_CONSTITUTION_ARTICLES,
  CONSTITUTION_ROOT_HASH,
  PRESET_CONSTITUTIONAL_TEST_CASES,
  validateAutonomousGoal,
  type ConstitutionalArticle,
  type ConstitutionalAuditReport,
  type CustomConstitutionalRule
} from '../utils/constitutionalValidator';

interface ConstitutionalAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGoal?: string;
  initialTestCommand?: string;
  initialTargetPath?: string;
  onDispatchCompliantGoalToJules?: (goal: {
    prompt: string;
    testCommand: string;
    targetPath?: string;
  }) => void;
}

export const ConstitutionalAuditModal: React.FC<ConstitutionalAuditModalProps> = ({
  isOpen,
  onClose,
  initialGoal,
  initialTestCommand,
  initialTargetPath,
  onDispatchCompliantGoalToJules
}) => {
  const [activeTab, setActiveTab] = useState<'validator' | 'constitution' | 'ledger'>('validator');
  const [articles, setArticles] = useState<ConstitutionalArticle[]>(IMMUTABLE_CONSTITUTION_ARTICLES);
  const [customRules, setCustomRules] = useState<CustomConstitutionalRule[]>([]);
  const [auditLedger, setAuditLedger] = useState<ConstitutionalAuditReport[]>([]);
  const [rootHash, setRootHash] = useState<string>(CONSTITUTION_ROOT_HASH);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);

  // Validator form state
  const [actor, setActor] = useState<ConstitutionalAuditReport['actor']>('Jules Autonomous Agent');
  const [proposedGoal, setProposedGoal] = useState<string>(
    initialGoal ||
      PRESET_CONSTITUTIONAL_TEST_CASES[0].goal
  );
  const [testCommand, setTestCommand] = useState<string>(
    initialTestCommand || PRESET_CONSTITUTIONAL_TEST_CASES[0].testCommand
  );
  const [targetPath, setTargetPath] = useState<string>(
    initialTargetPath || PRESET_CONSTITUTIONAL_TEST_CASES[0].targetPath
  );
  const [currentReport, setCurrentReport] = useState<ConstitutionalAuditReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [copiedArticleCode, setCopiedArticleCode] = useState<string | null>(null);

  // Custom supplementary guardrail form
  const [newRuleTitle, setNewRuleTitle] = useState<string>('');
  const [newRuleForbidden, setNewRuleForbidden] = useState<string>('');
  const [newRuleReplacement, setNewRuleReplacement] = useState<string>('');
  const [newRuleRationale, setNewRuleRationale] = useState<string>('');
  const [ruleBanner, setRuleBanner] = useState<string | null>(null);

  // Sync initial props when opened from Jules or external caller
  useEffect(() => {
    if (initialGoal && initialGoal.trim()) {
      setProposedGoal(initialGoal);
    }
    if (initialTestCommand && initialTestCommand.trim()) {
      setTestCommand(initialTestCommand);
    }
    if (typeof initialTargetPath === 'string' && initialTargetPath.trim()) {
      setTargetPath(initialTargetPath);
    }
  }, [initialGoal, initialTestCommand, initialTargetPath]);

  const fetchConstitutionFromServer = async () => {
    setIsLoadingDb(true);
    try {
      const res = await fetch('/api/fullstack/constitution');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.immutableArticles) && data.immutableArticles.length > 0) {
          setArticles(data.immutableArticles);
        }
        if (Array.isArray(data.customRules)) {
          setCustomRules(data.customRules);
        }
        if (Array.isArray(data.audits)) {
          setAuditLedger(data.audits);
        }
        if (data.constitutionRootHash) {
          setRootHash(data.constitutionRootHash);
        }
      }
    } catch {
      // Fallback to local immutable articles if server is unreachable
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchConstitutionFromServer();
  }, [isOpen]);

  // Run instant deterministic validation whenever inputs or customRules change
  useEffect(() => {
    if (!isOpen) return;
    const report = validateAutonomousGoal(proposedGoal, {
      testCommand,
      targetPath,
      actor,
      customRules
    });
    setCurrentReport(report);
  }, [isOpen, proposedGoal, testCommand, targetPath, actor, customRules]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunServerAudit = async (goalOverride?: string, cmdOverride?: string, pathOverride?: string) => {
    const goalToAudit = goalOverride ?? proposedGoal;
    const cmdToAudit = cmdOverride ?? testCommand;
    const pathToAudit = pathOverride ?? targetPath;

    setIsValidating(true);
    const localReport = validateAutonomousGoal(goalToAudit, {
      testCommand: cmdToAudit,
      targetPath: pathToAudit,
      actor,
      customRules
    });
    setCurrentReport(localReport);

    try {
      const res = await fetch('/api/fullstack/constitution/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedGoal: goalToAudit,
          testCommand: cmdToAudit,
          targetPath: pathToAudit,
          actor
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setCurrentReport(data.report);
          setAuditLedger((prev) => [data.report, ...prev.filter((a) => a.auditId !== data.report.auditId)]);
        }
      }
    } catch {
      setAuditLedger((prev) => [localReport, ...prev]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleApplyAutoRemediation = () => {
    if (!currentReport) return;
    const fixedGoal = currentReport.remediatedGoal;
    const fixedCmd = currentReport.remediatedTestCommand || 'pytest tests/ -v';
    const fixedPath = /^docs\/v\d+/i.test(targetPath)
      ? targetPath.replace(/^docs\/v\d+(?:\.\d+)*/i, 'docs/edge/en')
      : targetPath;

    setProposedGoal(fixedGoal);
    setTestCommand(fixedCmd);
    setTargetPath(fixedPath);
    handleRunServerAudit(fixedGoal, fixedCmd, fixedPath);
  };

  const handleAddCustomGuardrail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim() || !newRuleForbidden.trim()) return;

    try {
      const res = await fetch('/api/fullstack/constitution/custom-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRuleTitle.trim(),
          forbiddenKeyword: newRuleForbidden.trim(),
          requiredReplacement: newRuleReplacement.trim() || 'Use compliant implementation pattern',
          rationale: newRuleRationale.trim() || 'Supplementary workspace guardrail enforced for Jules.'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rule) {
          setCustomRules((prev) => [data.rule, ...prev]);
        }
        setNewRuleTitle('');
        setNewRuleForbidden('');
        setNewRuleReplacement('');
        setNewRuleRationale('');
        setRuleBanner(`Saved supplementary guardrail ${data.rule?.code || ''} to SQLite.`);
        setTimeout(() => setRuleBanner(null), 3500);
      }
    } catch {
      const fallbackRule: CustomConstitutionalRule = {
        id: `custom-${Date.now()}`,
        code: `GUARD-0${customRules.length + 1}`,
        title: newRuleTitle.trim(),
        forbiddenKeyword: newRuleForbidden.trim(),
        requiredReplacement: newRuleReplacement.trim() || 'Use compliant implementation pattern',
        rationale: newRuleRationale.trim() || 'Supplementary workspace guardrail enforced for Jules.',
        createdAt: new Date().toISOString()
      };
      setCustomRules((prev) => [fallbackRule, ...prev]);
      setNewRuleTitle('');
      setNewRuleForbidden('');
      setNewRuleReplacement('');
      setNewRuleRationale('');
    }
  };

  const handleCopySnippet = (code: string, snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedArticleCode(code);
    setTimeout(() => setCopiedArticleCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-6xl bg-[#0B0F19] border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-[#EB6658] text-slate-950 shadow-lg shadow-amber-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Constitutional Audit & Jules Guardrail Engine
                </h2>
                <span className="text-[11px] font-mono text-amber-300">
                  {articles.length} Immutable Core Articles · SQLite ACID Locked · {rootHash.slice(0, 22)}...
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Defines the immutable core principles of CrewAI Studio and validates every proposed autonomous goal or task so Jules never deviates from established logic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented View Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('validator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === 'validator'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Goal & Task Validator</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('constitution')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === 'constitution'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Immutable Constitution ({articles.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Ledger ({auditLedger.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Constitutional Audit Modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* =====================================================================
              TAB 1: AUTONOMOUS GOAL & TASK VALIDATOR (JULES PRE-FLIGHT GUARDRAIL)
             ===================================================================== */}
          {activeTab === 'validator' && (
            <div className="space-y-6">
              {/* Preset Test Scenarios Bar */}
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white">
                    Test Autonomous Goal Scenarios Against Core Constitution
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Load a sample conflicting or compliant directive to verify how the validator blocks rule deviations before Jules executes.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_CONSTITUTIONAL_TEST_CASES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setActor(preset.actor);
                        setProposedGoal(preset.goal);
                        setTestCommand(preset.testCommand);
                        setTargetPath(preset.targetPath);
                        handleRunServerAudit(preset.goal, preset.testCommand, preset.targetPath);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                        preset.badge === 'CONFLICT'
                          ? 'bg-red-950/50 hover:bg-red-900/60 text-red-200 border-red-500/40'
                          : 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border-emerald-500/40'
                      }`}
                    >
                      {preset.badge === 'CONFLICT' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Two-Column Split: Left = Proposed Goal Input | Right = Real-Time Constitutional Verdict */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Proposed Autonomous Goal & Task Form */}
                <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Proposed Autonomous Goal / Task Directive
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Evaluated against CONST-01 through CONST-06 and {customRules.length} custom workspace guardrails.
                        </p>
                      </div>
                      <select
                        aria-label="Autonomous Agent Actor"
                        value={actor}
                        onChange={(e) => setActor(e.target.value as ConstitutionalAuditReport['actor'])}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-[#EB6658]"
                      >
                        <option value="Jules Autonomous Agent">Jules Autonomous Agent</option>
                        <option value="Crew Studio Orchestrator">Crew Studio Orchestrator</option>
                        <option value="Constitutional Auditor">Constitutional Auditor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Autonomous Goal / Task Prompt
                      </label>
                      <textarea
                        value={proposedGoal}
                        onChange={(e) => setProposedGoal(e.target.value)}
                        rows={4}
                        placeholder="Enter the autonomous goal or task directive for Jules..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 outline-none focus:border-[#EB6658] leading-relaxed font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-slate-400" />
                          <span>Verification Command</span>
                        </label>
                        <input
                          type="text"
                          value={testCommand}
                          onChange={(e) => setTestCommand(e.target.value)}
                          placeholder="pytest tests/ -v"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400 outline-none focus:border-[#EB6658]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-slate-400" />
                          <span>Target Module / Path</span>
                        </label>
                        <input
                          type="text"
                          value={targetPath}
                          onChange={(e) => setTargetPath(e.target.value)}
                          placeholder="lib/crewai/src/crewai/..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-[#EB6658]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={isValidating}
                      onClick={() => handleRunServerAudit()}
                      className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      {isValidating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Recording Audit in SQLite...</span>
                        </>
                      ) : (
                        <>
                          <Scale className="w-3.5 h-3.5" />
                          <span>Validate & Record in SQLite Ledger</span>
                        </>
                      )}
                    </button>

                    {currentReport && currentReport.status === 'BLOCKED' && (
                      <button
                        type="button"
                        onClick={handleApplyAutoRemediation}
                        className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Auto-Remediate Conflicts</span>
                      </button>
                    )}

                    {currentReport &&
                      currentReport.status === 'COMPLIANT' &&
                      onDispatchCompliantGoalToJules && (
                        <button
                          type="button"
                          onClick={() => {
                            onDispatchCompliantGoalToJules({
                              prompt: proposedGoal,
                              testCommand,
                              targetPath
                            });
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Send Verified Goal to Jules</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                </div>

                {/* Right Column: Live Constitutional Verdict & Conflict Breakdown */}
                <div className="lg:col-span-6 space-y-4">
                  {currentReport && (
                    <div
                      className={`p-5 rounded-2xl border space-y-4 ${
                        currentReport.status === 'BLOCKED'
                          ? 'bg-red-950/25 border-red-500/40'
                          : 'bg-emerald-950/25 border-emerald-500/40'
                      }`}
                    >
                      {/* Verdict Header */}
                      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                        <div className="flex items-start gap-3">
                          {currentReport.status === 'BLOCKED' ? (
                            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                              <ShieldAlert className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              <ShieldCheck className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-extrabold tracking-tight ${
                                  currentReport.status === 'BLOCKED'
                                    ? 'text-red-300'
                                    : 'text-emerald-300'
                                }`}
                              >
                                {currentReport.status === 'BLOCKED'
                                  ? 'CONSTITUTIONAL CONFLICT DETECTED — EXECUTION BLOCKED'
                                  : 'CONSTITUTIONALLY COMPLIANT — CLEARED FOR JULES'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                              {currentReport.status === 'BLOCKED'
                                ? `Flagged ${currentReport.violations.length} core constraint conflict(s). Jules is barred from executing this task until remediated.`
                                : `Verified against all ${articles.length} immutable core principles and ${customRules.length} custom guardrails. Zero conflicts found.`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 tabular-nums">
                          <div className="text-[10px] font-mono text-slate-400">COMPLIANCE</div>
                          <div
                            className={`text-2xl font-black font-mono ${
                              currentReport.complianceScore === 100
                                ? 'text-emerald-400'
                                : currentReport.complianceScore >= 60
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {currentReport.complianceScore}/100
                          </div>
                        </div>
                      </div>

                      {/* Violated Articles List */}
                      {currentReport.violations.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-red-200">
                            Flagged Constitutional Conflicts ({currentReport.violations.length})
                          </div>
                          {currentReport.violations.map((v, idx) => (
                            <div
                              key={`${v.articleCode}-${idx}`}
                              className="p-3.5 rounded-xl bg-slate-950/90 border border-red-500/40 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-white">
                                  {v.articleCode} · {v.articleTitle}
                                </span>
                                <span className="text-[11px] font-mono text-red-300">
                                  {v.severity} · {v.category}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-2.5 py-1">
                                Triggered Constraint: {v.matchedTrigger}
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {v.conflictExplanation}
                              </p>
                              <div className="text-[11px] text-emerald-300 font-medium pt-1 border-t border-slate-800/80">
                                Required Remediation: {v.remediationDirective}
                              </div>
                            </div>
                          ))}

                          {/* Auto-Remediated Compliant Rewrite Preview */}
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-300">
                                Compliant Auto-Remediation Rewrite
                              </span>
                              <button
                                type="button"
                                onClick={handleApplyAutoRemediation}
                                className="text-xs font-bold text-amber-300 hover:text-white underline cursor-pointer"
                              >
                                Apply Compliant Directive
                              </button>
                            </div>
                            <p className="text-xs font-mono text-slate-200 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                              {currentReport.remediatedGoal}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-emerald-200">
                            Passed Immutable Constitutional Articles ({currentReport.passedArticleIds.length}/{articles.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {articles.map((art) => (
                              <div
                                key={art.code}
                                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                  <div className="text-xs font-bold text-white">
                                    {art.code} · {art.category}
                                  </div>
                                  <div className="text-[11px] text-slate-400 line-clamp-1">
                                    {art.title}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: IMMUTABLE CORE CONSTITUTION & SUPPLEMENTARY GUARDRAILS
             ===================================================================== */}
          {activeTab === 'constitution' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map((art) => (
                  <div
                    key={art.id}
                    className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-sm font-extrabold text-white">
                            {art.code} · {art.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          IMMUTABLE · {art.severity}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium leading-relaxed">
                        {art.summary}
                      </p>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <strong className="text-slate-300">Architectural Rationale:</strong> {art.rationale}
                      </p>

                      <div className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5">
                        <strong>Required Invariant:</strong> {art.requiredInvariant}
                      </div>

                      <div className="text-[11px] text-red-300 font-mono">
                        Forbidden Patterns: {art.forbiddenPatterns.join(' · ')}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono">
                          SHA-256: {art.sha256Fingerprint.slice(0, 24)}...
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopySnippet(art.code, art.canonicalSnippet)}
                          className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                        >
                          {copiedArticleCode === art.code ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Pattern</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
                        {art.canonicalSnippet}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              {/* Supplementary Custom Guardrail Builder */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Append Supplementary Workspace Guardrail (SQLite Persisted)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Core articles CONST-01 through CONST-06 are hardware-locked as immutable, but you can append additional project-specific rules for Jules.
                    </p>
                  </div>
                  {ruleBanner && (
                    <span className="text-xs font-semibold text-emerald-300">
                      {ruleBanner}
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddCustomGuardrail} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={newRuleTitle}
                    onChange={(e) => setNewRuleTitle(e.target.value)}
                    placeholder="Guardrail Title (e.g. No Eval() Calls)"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#EB6658]"
                  />
                  <input
                    type="text"
                    value={newRuleForbidden}
                    onChange={(e) => setNewRuleForbidden(e.target.value)}
                    placeholder="Forbidden Pattern (e.g. eval()"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-red-300 outline-none focus:border-[#EB6658]"
                  />
                  <input
                    type="text"
                    value={newRuleReplacement}
                    onChange={(e) => setNewRuleReplacement(e.target.value)}
                    placeholder="Compliant Replacement (e.g. ast.literal_eval)"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-[#EB6658]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Guardrail to Constitution</span>
                  </button>
                </form>

                {customRules.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {customRules.map((cr) => (
                      <div
                        key={cr.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {cr.code} · {cr.title}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Forbidden: "{cr.forbiddenKeyword}" → Enforce: "{cr.requiredReplacement}"
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                          ACTIVE
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 3: CONSTITUTIONAL AUDIT LEDGER (SQLITE PERSISTED)
             ===================================================================== */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    SQLite Constitutional Audit Trail (constitutional_audits)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Every autonomous task or goal checked against the Constitution is logged with its compliance score and remediation trace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchConstitutionFromServer}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} />
                  <span>Refresh SQLite Ledger</span>
                </button>
              </div>

              <div className="space-y-3">
                {auditLedger.map((entry) => (
                  <div
                    key={entry.auditId}
                    className={`p-4 rounded-2xl border transition ${
                      entry.status === 'BLOCKED'
                        ? 'bg-red-950/15 border-red-500/30'
                        : 'bg-slate-900/50 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {entry.status === 'BLOCKED' ? (
                          <ShieldAlert className="w-4 h-4 text-red-400" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        )}
                        <span
                          className={`text-xs font-extrabold ${
                            entry.status === 'BLOCKED' ? 'text-red-300' : 'text-emerald-300'
                          }`}
                        >
                          {entry.status} ({entry.complianceScore}/100)
                        </span>
                        <span className="text-xs text-slate-400">
                          · {entry.actor} · {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProposedGoal(entry.proposedGoal);
                          setTestCommand(entry.testCommand || 'pytest tests/ -v');
                          setTargetPath(entry.targetPath || '');
                          setActiveTab('validator');
                        }}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        Load into Validator →
                      </button>
                    </div>

                    <p className="text-xs font-mono text-slate-200 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                      {entry.proposedGoal}
                    </p>

                    {entry.violations && entry.violations.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-red-300">
                        <span>Violated Articles:</span>
                        <span>
                          {entry.violations.map((v) => `${v.articleCode} (${v.articleTitle})`).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
