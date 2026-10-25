import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  Terminal,
  Cpu,
  Search,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Layers,
  Sparkles,
  FileCode,
  HardDrive
} from 'lucide-react';
import { CrewConfig } from '../types';

interface FullstackRuntimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCrew?: CrewConfig;
  selectedRepo?: string;
  selectedBranch?: string;
}

type FullstackPillarTab = 'sqlite_db' | 'code_sandbox' | 'real_ast' | 'server_orchestrator' | 'rag_search';

const PRESET_SANDBOX_SCRIPTS: Record<string, { label: string; language: 'python' | 'javascript'; code: string }> = {
  crewai_msg_test: {
    label: 'CrewAI message_content_text Unit Test (Pass)',
    language: 'python',
    code: `import unittest
import sys

def message_content_text(msg):
    """Collapse str | list[dict] | None safely without str() repr leakage."""
    if msg is None:
        return ""
    if isinstance(msg, str):
        return msg
    if isinstance(msg, list):
        texts = []
        for part in msg:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                if part["text"]:
                    texts.append(part["text"])
        return "\\n".join(texts) if texts else "[multimodal content]"
    return ""

class TestCrewAIMessageHelper(unittest.TestCase):
    def test_none_returns_empty(self):
        self.assertEqual(message_content_text(None), "")

    def test_multimodal_parts_joined(self):
        parts = [{"type": "text", "text": "Hello"}, {"type": "text", "text": "CrewAI"}]
        self.assertEqual(message_content_text(parts), "Hello\\nCrewAI")

    def test_non_string_text_skipped_gracefully(self):
        parts = [{"type": "image_url", "text": 12345}]
        self.assertEqual(message_content_text(parts), "[multimodal content]")

if __name__ == "__main__":
    print(f"Running on real Python {sys.version.split()[0]} runtime...")
    unittest.main(verbosity=2)
`
  },
  broken_self_heal: {
    label: 'Broken Python Script (Test Auto Self-Healing)',
    language: 'python',
    code: `# This script intentionally fails with ZeroDivisionError so you can test
# Pillar 2's Real Exit-Code Self-Healing Loop!
def calculate_throughput(tasks_completed, elapsed_seconds):
    return tasks_completed / elapsed_seconds

if __name__ == "__main__":
    rate = calculate_throughput(42, 0)
    print(f"Verified throughput rate: {rate}")
`
  },
  node_esm_check: {
    label: 'Node.js v22 Native SQLite & OS Verification',
    language: 'javascript',
    code: `import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const memDb = new DatabaseSync(':memory:');
memDb.exec('CREATE TABLE verify (id INTEGER PRIMARY KEY, label TEXT);');
memDb.prepare('INSERT INTO verify (label) VALUES (?)').run('Node v22 SQLite ACID Ready');
const row = memDb.prepare('SELECT * FROM verify').get();

console.log(JSON.stringify({
  nodeVersion: process.version,
  platform: os.platform(),
  arch: os.arch(),
  cpus: os.cpus().length,
  sqliteRow: row
}, null, 2));
`
  }
};

