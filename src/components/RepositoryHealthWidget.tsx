import React, { useState, useEffect } from 'react';
import { GitCommit, GitPullRequest, Activity } from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

export const RepositoryHealthWidget: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/github/repository-health')
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch repository health:', err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setIsMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  if (isLoading) return <div className="text-slate-400 text-xs p-3 bg-[#0F172A] border border-slate-800 rounded-xl">Loading Repository Health...</div>;
  if (!health) return <div className="text-red-400 text-xs p-3 bg-[#0F172A] border border-slate-800 rounded-xl">Failed to load Repository Health</div>;

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Activity className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-bold text-white">
            Repository Health
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
            {health.commitFrequency}/wk • {health.prSuccessRate}% PR Success
          </span>
        </div>

        <CardMinMaxButtons
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onExpand={() => setIsMinimized(false)}
          title="Repository Health"
          className="ml-auto"
        />
      </div>

      {!isMinimized && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-800/80">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
              <GitCommit className="w-3 h-3 text-emerald-400" /> Commit Frequency
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {health.commitFrequency} <span className="text-xs text-slate-500 font-sans">/week</span>
            </div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80">
            <div className="text-slate-400 text-xs mb-1 flex items-center gap-1">
              <GitPullRequest className="w-3 h-3 text-sky-400" /> PR Success Rate
            </div>
            <div className="text-xl font-bold text-white font-mono">{health.prSuccessRate}%</div>
          </div>
        </div>
      )}
    </div>
  );
};
