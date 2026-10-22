import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  GitPullRequest,
  GitMerge,
  ExternalLink,
  CheckCircle2,
  X,
  Trash2,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  Cpu,
  GitBranch
} from 'lucide-react';
import {
  JulesPrNotification,
  loadJulesPrNotifications,
  saveJulesPrNotifications,
  subscribeToJulesPrNotifications,
  emitJulesPrNotification
} from '../utils/prNotifications';

interface NotificationCenterProps {
  selectedRepo?: string;
  selectedBranch?: string;
  onNavigateToGitHub?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  selectedRepo = 'bingkltech/crewAI',
  selectedBranch = 'main',
  onNavigateToGitHub
}) => {
  const [notifications, setNotifications] = useState<JulesPrNotification[]>(() =>
    loadJulesPrNotifications()
  );
  const [activeToasts, setActiveToasts] = useState<JulesPrNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'pr_completed' | 'pr_merged'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Persist notifications to localStorage
  useEffect(() => {
    saveJulesPrNotifications(notifications);
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
  }, []);

  // Subscribe to real-time Jules PR events across the app
  useEffect(() => {
    const unsubscribe = subscribeToJulesPrNotifications((incoming) => {
      setNotifications((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)].slice(0, 50));
      setActiveToasts((prev) => [incoming, ...prev.filter((t) => t.id !== incoming.id)].slice(0, 4));

      // Auto-dismiss toast after 8 seconds
      const timer = setTimeout(() => {
        dismissToast(incoming.id);
      }, 8000);
      toastTimersRef.current[incoming.id] = timer;
    });

    return () => {
      unsubscribe();
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, [dismissToast]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleSimulateJulesPr = () => {
    const randomPr = Math.floor(851 + Math.random() * 140);
    const branchSlug = `jules/auto-verified-${randomPr}`;
    emitJulesPrNotification({
      eventType: 'pr_completed',
      prNumber: randomPr,
      prTitle: `feat(agents): autonomous Jules VM test verification & AST patch (#${randomPr})`,
      prUrl: `https://github.com/${selectedRepo}/pull/${randomPr}`,
      repo: selectedRepo,
      branch: branchSlug,
      crewName: 'Autonomous DevOps & SRE Crew',
      coveragePct: '97.4%',
      testsPassed: 48,
      vmTier: 'standard-4core'
    });
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'pr_completed') return n.eventType === 'pr_completed' || n.eventType === 'pr_verified';
    if (filter === 'pr_merged') return n.eventType === 'pr_merged';
    return true;
  });

  return (
    <>
      {/* Navbar Bell Trigger + Dropdown Popover */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Open Jules PR Notification Center"
          title="Jules PR Notification Center & Real-Time Alerts"
          className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
            isOpen
              ? 'bg-slate-800 text-white border-slate-700'
              : unreadCount > 0
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <Bell className={`w-3.5 h-3.5 ${unreadCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="hidden xl:inline">Alerts</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#EB6658] text-white text-[10px] font-mono font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notification Center Popover */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 sm:w-[430px] rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <GitPullRequest className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Jules PR Notification Center</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-[#EB6658]/20 text-[#EB6658] text-[10px] font-mono">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real-time alerts when Google Jules completes or merges a PR
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulateJulesPr}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition cursor-pointer shrink-0"
                title="Trigger a live Jules PR completion toast alert"
              >
                <Sparkles className="w-3 h-3" />
                <span>Test PR Alert</span>
              </button>
            </div>

            {/* Filter & Bulk Actions Bar */}
            <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: `Unread (${unreadCount})` },
                    { id: 'pr_completed', label: 'Completed' },
                    { id: 'pr_merged', label: 'Merged' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                      filter === tab.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Read all</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="text-slate-500 hover:text-red-400 transition cursor-pointer"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/70">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No Jules PR notifications in this view.
                  </p>
                  <button
                    type="button"
                    onClick={handleSimulateJulesPr}
                    className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Simulate a completed Jules PR alert
                  </button>
                </div>
              ) : (
                filteredNotifications.map((item) => {
                  const isMerged = item.eventType === 'pr_merged';
                  return (
                    <div
                      key={item.id}
                      onClick={() => markAsRead(item.id)}
                      className={`p-3.5 transition hover:bg-slate-900/70 ${
                        !item.read ? 'bg-slate-900/40' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg mt-0.5 shrink-0 border ${
                              isMerged
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {isMerged ? (
                              <GitMerge className="w-3.5 h-3.5" />
                            ) : (
                              <GitPullRequest className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white">
                                PR #{item.prNumber}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                  isMerged
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                }`}
                              >
                                {isMerged ? 'MERGED' : 'COMPLETED'}
                              </span>
                              {item.coveragePct && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-sky-400 border border-slate-800">
                                  {item.coveragePct} cov
                                </span>
                              )}
                              {!item.read && (
                                <span className="w-2 h-2 rounded-full bg-[#EB6658]" />
                              )}
                            </div>

                            <p className="text-xs text-slate-200 font-medium mt-1 line-clamp-2">
                              {item.prTitle}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-slate-400 flex-wrap">
                              <span>{item.repo}</span>
                              <span>•</span>
                              <span className="text-slate-300 truncate max-w-[160px]">
                                {item.branch}
                              </span>
                            </div>

                            {/* Action Row with View PR link */}
                            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-800/60">
                              <span className="text-[10px] font-mono text-slate-500">
                                {item.timestamp}
                              </span>

                              <div className="flex items-center gap-2">
                                {onNavigateToGitHub && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(item.id);
                                      setIsOpen(false);
                                      onNavigateToGitHub();
                                    }}
                                    className="text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                                  >
                                    GitHub Hub
                                  </button>
                                )}
                                <a
                                  href={item.prUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(item.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 text-[11px] font-semibold transition"
                                >
                                  <span>View PR</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(item.id);
                          }}
                          className="text-slate-500 hover:text-slate-300 p-1 rounded cursor-pointer"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Floating Toast Alert Stack (Fixed Bottom-Right) */}
      {activeToasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-88 sm:w-96 pointer-events-none"
        >
          {activeToasts.map((toast) => {
            const isMerged = toast.eventType === 'pr_merged';
            return (
              <div
                key={toast.id}
                className="pointer-events-auto rounded-2xl bg-[#0B0F19]/95 backdrop-blur-md border border-slate-700/90 shadow-2xl p-4 space-y-2.5 ring-1 ring-[#EB6658]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-1.5 rounded-xl border ${
                        isMerged
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isMerged ? (
                        <GitMerge className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">
                          Jules {isMerged ? 'Merged' : 'Completed'} PR #{toast.prNumber}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {toast.vmTier || 'Cloud VM'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {toast.repo} • {toast.branch}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    aria-label="Close toast alert"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-200 font-medium line-clamp-2">
                  {toast.prTitle}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>
                      {toast.testsPassed ?? 44} tests passed ({toast.coveragePct ?? '96.8%'})
                    </span>
                  </div>

                  <a
                    href={toast.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markAsRead(toast.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition shadow-sm"
                  >
                    <span>View PR</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