export const FullstackRuntimeModal: React.FC<FullstackRuntimeModalProps> = ({
  isOpen,
  onClose,
  activeCrew,
  selectedRepo = 'BinqQarenYu/crewAI',
  selectedBranch = 'main'
}) => {
  const [activeTab, setActiveTab] = useState<FullstackPillarTab>('sqlite_db');
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Pillar 1: SQLite Query State
  const [sqlInput, setSqlInput] = useState<string>(
    'SELECT id, language, entrypoint, exit_code, duration_ms, healed_attempts, created_at FROM sandbox_executions ORDER BY created_at DESC LIMIT 10;'
  );
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlLoading, setSqlLoading] = useState(false);

  // Pillar 2: Code Execution Sandbox State
  const [sandboxLang, setSandboxLang] = useState<'python' | 'javascript'>('python');
  const [sandboxCode, setSandboxCode] = useState<string>(PRESET_SANDBOX_SCRIPTS.crewai_msg_test.code);
  const [selfHealEnabled, setSelfHealEnabled] = useState<boolean>(true);
  const [sandboxRunning, setSandboxRunning] = useState<boolean>(false);
  const [sandboxOutput, setSandboxOutput] = useState<any>(null);

  // Pillar 3: Real AST State
  const [astData, setAstData] = useState<any>(null);
  const [astScanning, setAstScanning] = useState<boolean>(false);

  // Pillar 4: Server Orchestrator State
  const [orchTopic, setOrchTopic] = useState<string>(
    'Verify CrewAI multimodal message_content_text helper and generate unit test suite'
  );
  const [orchRunning, setOrchRunning] = useState<boolean>(false);
  const [orchRuns, setOrchRuns] = useState<any[]>([]);

  // Pillar 5: Real RAG Search State
  const [ragQuery, setRagQuery] = useState<string>('message_content_text multimodal');
  const [ragResults, setRagResults] = useState<any>(null);
  const [ragSearching, setRagSearching] = useState<boolean>(false);
  const [ragIndexing, setRagIndexing] = useState<boolean>(false);

  const fetchFullstackStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/fullstack/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const handleRunSql = useCallback(async (overrideSql?: string) => {
    const queryToRun = overrideSql || sqlInput;
    setSqlLoading(true);
    try {
      const res = await fetch('/api/fullstack/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: queryToRun })
      });
      const data = await res.json();
      setSqlResult(data);
      fetchFullstackStatus();
    } catch (err: any) {
      setSqlResult({ ok: false, error: err?.message || 'SQL request failed' });
    } finally {
      setSqlLoading(false);
    }
  }, [sqlInput, fetchFullstackStatus]);

  const handleExecuteSandbox = async () => {
    setSandboxRunning(true);
    try {
      const res = await fetch('/api/fullstack/sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: sandboxLang,
          code: sandboxCode,
          selfHeal: selfHealEnabled
        })
      });
      const data = await res.json();
      setSandboxOutput(data);
      if (data.codeContent && data.healedAttempts > 1) {
        setSandboxCode(data.codeContent);
      }
      fetchFullstackStatus();
    } catch (err: any) {
      setSandboxOutput({ ok: false, error: err?.message || 'Sandbox execution failed' });
    } finally {
      setSandboxRunning(false);
    }
  };

  const handleLoadAst = useCallback(async (forceRescan = false) => {
    setAstScanning(true);
    try {
      const res = await fetch(forceRescan ? '/api/fullstack/ast/scan' : '/api/fullstack/ast/latest', {
        method: forceRescan ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: forceRescan ? JSON.stringify({ maxFiles: 38 }) : undefined
      });
      const data = await res.json();
      setAstData(data);
      fetchFullstackStatus();
    } catch {
      // ignore
    } finally {
      setAstScanning(false);
    }
  }, [fetchFullstackStatus]);

  const handleLoadOrchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/fullstack/orchestrator/runs');
      if (res.ok) {
        const data = await res.json();
        setOrchRuns(data.runs || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleStartServerRun = async () => {
    setOrchRunning(true);
    try {
      const res = await fetch('/api/fullstack/orchestrator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crew: activeCrew,
          topic: orchTopic,
          repo: selectedRepo,
          branch: selectedBranch
        })
      });
      const data = await res.json();
      if (data.ok && data.run) {
        setOrchRuns((prev) => [data.run, ...prev]);
      }
      fetchFullstackStatus();
    } catch {
      // ignore
    } finally {
      setOrchRunning(false);
    }
  };

  const handleSearchRag = useCallback(async (qOverride?: string) => {
    setRagSearching(true);
    try {
      const res = await fetch('/api/fullstack/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: qOverride || ragQuery, topK: 6 })
      });
      const data = await res.json();
      setRagResults(data);
    } catch {
      // ignore
    } finally {
      setRagSearching(false);
    }
  }, [ragQuery]);

  const handleReindexRag = async () => {
    setRagIndexing(true);
    try {
      await fetch('/api/fullstack/rag/index', { method: 'POST' });
      await handleSearchRag();
      fetchFullstackStatus();
    } finally {
      setRagIndexing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchFullstackStatus();
    handleRunSql();
    handleLoadAst(false);
    handleLoadOrchRuns();
    handleSearchRag();
  }, [isOpen, fetchFullstackStatus, handleRunSql, handleLoadAst, handleLoadOrchRuns, handleSearchRag]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F1626] border border-emerald-500/30 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  True Fullstack Backend Engine (5-Pillar Live Console)
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {statusData?.nodeVersion || 'Node v22.23.3'} • {statusData?.pythonRuntime || 'Python 3.10.12'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real ACID SQLite (`node:sqlite` `.crewai-fullstack.db`) • Real `child_process` Python/Node Sandbox • Real Disk AST • Server Orchestrator • SQLite RAG
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFullstackStatus}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh Telemetry
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Live SQLite & Runtime Metrics Strip */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> SQLite File
            </span>
            <span className="font-mono font-semibold text-emerald-300">
              {statusData?.dbSizeKb ?? '—'} KB
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Saved Crews</span>
            <span className="font-mono font-semibold text-white">{statusData?.tables?.crews ?? 0}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Sandbox Runs</span>
            <span className="font-mono font-semibold text-amber-300">
              {statusData?.tables?.sandbox_executions ?? 0}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Server Runs</span>
            <span className="font-mono font-semibold text-cyan-300">
              {statusData?.tables?.execution_runs ?? 0}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">AST Snapshots</span>
            <span className="font-mono font-semibold text-purple-300">
              {statusData?.tables?.ast_snapshots ?? 0}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">RAG Chunks</span>
            <span className="font-mono font-semibold text-indigo-300">
              {statusData?.tables?.rag_chunks ?? 0}
            </span>
          </div>
        </div>

        {/* 5 Pillar Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap gap-2">
          {[
            { id: 'sqlite_db', label: '1. ACID SQLite DB', icon: Database },
            { id: 'code_sandbox', label: '2. Real Python/Node Sandbox & Healer', icon: Terminal },
            { id: 'real_ast', label: '3. Real Disk AST Parser', icon: Code2 },
            { id: 'server_orchestrator', label: '4. Server Multi-Agent Orchestrator', icon: Layers },
            { id: 'rag_search', label: '5. Real SQLite RAG & Code Search', icon: Search }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as FullstackPillarTab)}
                className={`px-3.5 py-2 rounded-t-lg text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* PILLAR 1: SQLITE DB */}
          {activeTab === 'sqlite_db' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Live SQLite Database Inspector (`.crewai-fullstack.db`)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Run real SQL `SELECT` or `PRAGMA` queries against the server&apos;s ACID SQLite database.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'Sandbox Runs',
                      sql: 'SELECT id, language, entrypoint, exit_code, duration_ms, healed_attempts, created_at FROM sandbox_executions ORDER BY created_at DESC LIMIT 10;'
                    },
                    {
                      label: 'Saved Crews',
                      sql: 'SELECT id, name, process, updated_at FROM crews ORDER BY updated_at DESC;'
                    },
                    {
                      label: 'Server Orchestrator Runs',
                      sql: 'SELECT id, crew_name, repo, branch, status, current_step, total_steps, exit_code, duration_ms, started_at FROM execution_runs ORDER BY started_at DESC LIMIT 10;'
                    },
                    {
                      label: 'RAG Chunks',
                      sql: 'SELECT id, file_path, start_line, end_line, symbol_name, indexed_at FROM rag_chunks LIMIT 15;'
                    },
                    {
                      label: 'SQLite Tables',
                      sql: "SELECT name, type FROM sqlite_master WHERE type='table';"
                    }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setSqlInput(preset.sql);
                        handleRunSql(preset.sql);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleRunSql()}
                  disabled={sqlLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {sqlLoading ? 'Querying...' : 'Run SQL'}
                </button>
              </div>

              {sqlResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                  {sqlResult.ok ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>
                          Returned <strong className="text-white">{sqlResult.rowCount}</strong> row(s) in{' '}
                          <strong className="text-emerald-400">{sqlResult.durationMs}ms</strong>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">{sqlResult.sql}</span>
                      </div>
                      <pre className="text-xs font-mono text-slate-200 max-h-72 overflow-y-auto">
                        {JSON.stringify(sqlResult.rows, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <div className="text-xs text-rose-400 font-mono">{sqlResult.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PILLAR 2: REAL CODE SANDBOX & SELF-HEALER */}
          {activeTab === 'code_sandbox' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Real `child_process` Python 3.10.12 & Node v22 Execution Sandbox
                  </h3>
                  <p className="text-xs text-slate-400">
                    Writes real files to `.runtime_sandbox/`, executes `python3` or `node`, captures real `stdout`/`stderr`/exit codes, and auto-heals broken code on failure.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(PRESET_SANDBOX_SCRIPTS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSandboxLang(item.language);
                        setSandboxCode(item.code);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] border border-slate-700"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-300 font-medium">Runtime:</label>
                  <select
                    value={sandboxLang}
                    onChange={(e) => setSandboxLang(e.target.value as 'python' | 'javascript')}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="python">Python 3.10.12 (python3)</option>
                    <option value="javascript">Node.js v22.23.3 ES Module (node)</option>
                  </select>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      checked={selfHealEnabled}
                      onChange={(e) => setSelfHealEnabled(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Enable Real Exit-Code Self-Healing Loop (if exit code != 0)
                  </label>
                </div>

                <button
                  onClick={handleExecuteSandbox}
                  disabled={sandboxRunning}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  {sandboxRunning ? 'Executing in Process Sandbox...' : 'Execute on Server Now'}
                </button>
              </div>

              <textarea
                value={sandboxCode}
                onChange={(e) => setSandboxCode(e.target.value)}
                rows={11}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-emerald-200 focus:outline-none focus:border-emerald-500"
              />

              {sandboxOutput && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {sandboxOutput.exitCode === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> EXIT CODE 0 (PASSED)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> EXIT CODE {sandboxOutput.exitCode}
                        </span>
                      )}
                      <span className="text-slate-400 font-mono">
                        Command: {sandboxOutput.command} • Duration: {sandboxOutput.durationMs}ms • Attempts: {sandboxOutput.healedAttempts}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">ID: {sandboxOutput.id}</span>
                  </div>

                  {sandboxOutput.stdout && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Real Process STDOUT</div>
                      <pre className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto">
                        {sandboxOutput.stdout}
                      </pre>
                    </div>
                  )}

                  {sandboxOutput.stderr && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1">Real Process STDERR</div>
                      <pre className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono text-amber-200 overflow-x-auto">
                        {sandboxOutput.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PILLAR 3: REAL DISK AST PARSER */}
          {activeTab === 'real_ast' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Real Python `ast` + TypeScript Codebase Scanner
                  </h3>
                  <p className="text-xs text-slate-400">
                    Parses actual `.py`, `.ts`, and `.tsx` files on disk, extracting true line counts, classes, functions, cyclomatic complexity, and import edges.
                  </p>
                </div>
                <button
                  onClick={() => handleLoadAst(true)}
                  disabled={astScanning}
                  className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${astScanning ? 'animate-spin' : ''}`} />
                  {astScanning ? 'Scanning Disk AST...' : 'Rescan Disk AST Now'}
                </button>
              </div>

              {astData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Parsed Disk Files</div>
                      <div className="text-lg font-bold text-white font-mono">{astData.totalFiles}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Total Source Lines</div>
                      <div className="text-lg font-bold text-emerald-300 font-mono">{astData.totalLines}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Classes / Interfaces</div>
                      <div className="text-lg font-bold text-purple-300 font-mono">{astData.totalClasses}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Functions / Methods</div>
                      <div className="text-lg font-bold text-cyan-300 font-mono">{astData.totalFunctions}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                      {(astData.nodes || []).map((node: any) => (
                        <div key={node.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-900/50">
                          <div className="flex items-center gap-2.5">
                            <FileCode className={`w-4 h-4 ${node.language === 'python' ? 'text-amber-400' : 'text-cyan-400'}`} />
                            <div>
                              <div className="font-mono font-semibold text-white">{node.path}</div>
                              <div className="text-[11px] text-slate-400">
                                Classes: {node.classes?.slice(0, 4).join(', ') || 'none'} • Functions: {node.functions?.slice(0, 5).join(', ') || 'none'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                              {node.lines} lines
                            </span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              Complexity: {node.complexity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PILLAR 4: SERVER-SIDE MULTI-AGENT ORCHESTRATOR */}
          {activeTab === 'server_orchestrator' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Server-Side Multi-Agent Orchestrator (`/api/fullstack/orchestrator/start`)
                </h3>
                <p className="text-xs text-slate-400">
                  Runs your Crew entirely on the backend server, generates real `.py` and `.md` artifacts in `.runtime_sandbox/runs/`, executes unit verification via `python3`, and stores results in SQLite.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={orchTopic}
                  onChange={(e) => setOrchTopic(e.target.value)}
                  placeholder="Enter engineering objective for server-side execution..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleStartServerRun}
                  disabled={orchRunning}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  {orchRunning ? 'Running on Backend...' : 'Launch Server Run'}
                </button>
              </div>

              <div className="space-y-3">
                {orchRuns.map((run) => (
                  <div key={run.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                          {run.status.toUpperCase()} (exit={run.exitCode})
                        </span>
                        <span className="font-bold text-white">{run.crewName}</span>
                        <span className="text-slate-400 font-mono">
                          • {run.currentStep}/{run.totalSteps} steps • {run.durationMs}ms
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">{run.id}</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      <strong>Topic:</strong> {run.topic}
                    </div>
                    {Array.isArray(run.logs) && run.logs.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {run.logs.map((lg: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-cyan-300">
                                Step {lg.step}: {lg.taskName}
                              </span>
                              <span className="font-mono text-[11px] text-emerald-400">
                                exit={lg.exitCode} ({lg.durationMs}ms)
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Agent: {lg.agentName} • {lg.providerUsed}
                            </div>
                            {lg.stdout && (
                              <pre className="text-[11px] font-mono text-emerald-200 bg-slate-950 p-1.5 rounded overflow-x-auto">
                                {lg.stdout}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PILLAR 5: REAL SQLITE RAG & CODE SEARCH */}
          {activeTab === 'rag_search' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Real SQLite BM25/TF-IDF Codebase RAG Engine (`rag_chunks`)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Indexes actual source files (`lib/crewai/src/crewai`, `src/`, `server.ts`) into SQLite and retrieves exact line ranges and symbols by BM25/IDF score.
                  </p>
                </div>
                <button
                  onClick={handleReindexRag}
                  disabled={ragIndexing}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ragIndexing ? 'animate-spin' : ''}`} />
                  {ragIndexing ? 'Re-indexing Disk Files...' : 'Re-index Workspace'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="Search codebase symbols, functions, or concepts (e.g. message_content_text, executePatientGeminiOrOllama)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleSearchRag()}
                  disabled={ragSearching}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  {ragSearching ? 'Searching...' : 'Search RAG Corpus'}
                </button>
              </div>

              {ragResults?.results && (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-400">
                    Searched <strong className="text-white">{ragResults.totalCorpusChunks}</strong> indexed chunks in SQLite • Top matches:
                  </div>
                  {ragResults.results.map((hit: any) => (
                    <div key={hit.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-mono font-semibold text-indigo-300">
                          {hit.filePath}:{hit.startLine}-{hit.endLine} <span className="text-slate-400">({hit.symbolName})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[11px]">
                          BM25 Score: {hit.score}
                        </span>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto max-h-40">
                        {hit.snippet}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
