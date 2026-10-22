import React, { useState, useEffect, useCallback } from 'react';
import { ExecutionLog } from '../types';
import { emitJulesPrNotification } from '../utils/prNotifications';
import {
  GitPullRequest,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Wrench,
  Cpu,
  Lock,
  FileCode,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  ArrowRight,
  GitMerge,
  Eye
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

export interface AutomatedPrRevision {
  id: string;
  file: string;
  category: 'security' | 'quality' | 'crewai_idiom';
  severity: 'high' | 'medium' | 'low';
  title: string;
  rationale: string;
  beforeCode: string;
  afterCode: string;
  applied: boolean;
}

export interface ComplianceCheckItem {
  id: string;
  category: 'security' | 'quality';
  name: string;
  status: 'passed' | 'warning' | 'fixed';
  detail: string;
}

export interface InterceptedJulesPR {
  prNumber: number;
  title: string;
  branch: string;
  repo: string;
  author: string;
  reviewerAgent: string;
  reviewerModel: string;
  interceptedAt: string;
  status: 'revisions_suggested' | 'revisions_applied' | 'approved_merged';
  qualityScore: number;
  securityScore: number;
  coveragePct: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  summaryVerdict: string;
  complianceChecks: ComplianceCheckItem[];
  suggestedRevisions: AutomatedPrRevision[];
}

interface PrReviewStatePayload {
  autoInterceptEnabled: boolean;
  reviewerAgentName: string;
  reviewerModel: string;
  totalIntercepted: number;
  totalRevisionsApplied: number;
  totalApproved: number;
  prs: InterceptedJulesPR[];
  timestamp?: string;
}

interface AutonomousPRReviewModuleProps {
  crewName: string;
  selectedRepo: string;
  runInput: string;
  latestPrTrigger?: number | null;
  onEmitAuditLog?: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

const FALLBACK_REVIEW_STATE: PrReviewStatePayload = {
  autoInterceptEnabled: true,
  reviewerAgentName: 'Sentinel-Sec & Quality Auditor',
  reviewerModel: 'gemini/gemini-4-argon',
  totalIntercepted: 28,
  totalRevisionsApplied: 41,
  totalApproved: 26,
  prs: [
    {
      prNumber: 849,
      title: 'feat(crew): autonomous multi-agent synthesis & durable @persist flow checkpoint',
      branch: 'jules/auto-crew-849',
      repo: 'crewAIInc/crewAI',
      author: 'google-jules[bot]',
      reviewerAgent: 'Sentinel-Sec & Quality Auditor',
      reviewerModel: 'gemini/gemini-4-argon',
      interceptedAt: '2m ago',
      status: 'revisions_suggested',
      qualityScore: 93,
      securityScore: 91,
      coveragePct: 96.4,
      filesChanged: 3,
      linesAdded: 184,
      linesRemoved: 12,
      summaryVerdict:
        'Jules VM PyTest suite passed (42/42). Secondary Review Agent flagged 2 pre-merge improvements: (1) enforce message_content_text() helper instead of raw str(msg.content) for multimodal safety, and (2) redact Bearer OAuth header in debug telemetry.',
      complianceChecks: [
        {
          id: 'chk-sec-1',
          category: 'security',
          name: 'OAuth / API Secret Redaction in Logs',
          status: 'warning',
          detail: 'Found unmasked Authorization header in exception trace logger; revision patch ready.'
        },
        {
          id: 'chk-sec-2',
          category: 'security',
          name: 'Bandit SAST & Subprocess Sandbox Guard',
          status: 'passed',
          detail: '0 high/medium CVEs; no shell=True or unsafe eval() invocations.'
        },
        {
          id: 'chk-qual-1',
          category: 'quality',
          name: 'CrewAI Multimodal Message Idiom (AGENTS.md)',
          status: 'warning',
          detail: 'Direct str(msg.content) detected in callback; auto-revision replaces with message_content_text(msg).'
        },
        {
          id: 'chk-qual-2',
          category: 'quality',
          name: 'Pydantic v2 Output Contract & Minimal Diff',
          status: 'passed',
          detail: 'Strict BaseModel schema validated; diff footprint minimal (+184 / -12).'
        }
      ],
      suggestedRevisions: [
        {
          id: 'rev-849-1',
          file: 'src/crewai/utilities/agent_utils.py',
          category: 'crewai_idiom',
          severity: 'high',
          title: 'Use message_content_text() helper instead of str(msg.content)',
          rationale:
            'LLMMessage.content can be a multimodal list[dict[str, Any]] | None. Calling str() injects Python repr into agent memory.',
          beforeCode: `def format_step_preview(msg: LLMMessage) -> str:\n    return str(msg.content).strip()`,
          afterCode: `from crewai.utilities.agent_utils import message_content_text\n\ndef format_step_preview(msg: LLMMessage) -> str:\n    return message_content_text(msg).strip()`,
          applied: false
        },
        {
          id: 'rev-849-2',
          file: 'src/crewai/tools/gmail_toolkit.py',
          category: 'security',
          severity: 'medium',
          title: 'Mask Bearer token in structured audit error payload',
          rationale:
            'Prevents accidental token exposure in exported JSONL telemetry if an upstream HTTP 401/403 occurs.',
          beforeCode: `logger.debug("Gmail API headers: %s", request_headers)`,
          afterCode: `sanitized = {k: ("Bearer ***" if k.lower() == "authorization" else v) for k, v in request_headers.items()}\nlogger.debug("Gmail API headers: %s", sanitized)`,
          applied: false
        }
      ]
    }
  ]
};

export const AutonomousPRReviewModule: React.FC<AutonomousPRReviewModuleProps> = ({
  crewName,
  selectedRepo,
  runInput,
  latestPrTrigger,
  onEmitAuditLog,
  onNotify
}) => {
  const [reviewState, setReviewState] = useState<PrReviewStatePayload>(FALLBACK_REVIEW_STATE);
  const [selectedPrNumber, setSelectedPrNumber] = useState<number>(849);
  const [autoIntercept, setAutoIntercept] = useState<boolean>(true);
  const [reviewerProfile, setReviewerProfile] = useState<string>('sentinel_argon');
  const [isIntercepting, setIsIntercepting] = useState<boolean>(false);
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const fetchPrReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/jules/pr-reviews');
      if (res.ok) {
        const data: PrReviewStatePayload = await res.json();
        setReviewState(data);
        if (data.prs.length > 0 && !data.prs.some((p) => p.prNumber === selectedPrNumber)) {
          setSelectedPrNumber(data.prs[0].prNumber);
        }
      }
    } catch {
      // keep fallback state
    }
  }, [selectedPrNumber]);

  useEffect(() => {
    fetchPrReviews();
  }, [fetchPrReviews]);

  // Automatically refresh & select newly intercepted PR when Kickoff completes a 4-stage loop
  useEffect(() => {
    if (latestPrTrigger && autoIntercept) {
      fetchPrReviews().then(() => {
        setSelectedPrNumber(latestPrTrigger);
      });
    }
  }, [latestPrTrigger, autoIntercept, fetchPrReviews]);

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

  const activePr =
    reviewState.prs.find((p) => p.prNumber === selectedPrNumber) || reviewState.prs[0] || null;

  const handleInterceptNewPr = async () => {
    setIsIntercepting(true);
    const nextPrNum = 850 + Math.floor(Math.random() * 45);
    const branchName = `jules/auto-${crewName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${nextPrNum}`;

    try {
      const res = await fetch('/api/jules/pr-reviews/intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prNumber: nextPrNum,
          crewName,
          branch: branchName,
          repo: selectedRepo,
          topic: runInput,
          coveragePct: 96.8
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReviewState(data);
        if (data.interceptedPr) {
          setSelectedPrNumber(data.interceptedPr.prNumber);
          onEmitAuditLog?.({
            stage: 'github',
            severity: 'warn',
            agentName: 'Sentinel-Sec & Quality Auditor',
            type: 'github_pr',
            title: `Autonomous PR Review Intercepted PR #${data.interceptedPr.prNumber}`,
            content: `Secondary review agent audited ${data.interceptedPr.branch} (Quality: ${data.interceptedPr.qualityScore}%, Security: ${data.interceptedPr.securityScore}%) and proposed ${data.interceptedPr.suggestedRevisions.length} automated revisions prior to human approval.`,
            meta: {
              branch: data.interceptedPr.branch,
              prNumber: data.interceptedPr.prNumber,
              coveragePct: data.interceptedPr.coveragePct,
              model: reviewerProfile === 'sentinel_argon' ? 'gemini/gemini-4-argon' : 'gemini/gemini-3.8-flash'
            }
          });
          onNotify?.(
            'success',
            `Intercepted Jules PR #${data.interceptedPr.prNumber} — 2 automated compliance revisions ready for review`
          );
        }
      }
    } catch {
      // local fallback
    } finally {
      setTimeout(() => setIsIntercepting(false), 350);
    }
  };

  const handleApplyRevision = async (prNumber: number, revisionId?: string, applyAll?: boolean) => {
    setIsApplyingId(applyAll ? 'ALL' : revisionId || 'ALL');
    try {
      const res = await fetch(`/api/jules/pr-reviews/${prNumber}/apply-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId, applyAll })
      });
      if (res.ok) {
        const data = await res.json();
        setReviewState(data);
        const updated: InterceptedJulesPR | undefined = data.updatedPr;
        if (updated) {
          onEmitAuditLog?.({
            stage: 'github',
            severity: 'success',
            agentName: 'Sentinel-Sec & Quality Auditor',
            type: 'jules_heal',
            title: `Committed Automated PR Revision to PR #${prNumber} (${updated.branch})`,
            content: applyAll
              ? `Applied all ${updated.suggestedRevisions.length} secondary review patches. Quality score elevated to ${updated.qualityScore}% and Security compliance reached ${updated.securityScore}%.`
              : `Applied automated revision (${revisionId}) and re-verified AST & SAST checks on ${updated.branch}.`,
            meta: {
              branch: updated.branch,
              prNumber,
              coveragePct: updated.coveragePct,
              exitCode: 0
            }
          });
          onNotify?.(
            'success',
            `Committed automated revision to PR #${prNumber} (Quality: ${updated.qualityScore}%, Security: ${updated.securityScore}%)`
          );
        }
      }
    } catch {
      // fallback local state update
      setReviewState((prev) => ({
        ...prev,
        prs: prev.prs.map((p) => {
          if (p.prNumber !== prNumber) return p;
          const revs = p.suggestedRevisions.map((r) =>
            applyAll || r.id === revisionId ? { ...r, applied: true } : r
          );
          const allDone = revs.every((r) => r.applied);
          return {
            ...p,
            status: allDone ? 'revisions_applied' : p.status,
            qualityScore: allDone ? 99 : Math.min(99, p.qualityScore + 3),
            securityScore: allDone ? 100 : Math.min(100, p.securityScore + 4),
            suggestedRevisions: revs
          };
        })
      }));
    } finally {
      setTimeout(() => setIsApplyingId(null), 250);
    }
  };

  const handleApproveAndMerge = async (prNumber: number) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/jules/pr-reviews/${prNumber}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setReviewState(data);
        const approved: InterceptedJulesPR | undefined = data.approvedPr;
        if (approved) {
          onEmitAuditLog?.({
            stage: 'github',
            severity: 'success',
            agentName: 'GitHub PR Gatekeeper',
            type: 'github_pr',
            title: `Human Approved & Merged PR #${prNumber} (${approved.branch})`,
            content: `PR #${prNumber} passed secondary security & quality compliance (Quality: 99%, Security: 100%, Coverage: ${approved.coveragePct}%) and was approved for merge into ${approved.repo}.`,
            meta: {
              branch: approved.branch,
              prNumber,
              coveragePct: approved.coveragePct,
              exitCode: 0
            }
          });
          emitJulesPrNotification({
            eventType: 'pr_merged',
            prNumber,
            prTitle: approved.title,
            prUrl: `https://github.com/${approved.repo || selectedRepo}/pull/${prNumber}`,
            repo: approved.repo || selectedRepo,
            branch: approved.branch,
            crewName,
            coveragePct: `${approved.coveragePct}%`,
            testsPassed: 44,
            vmTier: 'standard-4core'
          });
          onNotify?.('success', `PR #${prNumber} approved and merged into ${approved.repo}!`);
        }
      }
    } catch {
      setReviewState((prev) => ({
        ...prev,
        totalApproved: prev.totalApproved + 1,
        prs: prev.prs.map((p) =>
          p.prNumber === prNumber
            ? {
                ...p,
                status: 'approved_merged',
                qualityScore: 99,
                securityScore: 100,
                suggestedRevisions: p.suggestedRevisions.map((r) => ({ ...r, applied: true }))
              }
            : p
        )
      }));
    } finally {
      setTimeout(() => setIsApproving(false), 300);
    }
  };

  const pendingRevisionsCount = activePr
    ? activePr.suggestedRevisions.filter((r) => !r.applied).length
    : 0;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/95 via-[#0B1120] to-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
            <GitPullRequest className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Autonomous PR Review & Compliance Gatekeeper
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>INTERCEPTING JULES PRs</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 text-emerald-400 border border-slate-800">
                {reviewState.totalIntercepted} Intercepted • {reviewState.totalRevisionsApplied} Auto-Revisions •{' '}
                {reviewState.totalApproved} Merged
              </span>
            </div>
            {isExpanded && (
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically intercepts Google Jules PRs, dispatches a secondary review agent for SAST security &{' '}
                <code className="text-slate-300">AGENTS.md</code> quality compliance, and prepares 1-click revisions before human approval.
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reviewer Agent Selector */}
          <select
            value={reviewerProfile}
            onChange={(e) => setReviewerProfile(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-200 outline-none focus:border-purple-400"
            title="Select Secondary Review Agent"
          >
            <option value="sentinel_argon">
              Reviewer: Sentinel-Sec & Quality Auditor (gemini-4-argon)
            </option>
            <option value="idiom_flash">
              Reviewer: CrewAI Idiom & AST Auditor (gemini-3.8-flash)
            </option>
          </select>

          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoIntercept}
              onChange={(e) => setAutoIntercept(e.target.checked)}
              className="rounded border-slate-700 text-purple-500 focus:ring-purple-500"
            />
            <span>Auto-Intercept</span>
          </label>

          <button
            type="button"
            onClick={handleInterceptNewPr}
            disabled={isIntercepting}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isIntercepting ? 'animate-spin' : ''}`} />
            <span>{isIntercepting ? 'Auditing PR...' : 'Intercept & Audit Jules PR'}</span>
          </button>

          <CardMinMaxButtons
            isMinimized={!isExpanded}
            onMinimize={() => setIsExpanded(false)}
            onExpand={() => setIsExpanded(true)}
            title="Autonomous PR Review Module"
            className="ml-auto"
          />
        </div>
      </div>

      {isExpanded && activePr && (
        <div className="space-y-4 animate-fadeIn">
          {/* Intercepted PR Queue Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {reviewState.prs.map((pr) => {
              const isSelected = pr.prNumber === activePr.prNumber;
              const statusBadge =
                pr.status === 'approved_merged'
                  ? { label: 'MERGED', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                  : pr.status === 'revisions_applied'
                  ? { label: 'READY TO APPROVE', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
                  : { label: 'REVISIONS SUGGESTED', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };

              return (
                <button
                  key={pr.prNumber}
                  type="button"
                  onClick={() => setSelectedPrNumber(pr.prNumber)}
                  className={`px-3 py-2 rounded-xl border text-left transition flex items-center gap-2.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-500/50 text-white shadow-sm'
                      : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <GitPullRequest
                    className={`w-3.5 h-3.5 ${
                      pr.status === 'approved_merged'
                        ? 'text-emerald-400'
                        : pr.status === 'revisions_applied'
                        ? 'text-blue-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>PR #{pr.prNumber}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[210px]">
                      {pr.branch} • Q:{pr.qualityScore}% S:{pr.securityScore}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected PR Summary Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">
                  PR #{activePr.prNumber}: {activePr.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-purple-300 border border-slate-800">
                  branch: {activePr.branch}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  +{activePr.linesAdded} / -{activePr.linesRemoved} lines ({activePr.filesChanged} files)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{activePr.summaryVerdict}</p>
            </div>

            {/* Action Gatekeeper Buttons */}
            <div className="flex items-center gap-2">
              {pendingRevisionsCount > 0 && activePr.status !== 'approved_merged' && (
                <button
                  type="button"
                  disabled={isApplyingId !== null}
                  onClick={() => handleApplyRevision(activePr.prNumber, undefined, true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-300" />
                  <span>Apply All Revisions ({pendingRevisionsCount})</span>
                </button>
              )}

              {activePr.status !== 'approved_merged' ? (
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => handleApproveAndMerge(activePr.prNumber)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>
                    {isApproving
                      ? 'Approving...'
                      : pendingRevisionsCount > 0
                      ? 'Apply Revisions & Approve PR'
                      : 'Human Approve & Merge PR'}
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Approved & Merged</span>
                </span>
              )}
            </div>
          </div>

          {/* Main 2-Column Split: Left Compliance Scorecard (5 cols) | Right Automated Revisions Diff (7 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Quality & Security Compliance Scorecard */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Secondary Agent Compliance Audit</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Auditor: {activePr.reviewerModel.replace('gemini/', '')}
                </span>
              </div>

              {/* 3 Score Gauges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">Quality & Idioms</div>
                  <div
                    className={`text-base font-extrabold font-mono ${
                      activePr.qualityScore >= 98 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {activePr.qualityScore}%
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">AGENTS.md</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">Security SAST</div>
                  <div
                    className={`text-base font-extrabold font-mono ${
                      activePr.securityScore >= 98 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {activePr.securityScore}%
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">Bandit / Secrets</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400">PyTest Coverage</div>
                  <div className="text-base font-extrabold font-mono text-blue-400">
                    {activePr.coveragePct}%
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">Jules Cloud VM</div>
                </div>
              </div>

              {/* Granular Compliance Checks */}
              <div className="space-y-2">
                {activePr.complianceChecks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {chk.status === 'passed' || chk.status === 'fixed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span>{chk.name}</span>
                      </span>
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${
                          chk.status === 'passed'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : chk.status === 'fixed'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {chk.status === 'fixed' ? 'AUTO-REVISED' : chk.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5">{chk.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Automated Revisions & Diffs */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <span>
                    Suggested Automated Revisions ({activePr.suggestedRevisions.length})
                  </span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {pendingRevisionsCount === 0
                    ? 'All revisions committed to PR branch'
                    : `${pendingRevisionsCount} revision(s) awaiting commit`}
                </span>
              </div>

              <div className="space-y-3">
                {activePr.suggestedRevisions.map((rev) => (
                  <div
                    key={rev.id}
                    className={`p-3 rounded-xl border space-y-2 transition ${
                      rev.applied
                        ? 'bg-emerald-950/10 border-emerald-500/30'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${
                            rev.category === 'security'
                              ? 'bg-red-500/15 text-red-300 border-red-500/30'
                              : rev.category === 'crewai_idiom'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {rev.category.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-white">{rev.title}</span>
                        <code className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {rev.file}
                        </code>
                      </div>

                      {rev.applied ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>Revision Committed</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isApplyingId !== null}
                          onClick={() => handleApplyRevision(activePr.prNumber, rev.id, false)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Apply Revision</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300">{rev.rationale}</p>

                    {/* Before / After Code Diff */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px]">
                      <div className="p-2 rounded-lg bg-red-950/20 border border-red-500/20 overflow-x-auto">
                        <div className="text-[9px] text-red-300 font-bold mb-1">
                          - Before (Jules Initial PR)
                        </div>
                        <pre className="text-red-200/90 leading-relaxed">{rev.beforeCode}</pre>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 overflow-x-auto">
                        <div className="text-[9px] text-emerald-300 font-bold mb-1">
                          + After (Secondary Agent Revision)
                        </div>
                        <pre className="text-emerald-200/90 leading-relaxed">{rev.afterCode}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
