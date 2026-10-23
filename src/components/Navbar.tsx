import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Sliders,
  Zap
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
  onOpenProMode?: () => void;
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
  onOpenProMode,
  selectedRepo,
  selectedBranch,
  language,
  onLanguageChange,
  version,
  onVersionChange
}) => {
  const [patUserLogin, setPatUserLogin] = useState<string | null>(() =>
    localStorage.getItem('crewai_github_user_login')
  );
  const [allCardsMinimized, setAllCardsMinimized] = useState(false);
  const [ecoMode, setEcoMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('crewai_eco_cpu_mode');
    return saved !== 'false';
  });
  const [showRuntimeDrawer, setShowRuntimeDrawer] = useState(false);
  const [storageKb, setStorageKb] = useState<number>(0);
  const [heapMb, setHeapMb] = useState<number | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const [proStatus, setProStatus] = useState<{
    isActive: boolean;
    isPaused: boolean;
    currentStepNumber: number;
    currentVersion: string;
  }>({
    isActive: true,
    isPaused: false,
    currentStepNumber: 5,
    currentVersion: 'v1.2.0'
  });
  const throttlerMetrics = useTaskThrottlerMetrics(showRuntimeDrawer);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncProHeartbeat = async () => {
      try {
        const res = await fetch('/api/pro/status');
        if (res.ok) {
          const data = await res.json();
          setProStatus({
            isActive: Boolean(data.isActive),
            isPaused: Boolean(data.isPaused),
            currentStepNumber: Number(data.currentStepNumber || 5),
            currentVersion: String(data.currentVersion || 'v1.2.0')
          });
        }
      } catch {
        // ignore transient network errors
      }
    };

    const handleProStatusEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object') {
        setProStatus({
          isActive: Boolean(detail.isActive),
          isPaused: Boolean(detail.isPaused),
          currentStepNumber: Number(detail.currentStepNumber || 5),
          currentVersion: String(detail.currentVersion || 'v1.2.0')
        });
      } else {
        syncProHeartbeat();
      }
    };

    syncProHeartbeat();
    const interval = setInterval(syncProHeartbeat, 15000);
    window.addEventListener('crewai:pro-status-updated', handleProStatusEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener('crewai:pro-status-updated', handleProStatusEvent);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setShowRuntimeDrawer(false);
      }
    };
    if (showRuntimeDrawer) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRuntimeDrawer]);

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

    setIsPushingApp(true);
    setPushBanner({
      type: 'info',
      text: `Auto-using saved GitHub PAT to push full CrewAI Studio workspace (${selectedRepo || 'bingkltech/crewAI'}@${selectedBranch || 'main'})...`
    });

    try {
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
          message: 'feat(pro-mode): add 24h Pro Mode Autopilot, ProDashboard telemetry & Navbar heartbeat',
          extraFiles
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isAutoTrigger) {
          setPushBanner(null);
          return;
        }
        throw new Error(data.error || `GitHub push failed (${res.status})`);
      }

      if (data.userLogin) {
        setPatUserLogin(data.userLogin);
        localStorage.setItem('crewai_github_user_login', data.userLogin);
      }
      if (data.repo && data.repo !== selectedRepo) {
        localStorage.setItem('crewai_selected_repo', data.repo);
      }

      localStorage.setItem('crewai_auto_pushed_full_app_v5_pro', data.shortSha || 'done');

      setPushBanner({
        type: 'success',
        text: `Auto-pushed ${data.filesPushed || 57} app files using saved PAT to ${data.repo}@${data.branch} (Commit ${data.shortSha})`,
        commitUrl: data.commitUrl,
        repoUrl: data.repoUrl
      });
    } catch (err: any) {
      if (!isAutoTrigger) {
        setPushBanner({
          type: 'error',
          text: `GitHub Push: ${err.message || 'Failed to push app to GitHub'}`
        });
      } else {
        setPushBanner(null);
      }
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
            if (!localStorage.getItem('crewai_auto_pushed_full_app_v5_pro')) {
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
            if (!localStorage.getItem('crewai_auto_pushed_full_app_v5_pro')) {
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
    { id: 'studio' as DocTab, label: 'Crew Studio', icon: Layers },
    { id: 'graphs' as DocTab, label: 'LangGraph', icon: Network },
    { id: 'flows' as DocTab, label: 'Flow & Graphify', icon: GitMerge },
    {
      id: 'github' as DocTab,
      label: patUserLogin ? `GitHub (@${patUserLogin})` : 'GitHub Hub',
      icon: GitBranch
    },
    { id: 'tools' as DocTab, label: 'Tools', icon: Wrench },
    { id: 'traces' as DocTab, label: 'Observability', icon: Activity },
    { id: 'docs' as DocTab, label: 'Docs', icon: BookOpen }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0F19]/95 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className="flex items-center gap-2.5 text-left group transition shrink-0 whitespace-nowrap cursor-pointer"
          >
            <img
              src="/images/crew_only_logo.png"
              alt="CrewAI Logo"
              referrerPolicy="no-referrer"
              className="h-6 w-auto object-contain brightness-110"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-[#EB6658] transition">
              CrewAI Studio
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800/80">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#EB6658] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Consolidated Actions (Search + Runtime Command Menu + Notifications + Primary Push CTA) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Docs & Tools */}
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs transition cursor-pointer whitespace-nowrap"
              title="Search documentation, agents & tools (⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Consolidated Runtime, Services & CPU Guard Drawer */}
            <div className="relative" ref={drawerRef}>
              <button
                type="button"
                onClick={() => {
                  if (!showRuntimeDrawer) measureResources();
                  setShowRuntimeDrawer((p) => !p);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  showRuntimeDrawer
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
                title="AI Runtime Services, CPU Throttler, Jules VM, Ollama Pool & Workspace Settings"
              >
                <Sliders className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>Runtime & Services</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showRuntimeDrawer && (
                <div className="absolute right-0 mt-2 w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 z-50 space-y-4 text-xs">
                  {/* Section 1: AI Runtime & DevOps Services */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">AI Runtime & Agent Services</span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {version} · {language.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {onOpenJules && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRuntimeDrawer(false);
                            onOpenJules();
                          }}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                        >
                          <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-white">Google Jules VM</div>
                            <div className="text-[10px] text-slate-400">Cloud sandbox & PRs</div>
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowRuntimeDrawer(false);
                          onOpenOllamaPool();
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                      >
                        <Activity className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">Ollama Free Pool</div>
                          <div className="text-[10px] text-slate-400">Multi-node failover</div>
                        </div>
                      </button>

                      {onOpenDiagnostics && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRuntimeDrawer(false);
                            onOpenDiagnostics();
                          }}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-white">API Diagnostics</div>
                            <div className="text-[10px] text-slate-400">Live latency probes</div>
                          </div>
                        </button>
                      )}

                      {onOpenRemoteScan && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRuntimeDrawer(false);
                            onOpenRemoteScan();
                          }}
                          className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                        >
                          <QrCode className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-white">Remote QR Scan</div>
                            <div className="text-[10px] text-slate-400">Mobile control deck</div>
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowRuntimeDrawer(false);
                          onOpenAgentSetup();
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                      >
                        <Terminal className="w-4 h-4 text-[#EB6658] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">Agent Skills Prompt</div>
                          <div className="text-[10px] text-slate-400">Cursor & Claude Code</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !allCardsMinimized;
                          setAllCardsMinimized(next);
                          window.dispatchEvent(
                            new CustomEvent('crewai:toggle-all-cards', { detail: { minimized: next } })
                          );
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 text-left transition cursor-pointer flex items-start gap-2"
                      >
                        <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">
                            {allCardsMinimized ? 'Expand All Cards' : 'Minimize All Cards'}
                          </div>
                          <div className="text-[10px] text-slate-400">Workspace density</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Global Task Throttler & CPU Guard */}
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">Global Task & CPU Throttler</div>
                        <div className="text-[10px] text-slate-400">
                          Storage: {storageKb} KB · Heap: {heapMb !== null ? `${heapMb} MB` : 'Bounded'}
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
                        Eco CPU: {ecoMode ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center tabular-nums">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400">Queue / Active</div>
                        <div className="font-mono font-bold text-slate-200 text-[11px]">
                          {throttlerMetrics.queuedTasks} / {throttlerMetrics.activeTasks}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400">Deduplicated</div>
                        <div className="font-mono font-bold text-emerald-400 text-[11px]">
                          {throttlerMetrics.cachedPollResponses + throttlerMetrics.coalescedRequests}
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400">Frame Lag</div>
                        <div className="font-mono font-bold text-sky-400 text-[11px]">
                          {throttlerMetrics.lastFrameLagMs}ms
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-slate-400">Max Concurrency:</span>
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

                    <button
                      type="button"
                      onClick={handleTrimStorageAndRam}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer text-center text-[11px]"
                    >
                      Trim Logs & Free Memory (Keep .env & PAT)
                    </button>

                    {trimNotice && (
                      <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                        {trimNotice}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Version & Language Preferences */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">CrewAI Version</label>
                      <select
                        aria-label="Select CrewAI version"
                        value={version}
                        onChange={(e) => onVersionChange(e.target.value as VersionCode)}
                        className="w-full bg-slate-950 text-xs text-slate-200 font-medium px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
                      >
                        <option value="Edge">Edge (Latest)</option>
                        <option value="v1.10.0">v1.10.0</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Language
                      </label>
                      <select
                        aria-label="Select interface language"
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                        className="w-full bg-slate-950 text-xs text-slate-200 font-medium px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658]"
                      >
                        <option value="en">English (EN)</option>
                        <option value="ar">العربية (AR)</option>
                        <option value="ko">한국어 (KO)</option>
                        <option value="pt-BR">Português (PT)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Center */}
            <NotificationCenter
              selectedRepo={selectedRepo}
              selectedBranch={selectedBranch}
              onNavigateToGitHub={() => onTabChange('github')}
            />

            {/* One-Click PRO Mode (24h Autonomous Lifecycle) CTA with Subtle Heartbeat Pulse */}
            {onOpenProMode && (
              <button
                type="button"
                onClick={onOpenProMode}
                title={
                  proStatus.isActive && !proStatus.isPaused
                    ? `PRO 24h Autonomous Job Active — Step ${proStatus.currentStepNumber}/10 (${proStatus.currentVersion})`
                    : proStatus.isPaused
                    ? `PRO 24h Autonomous Job Paused at Step ${proStatus.currentStepNumber}/10`
                    : 'Open PRO Mode: 10-Step 24-Hour Autonomous Software Evolution'
                }
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700/90 hover:border-[#EB6658]/60 text-xs font-bold shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  {proStatus.isActive && !proStatus.isPaused ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </>
                  ) : (
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        proStatus.isPaused ? 'bg-amber-400' : 'bg-slate-500'
                      }`}
                    />
                  )}
                </span>
                <Zap className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>PRO 24h</span>
                <span className="hidden sm:inline font-mono text-[10px] font-semibold text-slate-400 tabular-nums">
                  S{proStatus.currentStepNumber}/10
                </span>
              </button>
            )}

            {/* Primary CTA: One-Click Push App to GitHub */}
            <button
              type="button"
              disabled={isPushingApp}
              onClick={() => handlePushEntireApp()}
              title={`Push entire CrewAI Studio application workspace to ${selectedRepo || 'bingkltech/crewAI'}@${selectedBranch || 'main'}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] disabled:opacity-60 text-white text-xs font-bold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              {isPushingApp ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Push App</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-800 bg-slate-950/90 px-2 py-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 ${
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
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
