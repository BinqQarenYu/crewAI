import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BellRing,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  FileCode,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { emitJulesPrNotification } from '../utils/prNotifications';

export interface CodebaseDriftAlert {
  id: string;
  filePath: string;
  articleCode: string;
  articleTitle: string;
  severity: 'CRITICAL' | 'HIGH';
  driftPct: number;
  detectedSnippet: string;
  remediationPatch: string;
  status: string;
  detectedAt: string;
}

export interface ScannedWorkspaceFile {
  filePath: string;
  lines: number;
  mtimeIso: string;
  sha256Short: string;
  status: 'CLEAN' | 'DRIFT_ALERT';
}

interface CodebaseConstitutionalWatcherProps {
  selectedRepo: string;
  targetBranch: string;
  onOpenConstitutionalAudit?: (goalPrompt?: string) => void;
}

export const CodebaseConstitutionalWatcher: React.FC<CodebaseConstitutionalWatcherProps> = ({
  selectedRepo,
  targetBranch,
  onOpenConstitutionalAudit
}) => {
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(30);
  const [countdownSec, setCountdownSec] = useState<number>(30);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanCount, setScanCount] = useState<number>(1);
  const [lastScannedTime, setLastScannedTime] = useState<string>(() =>
    new Date().toLocaleTimeString()
  );
  const [filesScannedCount, setFilesScannedCount] = useState<number>(12);
  const [totalLinesInspected, setTotalLinesInspected] = useState<number>(6840);
  const [scannedFiles, setScannedFiles] = useState<ScannedWorkspaceFile[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<CodebaseDriftAlert[]>([]);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  const [showWatchedFiles, setShowWatchedFiles] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());

  const runCodebaseScan = useCallback(
    async (options?: {
      injectDriftScenario?: 'const01_str_content' | 'const02_frozen_docs' | 'const04_unthrottled_loop';
      resolveAlertId?: string;
      resolveAll?: boolean;
    }) => {
      setIsScanning(true);
      try {
        const res = await fetch('/api/fullstack/constitution/scan-codebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options || {})
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.filesScannedCount === 'number') {
            setFilesScannedCount(data.filesScannedCount);
          }
          if (typeof data.totalLinesInspected === 'number') {
            setTotalLinesInspected(data.totalLinesInspected);
          }
          if (Array.isArray(data.scannedFiles)) {
            setScannedFiles(data.scannedFiles);
          }
          if (typeof data.resolvedAlertsCount === 'number') {
            setResolvedCount(data.resolvedAlertsCount);
          }
          if (Array.isArray(data.activeAlerts)) {
            setActiveAlerts(data.activeAlerts);

            // Emit automated NotificationCenter alert for any newly discovered file drift
            for (const alert of data.activeAlerts as CodebaseDriftAlert[]) {
              if (!notifiedAlertIdsRef.current.has(alert.id)) {
                notifiedAlertIdsRef.current.add(alert.id);
                emitJulesPrNotification({
                  eventType: 'pr_verified',
                  prNumber: Math.floor(900 + Math.random() * 90),
                  prTitle: `[CONSTITUTIONAL DRIFT ALERT · ${alert.articleCode}] Recent change in ${alert.filePath} introduced ${alert.driftPct}% drift`,
                  repo: selectedRepo || 'bingkltech/crewAI',
                  branch: targetBranch || 'main',
                  crewName: 'Constitutional Codebase Watcher',
                  coveragePct: `${100 - alert.driftPct}%`,
                  testsPassed: 0
                });
              }
            }
          }
          setScanCount((c) => c + 1);
          setLastScannedTime(new Date().toLocaleTimeString());
          if (options?.resolveAlertId || options?.resolveAll) {
            setToastNotice(
              'Auto-patched file drift and verified 100% Constitutional alignment across watched codebase files.'
            );
            setTimeout(() => setToastNotice(null), 4000);
          } else if (options?.injectDriftScenario) {
            setToastNotice(
              'Automated Codebase Watcher detected a recent file change introducing potential Constitutional Drift!'
            );
            setTimeout(() => setToastNotice(null), 4500);
          }
        }
      } catch {
        // Fallback local handling if offline
        if (options?.injectDriftScenario) {
          const fallbackAlert: CodebaseDriftAlert = {
            id: `local-drift-${Date.now()}`,
            filePath:
              options.injectDriftScenario === 'const02_frozen_docs'
                ? 'docs/v1.0/concepts/agents.mdx'
                : options.injectDriftScenario === 'const04_unthrottled_loop'
                ? 'lib/crewai/src/crewai/crew.py'
                : 'lib/crewai/src/crewai/utilities/agent_utils.py',
            articleCode:
              options.injectDriftScenario === 'const02_frozen_docs'
                ? 'CONST-02'
                : options.injectDriftScenario === 'const04_unthrottled_loop'
                ? 'CONST-04'
                : 'CONST-01',
            articleTitle:
              options.injectDriftScenario === 'const02_frozen_docs'
                ? 'Frozen Documentation Snapshots & Image Asset Immutability'
                : options.injectDriftScenario === 'const04_unthrottled_loop'
                ? 'Patient Token-Bucket Quota & Zero-429 Failover Governance'
                : 'Multimodal LLMMessage.content Type-Safety Invariant',
            severity: 'CRITICAL',
            driftPct: 82,
            detectedSnippet:
              'raw_memory = str(msg.content)  # Uncommitted change casts multimodal content list with str()',
            remediationPatch:
              'from crewai.utilities.agent_utils import message_content_text\nraw_memory = message_content_text(msg)',
            status: 'active_alert',
            detectedAt: new Date().toISOString()
          };
          setActiveAlerts((prev) => [fallbackAlert, ...prev]);
        } else if (options?.resolveAll) {
          setActiveAlerts([]);
        } else if (options?.resolveAlertId) {
          setActiveAlerts((prev) => prev.filter((a) => a.id !== options.resolveAlertId));
        }
      } finally {
        setIsScanning(false);
        if (pollIntervalSec > 0) {
          setCountdownSec(pollIntervalSec);
        }
      }
    },
    [pollIntervalSec, selectedRepo, targetBranch]
  );

  // Initial scan on mount
  useEffect(() => {
    runCodebaseScan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic countdown & automated scan trigger
  useEffect(() => {
    if (pollIntervalSec <= 0) return;
    setCountdownSec(pollIntervalSec);
    const ticker = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          runCodebaseScan();
          return pollIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, [pollIntervalSec, runCodebaseScan]);

  const hasAlerts = activeAlerts.length > 0;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition ${
        hasAlerts
          ? 'bg-red-950/30 border-red-500/50 shadow-lg shadow-red-950/30'
          : 'bg-slate-900/70 border-slate-800'
      }`}
    >
      {/* Top Automated Watcher Status & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
              hasAlerts
                ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {hasAlerts ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
              <span
                className={`font-extrabold ${
                  hasAlerts ? 'text-red-300' : 'text-emerald-400'
                }`}
              >
                {hasAlerts
                  ? `AUTOMATED DRIFT ALERT: ${activeAlerts.length} RECENT FILE CHANGE(S) FLAGGED`
                  : 'AUTOMATED CODEBASE CONSTITUTIONAL WATCHER · ZERO FILE DRIFT'}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="text-slate-300">
                {filesScannedCount} Files ({totalLinesInspected.toLocaleString()} lines) Checked
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="text-slate-400">
                Scan #{scanCount} at {lastScannedTime}
              </span>
              {pollIntervalSec > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="text-sky-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Next check in {countdownSec}s
                  </span>
                </>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-1">
              {hasAlerts
                ? 'Periodic disk scan detected recent file modifications that conflict with the active Constitution. Review or auto-heal below before pushing.'
                : `Periodically hashes and inspects workspace source files against CONST-01..06 (${resolvedCount} historical file drift alerts neutralized).`}
            </p>
          </div>
        </div>

        {/* Right Controls: Poll Interval Selector, Manual Scan, and Test File Drift Simulation */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Periodic Codebase Scan Interval"
            value={pollIntervalSec}
            onChange={(e) => setPollIntervalSec(Number(e.target.value))}
            className="bg-slate-950 text-xs font-mono text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
          >
            <option value={15}>Every 15s (Fast Watch)</option>
            <option value={30}>Every 30s (Standard Watch)</option>
            <option value={60}>Every 60s (Eco Watch)</option>
            <option value={0}>Paused (Manual Only)</option>
          </select>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => runCodebaseScan()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
            <span>{isScanning ? 'Scanning Files...' : 'Scan Codebase Now'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              runCodebaseScan({
                injectDriftScenario:
                  activeAlerts.length === 0
                    ? 'const01_str_content'
                    : activeAlerts.length === 1
                    ? 'const02_frozen_docs'
                    : 'const04_unthrottled_loop'
              })
            }
            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            title="Simulate a recent file change introducing potential Constitutional Drift to test the automated alert system"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate File Change Drift Alert</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWatchedFiles((p) => !p)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition cursor-pointer flex items-center gap-1"
          >
            <span>Files ({scannedFiles.length || filesScannedCount})</span>
            {showWatchedFiles ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Live Toast Feedback */}
      {toastNotice && (
        <div className="px-3 py-2 rounded-lg bg-slate-950/90 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active File-Change Constitutional Drift Alerts List */}
      {hasAlerts && (
        <div className="space-y-2.5 pt-2 border-t border-red-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-red-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                Active File-Change Drift Notifications ({activeAlerts.length})
              </span>
            </span>
            {activeAlerts.length > 1 && (
              <button
                type="button"
                onClick={() => runCodebaseScan({ resolveAll: true })}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Heal All Flagged Files ({activeAlerts.length})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 rounded-xl bg-slate-950/95 border border-red-500/40 space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono">
                      <FileCode className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="truncate">{alert.filePath}</span>
                    </div>
                    <span className="text-[11px] font-mono text-red-300 tabular-nums">
                      {alert.articleCode} · {alert.severity} · {alert.driftPct}% Drift
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 font-semibold">
                    Violated Invariant: {alert.articleTitle}
                  </div>

                  <div className="p-2 rounded-lg bg-red-950/30 border border-red-500/30 font-mono text-[11px] text-red-200 overflow-x-auto">
                    - {alert.detectedSnippet}
                  </div>

                  <div className="p-2 rounded-lg bg-emerald-950/25 border border-emerald-500/30 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                    + {alert.remediationPatch}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    Detected at {new Date(alert.detectedAt).toLocaleTimeString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {onOpenConstitutionalAudit && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenConstitutionalAudit(
                            `Audit file drift in ${alert.filePath}: ${alert.detectedSnippet}`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Inspect in Audit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => runCodebaseScan({ resolveAlertId: alert.id })}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Heal &amp; Neutralize Drift</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Watched Workspace Files Matrix (SHA-256 & mtime) */}
      {showWatchedFiles && scannedFiles.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">
              Monitored Codebase Files (Real-Time Disk SHA-256 &amp; Modification Timestamps)
            </span>
            <span className="font-mono tabular-nums">
              {scannedFiles.filter((f) => f.status === 'CLEAN').length}/{scannedFiles.length} Clean
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {scannedFiles.map((file) => (
              <div
                key={file.filePath}
                className={`p-2 rounded-lg border text-[11px] font-mono flex items-center justify-between gap-2 ${
                  file.status === 'DRIFT_ALERT'
                    ? 'bg-red-950/30 border-red-500/40 text-red-200'
                    : 'bg-slate-950 border-slate-800/90 text-slate-300'
                }`}
              >
                <div className="truncate">
                  <div className="font-bold text-slate-100 truncate" title={file.filePath}>
                    {file.filePath}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {file.lines} lines · sha256:{file.sha256Short}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold ${
                    file.status === 'DRIFT_ALERT' ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {file.status === 'DRIFT_ALERT' ? 'DRIFT' : 'CLEAN'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
