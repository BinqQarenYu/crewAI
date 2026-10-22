import React, { useState, useEffect } from 'react';
import { DocTab, LanguageCode, VersionCode } from '../types';
import { 
  BookOpen, 
  Layers, 
  GitMerge, 
  Wrench, 
  Activity, 
  Search, 
  Terminal, 
  ExternalLink,
  ChevronDown,
  Globe,
  GitBranch,
  Cpu,
  Network,
  Key,
  CheckCircle2,
  QrCode,
  UploadCloud,
  RefreshCw
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { globalTaskThrottler, useTaskThrottlerMetrics } from '../utils/taskThrottler';

interface NavbarProps {
  currentTab: DocTab;
  onTabChange: (tab: DocTab) => void;
  onOpenSearch: () => void;
  onOpenAgentSetup: () => void;
  onOpenOllamaPool: () => void;
  onOpenJules?: () => void;
  onOpenRemoteScan?: () => void;
  onOpenDiagnostics?: () => void;
  selectedRepo?: string;
  selectedBranch?: string;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  version: VersionCode;
  onVersionChange: (ver: VersionCode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenSearch,
  onOpenAgentSetup,
  onOpenOllamaPool,
  onOpenJules,
  onOpenRemoteScan,
  onOpenDiagnostics,
  selectedRepo,
  selectedBranch,
  language,
  onLanguageChange,
  version,
  onVersionChange,
}) => {
  const [patUserLogin, setPatUserLogin] = useState<string | null>(() =>
    localStorage.getItem('crewai_github_user_login')
  );
  const [allCardsMinimized, setAllCardsMinimized] = useState(false);
  const [ecoMode, setEcoMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('crewai_eco_cpu_mode');
    return saved !== 'false'; // Default ON to protect PC CPU & memory
  });
  const [showResourcePopover, setShowResourcePopover] = useState(false);
  const [storageKb, setStorageKb] = useState<number>(0);
  const [heapMb, setHeapMb] = useState<number | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const throttlerMetrics = useTaskThrottlerMetrics(showResourcePopover);

  const measureResources = () => {
    try {
      let totalChars = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        const v = localStorage.getItem(k) || '';
        totalChars += k.length + v.length;
      }
      setStorageKb(Math.round((totalChars * 2) / 1024));
    } catch {
      setStorageKb(0);
    }
    const perfMem = (performance as any)?.memory;
    if (perfMem && typeof perfMem.usedJSHeapSize === 'number') {
      setHeapMb(Math.round(perfMem.usedJSHeapSize / (1024 * 1024)));
    }
  };

  const handleToggleEcoMode = () => {
    const next = !ecoMode;
    setEcoMode(next);
    localStorage.setItem('crewai_eco_cpu_mode', String(next));
    globalTaskThrottler.setEcoMode(next);
    window.dispatchEvent(new CustomEvent('crewai:eco-mode-changed', { detail: { ecoMode: next } }));
    window.dispatchEvent(new CustomEvent('crewai:eco-mode-change', { detail: { enabled: next } }));
  };

  const handleTrimStorageAndRam = () => {
    try {
      // Trim heavy execution history to last 3 compact runs while preserving .env, PAT, and active crew
      const rawHistory = localStorage.getItem('crewai_studio_execution_history');
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const compact = parsed.slice(0, 3).map((r: any) => ({
            ...r,
            logs: Array.isArray(r.logs) ? r.logs.slice(-10) : []
          }));
          localStorage.setItem('crewai_studio_execution_history', JSON.stringify(compact));
        }
      }
      globalTaskThrottler.clearPollCache();
      window.dispatchEvent(new CustomEvent('crewai:trim-memory'));
      measureResources();
      setTrimNotice('Freed log caches, poll cache & trimmed storage (kept .env & PAT safe)');
      setTimeout(() => setTrimNotice(null), 3000);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleSyncAllCards = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setAllCardsMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleSyncAllCards);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleSyncAllCards);
  }, []);

  const [isPushingApp, setIsPushingApp] = useState(false);
  const [pushBanner, setPushBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
    commitUrl?: string;
    repoUrl?: string;
  } | null>(null);

  const extractPatFromBackupEnv = (text: string): string => {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]+$/.test(line)) return line;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim().replace(/^export\s+/, '');
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '').trim();
        if (
          /^(GITHUB_TOKEN|GITHUB_PERSONAL_ACCESS_TOKEN|GITHUB_PAT|GH_TOKEN|PAT)$/i.test(key) &&
          val &&
          !/^(fake|dummy|your_)/i.test(val)
        ) {
          return val;
        }
        if (/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]+$/.test(val)) return val;
      }
    }
    return '';
  };

  const handlePushEntireApp = async (overrideToken?: string, isAutoTrigger = false) => {
    if (isPushingApp) return;
    const backupEnv = localStorage.getItem('crewai_saved_dotenv_backup') || '';
    const token =
      (overrideToken ||
        localStorage.getItem('crewai_github_token') ||
        extractPatFromBackupEnv(backupEnv) ||
        '').trim();

    if (!token && !patUserLogin) {
      if (!isAutoTrigger) {
        onTabChange('github');
      }
      return;
    }

    setIsPushingApp(true);
    setPushBanner({
      type: 'info',
      text: `Pushing full CrewAI Studio app workspace to GitHub (${selectedRepo || 'bingkltech/crewAI'}@${selectedBranch || 'main'})...`
    });

    try {
      // Collect active crew from localStorage autosave to include in the commit
      const extraFiles: Array<{ path: string; content: string }> = [];
      try {
        const autosaved = localStorage.getItem('crewai_studio_workflow_autosave');
        if (autosaved) {
          const parsed = JSON.parse(autosaved);
          if (parsed?.crew) {
            const slug =
              String(parsed.crew.name || 'full_stack_app_crew')
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'full_stack_app_crew';
            extraFiles.push({
              path: `crews/${slug}/crew.jsonc`,
              content: JSON.stringify(parsed.crew, null, 2)
            });
          }
        }
      } catch {
        // ignore
      }

      const res = await fetch('/api/github/push-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          token: token || undefined,
          repo: selectedRepo || 'bingkltech/crewAI',
          branch: selectedBranch || 'main',
          message: 'feat(app): push full CrewAI Studio app, Full-Stack 8-Agent preset & global task throttler',
          extraFiles
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `GitHub push failed (${res.status})`);
      }

      if (data.userLogin) {
        setPatUserLogin(data.userLogin);
        localStorage.setItem('crewai_github_user_login', data.userLogin);
      }
      if (data.repo && data.repo !== selectedRepo) {
        localStorage.setItem('crewai_selected_repo', data.repo);
      }

      localStorage.setItem('crewai_auto_pushed_full_app_v3', data.shortSha || 'done');

      setPushBanner({
        type: 'success',
        text: `Pushed ${data.filesPushed || 47} app files to ${data.repo}@${data.branch} (Commit ${data.shortSha})`,
        commitUrl: data.commitUrl,
        repoUrl: data.repoUrl
      });
    } catch (err: any) {
      setPushBanner({
        type: 'error',
        text: `GitHub Push: ${err.message || 'Failed to push app to GitHub'}`
      });
    } finally {
      setIsPushingApp(false);
    }
  };

  useEffect(() => {
    const syncPatStatus = async () => {
      const backupEnv = localStorage.getItem('crewai_saved_dotenv_backup') || '';
      if (backupEnv) {
        fetch('/api/config/upload-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ envContent: backupEnv })
        }).catch(() => {});
      }

      const token =
        (localStorage.getItem('crewai_github_token') || extractPatFromBackupEnv(backupEnv) || '').trim();
      if (token && !localStorage.getItem('crewai_github_token')) {
        localStorage.setItem('crewai_github_token', token);
      }

      const savedLogin = localStorage.getItem('crewai_github_user_login');
      if (savedLogin && token) {
        setPatUserLogin(savedLogin);
      }

      try {
        if (token) {
          const connectRes = await fetch('/api/github/connect-pat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });
          if (connectRes.ok) {
            const connectData = await connectRes.json();
            if (connectData?.user?.login) {
              setPatUserLogin(connectData.user.login);
              localStorage.setItem('crewai_github_user_login', connectData.user.login);
            }
            // Auto-push full app workspace once when PAT is connected
            if (!localStorage.getItem('crewai_auto_pushed_full_app_v3')) {
              handlePushEntireApp(token, true);
            }
            return;
          }
        }

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/github/user', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data?.login) {
            setPatUserLogin(data.login);
            localStorage.setItem('crewai_github_user_login', data.login);
            if (!localStorage.getItem('crewai_auto_pushed_full_app_v3')) {
              handlePushEntireApp(token || undefined, true);
            }
            return;
          }
        }
      } catch {
        // ignore
      }
      if (!token) {
        setPatUserLogin(null);
      }
    };

    syncPatStatus();
    const handleTriggerPushApp = () => {
      handlePushEntireApp();
    };
    window.addEventListener('github-pat-updated', syncPatStatus);
    window.addEventListener('crewai:push-entire-app', handleTriggerPushApp);
    return () => {
      window.removeEventListener('github-pat-updated', syncPatStatus);
      window.removeEventListener('crewai:push-entire-app', handleTriggerPushApp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    { id: 'docs' as DocTab, label: 'Documentation', icon: BookOpen },
    { id: 'studio' as DocTab, label: 'Crew Studio', icon: Layers, badge: 'Interactive' },
    { id: 'graphs' as DocTab, label: 'Graphs', icon: Network, badge: 'LangGraph' },
    { id: 'flows' as DocTab, label: 'Flow & Graphify', icon: GitMerge, badge: 'Repo Graph' },
    {
      id: 'github' as DocTab,
      label: 'GitHub Hub',
      icon: GitBranch,
      badge: patUserLogin ? `@${patUserLogin}` : 'PAT Connect'
    },
    { id: 'tools' as DocTab, label: 'Tools Catalog', icon: Wrench, count: '18+' },
    { id: 'traces' as DocTab, label: 'Observability', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0F19]/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('docs')}
              className="flex items-center gap-2.5 text-left group transition"
            >
              <img
                src="/images/crew_only_logo.png"
                alt="CrewAI Logo"
                className="h-7 w-auto object-contain brightness-110"
                onError={(e) => {
                  // Fallback if image fails to render
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#EB6658] transition flex items-center gap-1.5">
                CrewAI
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#EB6658]/15 text-[#EB6658] font-semibold border border-[#EB6658]/30">
                  {version}
                </span>
              </span>
            </button>

            {/* Version dropdown */}
            <div className="relative hidden md:block">
              <select
                aria-label="Select CrewAI version"
                value={version}
                onChange={(e) => onVersionChange(e.target.value as VersionCode)}
                className="bg-slate-900 text-xs text-slate-300 font-medium px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 cursor-pointer outline-none focus:border-[#EB6658]"
              >
                <option value="Edge">Edge (Latest)</option>
                <option value="v1.10.0">v1.10.0</option>
              </select>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-[#EB6658] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#EB6658]/20 text-[#EB6658]'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.count && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Section */}
          <div className="flex items-center gap-2">
            {/* Global Card Single Stateful (-) / (+) Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !allCardsMinimized;
                setAllCardsMinimized(next);
                window.dispatchEvent(
                  new CustomEvent('crewai:toggle-all-cards', { detail: { minimized: next } })
                );
              }}
              className={`px-2 h-6 rounded-lg text-xs font-mono font-extrabold transition flex items-center justify-center cursor-pointer leading-none shadow-sm ${
                allCardsMinimized
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-slate-950/90 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700/90 hover:border-amber-500/40'
              }`}
              title={allCardsMinimized ? 'Expand All Cards (+)' : 'Minimize All Cards (-)'}
            >
              {allCardsMinimized ? '(+)' : '(-)'}
            </button>

            {/* PC CPU / Memory / Storage Guard */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!showResourcePopover) measureResources();
                  setShowResourcePopover((p) => !p);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  ecoMode
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
                title="CPU, Memory & Storage Resource Guard (Prevents browser freezes & high CPU)"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">{ecoMode ? 'Eco CPU' : 'Full Polling'}</span>
              </button>

              {showResourcePopover && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 z-50 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      PC Resource & Anti-Freeze Guard
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResourcePopover(false)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white font-mono text-[10px]"
                    >
                      (-)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Browser Storage</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">
                        {storageKb} KB <span className="text-[10px] text-slate-500">/ 5120 KB</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">JS Heap RAM</div>
                      <div className="text-sm font-mono font-bold text-sky-400">
                        {heapMb !== null ? `${heapMb} MB` : 'Bounded'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-200">Zero-Idle CPU Mode</div>
                        <div className="text-[10px] text-slate-400">
                          Pauses background timers & DOM polling when idle
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleEcoMode}
                        className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] cursor-pointer ${
                          ecoMode
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {ecoMode ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Global Task & API Polling Throttler Telemetry */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">Global Task Throttler</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          throttlerMetrics.heavyOpsCount > 0 || throttlerMetrics.isCongested
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {throttlerMetrics.heavyOpsCount > 0
                          ? `Heavy Op Lock (${throttlerMetrics.pollingMultiplier}x Backoff)`
                          : `Active (${throttlerMetrics.pollingMultiplier}x Pace)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800/80">
                        <div className="text-[9px] text-slate-400">Queue / Active</div>
                        <div className="font-mono font-bold text-slate-200 text-[11px]">
                          {throttlerMetrics.queuedTasks} / {throttlerMetrics.activeTasks}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800/80">
                        <div className="text-[9px] text-slate-400">Deduplicated</div>
                        <div className="font-mono font-bold text-emerald-400 text-[11px]">
                          {throttlerMetrics.cachedPollResponses + throttlerMetrics.coalescedRequests}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800/80">
                        <div className="text-[9px] text-slate-400">Frame Lag</div>
                        <div className="font-mono font-bold text-sky-400 text-[11px]">
                          {throttlerMetrics.lastFrameLagMs}ms
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">Max Concurrent Tasks:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 4, 6].map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            onClick={() => globalTaskThrottler.setMaxConcurrency(limit)}
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer transition ${
                              throttlerMetrics.maxConcurrency === limit
                                ? 'bg-[#EB6658] text-white'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {limit}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTrimStorageAndRam}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 font-semibold transition cursor-pointer text-center"
                  >
                    Trim Old Logs & Free Memory (Keep .env & PAT)
                  </button>

                  {trimNotice && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                      {trimNotice}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition group"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#EB6658]" />
              <span className="hidden sm:inline">Search docs...</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Ollama Cloud Free Pool Button */}
            <button
              onClick={onOpenOllamaPool}
              title="Continuous Free Credit Flow & Ollama Multi-Node Failover"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">Ollama Free Pool</span>
            </button>

            {/* Google Jules DevOps Agent Button */}
            {onOpenJules && (
              <button
                onClick={onOpenJules}
                title="Google Jules Autonomous DevOps & Coding Agent in Cloud VM Sandbox"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Google Jules</span>
              </button>
            )}

            {/* Google Antigravity Remote via Scan Button */}
            {onOpenRemoteScan && (
              <button
                onClick={onOpenRemoteScan}
                title="Google Antigravity Remote via Scan — Pair phone via QR code or optical scanner to control workspace remotely"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Remote Scan</span>
              </button>
            )}

            {/* Jules PR Notification Center & Real-Time Toast Alert Manager */}
            <NotificationCenter
              selectedRepo={selectedRepo}
              selectedBranch={selectedBranch}
              onNavigateToGitHub={() => onTabChange('github')}
            />

            {/* GitHub PAT Status & Quick-Connect Button */}
            <button
              onClick={() => onTabChange('github')}
              title={
                patUserLogin
                  ? `GitHub PAT Connected as @${patUserLogin} — Click to manage PAT & repo sync`
                  : 'Connect to GitHub using a Personal Access Token (PAT)'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                patUserLogin
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/40'
              }`}
            >
              {patUserLogin ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">PAT: @{patUserLogin}</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 text-[#EB6658]" />
                  <span className="hidden sm:inline">GitHub PAT</span>
                </>
              )}
            </button>

            {/* One-Click Push Entire App to GitHub Button */}
            <button
              type="button"
              disabled={isPushingApp}
              onClick={() => handlePushEntireApp()}
              title={`Push entire CrewAI Studio application workspace (all 47+ source files) to ${selectedRepo || 'bingkltech/crewAI'}@${selectedBranch || 'main'} via PAT`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#EB6658] to-[#C94C3C] hover:brightness-110 disabled:opacity-60 text-white text-xs font-bold shadow-sm shadow-[#EB6658]/20 transition cursor-pointer"
            >
              {isPushingApp ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Pushing App...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Push App</span>
                </>
              )}
            </button>

            {/* API Diagnostics Live Probes Button */}
            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                title="Test all APIs, check live latency & model availability"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">API Health</span>
              </button>
            )}

            {/* Coding Agent Skills Button */}
            <button
              onClick={onOpenAgentSetup}
              title="Copy Agent Skills Prompt for Claude Code, Cursor, Windsurf"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6658]/10 hover:bg-[#EB6658]/20 text-[#EB6658] border border-[#EB6658]/30 text-xs font-semibold transition"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agent Skills</span>
            </button>

            {/* Language Switcher */}
            <div className="relative">
              <select
                aria-label="Select interface language"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="bg-slate-900 text-xs text-slate-300 font-medium pl-6 pr-2 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer outline-none focus:border-[#EB6658] appearance-none"
              >
                <option value="en">EN</option>
                <option value="ar">AR (العربية)</option>
                <option value="ko">KO (한국어)</option>
                <option value="pt-BR">PT (Português)</option>
              </select>
              <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
            </div>

            {/* GitHub Repo */}
            <a
              href="https://github.com/crewAIInc/crewAI"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="CrewAI on GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-800 bg-slate-950/80 px-2 py-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                isActive ? 'text-[#EB6658] font-semibold bg-[#EB6658]/10' : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Live GitHub Full-App Push Status Banner */}
      {pushBanner && (
        <div
          className={`px-4 sm:px-8 py-2 border-t text-xs flex items-center justify-between gap-3 ${
            pushBanner.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : pushBanner.type === 'error'
              ? 'bg-red-950/90 border-red-500/30 text-red-200'
              : 'bg-sky-950/90 border-sky-500/30 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {pushBanner.type === 'info' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            ) : pushBanner.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Key className="w-3.5 h-3.5 text-red-400 shrink-0" />
            )}
            <span className="font-medium truncate">{pushBanner.text}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {pushBanner.commitUrl && (
              <a
                href={pushBanner.commitUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline font-semibold text-emerald-300 hover:text-white"
              >
                <span>View Commit</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {pushBanner.repoUrl && (
              <a
                href={pushBanner.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline font-semibold text-sky-300 hover:text-white"
              >
                <span>Open Repo</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setPushBanner(null)}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 hover:text-white cursor-pointer"
            >
              (-)
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
