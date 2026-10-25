import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  FolderGit2,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { CURATED_TARGET_REPOS, resolveRepoWorkforceProfile } from '../utils/repoWorkforceMapping';

export interface GitHubRepoOption {
  full_name: string;
  default_branch?: string;
  description?: string;
  private?: boolean;
}

interface TargetRepoSelectorProps {
  selectedRepo: string;
  selectedBranch: string;
  onSelectRepo: (repo: string) => void;
  onSelectBranch?: (branch: string) => void;
  onProjectLoaded?: (repo: string, branch: string) => void;
  variant?: 'inline' | 'banner' | 'card';
  label?: string;
}

const CUSTOM_REPOS_STORAGE_KEY = 'crewai_custom_target_repos';

function normalizeRepoInput(raw: string): { repo: string; extractedBranch?: string } {
  let cleaned = (raw || '').trim();
  if (!cleaned) return { repo: 'bingkltech/crewAI' };

  // Strip https://github.com/ prefix if user pasted a full GitHub URL
  cleaned = cleaned.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  cleaned = cleaned.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');

  // Check if URL includes /tree/<branch>
  const treeMatch = cleaned.match(/^([^/]+\/[^/]+)\/tree\/(.+)$/i);
  if (treeMatch) {
    return { repo: treeMatch[1], extractedBranch: treeMatch[2] };
  }

  // Check if input uses owner/repo@branch syntax
  if (cleaned.includes('@')) {
    const [repoPart, branchPart] = cleaned.split('@');
    const parts = repoPart.split('/').filter(Boolean);
    const repo = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : repoPart.trim();
    return { repo, extractedBranch: branchPart?.trim() || undefined };
  }

  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return { repo: `${parts[0]}/${parts[1]}` };
  }
  return { repo: cleaned };
}

export const TargetRepoSelector: React.FC<TargetRepoSelectorProps> = ({
  selectedRepo,
  selectedBranch,
  onSelectRepo,
  onSelectBranch,
  onProjectLoaded,
  variant = 'banner',
  label = 'Target Repository'
}) => {
  const [liveRepos, setLiveRepos] = useState<GitHubRepoOption[]>([]);
  const [customRepos, setCustomRepos] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_REPOS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [branches, setBranches] = useState<string[]>(['main', 'master', 'develop']);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customRepoInput, setCustomRepoInput] = useState(selectedRepo);
  const [branchInput, setBranchInput] = useState(selectedBranch || 'main');
  const [loadedBadge, setLoadedBadge] = useState<string | null>(null);

  useEffect(() => {
    setCustomRepoInput(selectedRepo);
  }, [selectedRepo]);

  useEffect(() => {
    if (selectedBranch) {
      setBranchInput(selectedBranch);
    }
  }, [selectedBranch]);

  const fetchAvailableRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const token = localStorage.getItem('crewai_github_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/github/repos', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLiveRepos(
            data
              .filter((r: any) => r && typeof r.full_name === 'string')
              .map((r: any) => ({
                full_name: r.full_name,
                default_branch: r.default_branch || 'main',
                description: r.description || '',
                private: Boolean(r.private)
              }))
          );
        }
      }
    } catch {
      // ignore network error
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const fetchRepoBranches = async (repoName: string) => {
    if (!repoName || !repoName.includes('/')) return;
    try {
      const token = localStorage.getItem('crewai_github_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/github/branches?repo=${encodeURIComponent(repoName)}`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((b: any) => b.name).filter(Boolean);
          if (names.length > 0) {
            setBranches(Array.from(new Set([...names, selectedBranch || 'main'])));
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    setBranches(Array.from(new Set(['main', 'master', 'develop', selectedBranch || 'main'])));
  };

  useEffect(() => {
    fetchAvailableRepos();
    const handlePatUpdate = () => fetchAvailableRepos();
    window.addEventListener('github-pat-updated', handlePatUpdate);
    return () => window.removeEventListener('github-pat-updated', handlePatUpdate);
  }, []);

  useEffect(() => {
    fetchRepoBranches(selectedRepo);
  }, [selectedRepo]);

  const allKnownRepos = useMemo(() => {
    const map = new Map<
      string,
      { repo: string; label: string; defaultBranch: string; source: 'github' | 'curated' | 'custom' }
    >();

    // 1. Live GitHub user repositories
    for (const r of liveRepos) {
      map.set(r.full_name.toLowerCase(), {
        repo: r.full_name,
        label: r.description
          ? `${r.full_name} — ${r.description.slice(0, 52)}`
          : `${r.full_name} (${r.private ? 'Private' : 'Public'} GitHub Repo)`,
        defaultBranch: r.default_branch || 'main',
        source: 'github'
      });
    }

    // 2. Curated Target Repositories
    for (const c of CURATED_TARGET_REPOS) {
      const key = c.displayRepo.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          repo: c.displayRepo,
          label: `${c.displayRepo} — ${c.label}`,
          defaultBranch: c.defaultBranch || 'main',
          source: 'curated'
        });
      }
    }

    // 3. Saved Custom Repositories
    for (const custom of customRepos) {
      const key = custom.toLowerCase();
      if (!map.has(key)) {
        const profile = resolveRepoWorkforceProfile(custom);
        map.set(key, {
          repo: custom,
          label: `${custom} — ${profile.label}`,
          defaultBranch: 'main',
          source: 'custom'
        });
      }
    }

    // Ensure currently selectedRepo is always in the list
    if (selectedRepo && !map.has(selectedRepo.toLowerCase())) {
      const profile = resolveRepoWorkforceProfile(selectedRepo);
      map.set(selectedRepo.toLowerCase(), {
        repo: selectedRepo,
        label: `${selectedRepo} — ${profile.label}`,
        defaultBranch: selectedBranch || 'main',
        source: 'custom'
      });
    }

    return Array.from(map.values());
  }, [liveRepos, customRepos, selectedRepo, selectedBranch]);

  const applyProjectSelection = (rawRepo: string, rawBranch?: string) => {
    const { repo, extractedBranch } = normalizeRepoInput(rawRepo);
    if (!repo) return;

    const known = allKnownRepos.find((k) => k.repo.toLowerCase() === repo.toLowerCase());
    const nextBranch =
      extractedBranch || rawBranch || known?.defaultBranch || selectedBranch || 'main';

    // Persist to custom repos if not curated or in liveRepos
    const isCurated = CURATED_TARGET_REPOS.some(
      (c) => c.displayRepo.toLowerCase() === repo.toLowerCase()
    );
    const isLive = liveRepos.some((l) => l.full_name.toLowerCase() === repo.toLowerCase());
    if (!isCurated && !isLive) {
      const updated = Array.from(new Set([repo, ...customRepos])).slice(0, 15);
      setCustomRepos(updated);
      try {
        localStorage.setItem(CUSTOM_REPOS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    localStorage.setItem('crewai_selected_repo', repo);
    localStorage.setItem('crewai_selected_branch', nextBranch);

    onSelectRepo(repo);
    if (onSelectBranch) {
      onSelectBranch(nextBranch);
    }
    if (onProjectLoaded) {
      onProjectLoaded(repo, nextBranch);
    }

    window.dispatchEvent(
      new CustomEvent('crewai:target-repo-loaded', {
        detail: { repo, branch: nextBranch }
      })
    );

    setCustomRepoInput(repo);
    setBranchInput(nextBranch);
    setIsCustomMode(false);
    setLoadedBadge(`${repo}@${nextBranch}`);
    setTimeout(() => setLoadedBadge(null), 3500);
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 text-xs">
          <FolderGit2 className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />
          <span className="text-slate-400 text-[11px] whitespace-nowrap">{label}:</span>
          {!isCustomMode ? (
            <select
              aria-label="Select Target Repository Project"
              value={selectedRepo}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomMode(true);
                } else {
                  applyProjectSelection(e.target.value);
                }
              }}
              className="bg-transparent text-white font-mono font-semibold text-xs outline-none cursor-pointer max-w-[230px] truncate"
            >
              {liveRepos.length > 0 && (
                <optgroup label="Your GitHub Repositories" className="bg-slate-950 text-slate-300">
                  {allKnownRepos
                    .filter((r) => r.source === 'github')
                    .map((r) => (
                      <option key={`gh-${r.repo}`} value={r.repo} className="bg-slate-950 text-white">
                        {r.repo}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Target Project Repositories" className="bg-slate-950 text-slate-300">
                {allKnownRepos
                  .filter((r) => r.source !== 'github')
                  .map((r) => (
                    <option key={`cur-${r.repo}`} value={r.repo} className="bg-slate-950 text-white">
                      {r.label}
                    </option>
                  ))}
              </optgroup>
              <option value="__custom__" className="bg-slate-950 text-amber-300">
                + Load Custom Project (owner/repo or URL)...
              </option>
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customRepoInput}
                onChange={(e) => setCustomRepoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyProjectSelection(customRepoInput, branchInput);
                  } else if (e.key === 'Escape') {
                    setIsCustomMode(false);
                  }
                }}
                placeholder="owner/repo or GitHub URL"
                className="bg-slate-950 text-white font-mono text-xs px-2 py-0.5 rounded border border-slate-700 outline-none focus:border-[#EB6658] w-44"
                autoFocus
              />
              <button
                type="button"
                onClick={() => applyProjectSelection(customRepoInput, branchInput)}
                className="px-2 py-0.5 rounded bg-[#EB6658] hover:bg-[#d95547] text-white text-[11px] font-bold cursor-pointer"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className="px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <span className="text-slate-600 font-mono">@</span>
          <select
            aria-label="Select Target Branch"
            value={branchInput}
            onChange={(e) => {
              const nextB = e.target.value;
              setBranchInput(nextB);
              applyProjectSelection(selectedRepo, nextB);
            }}
            className="bg-transparent text-emerald-300 font-mono text-[11px] outline-none cursor-pointer"
          >
            {branches.map((b) => (
              <option key={b} value={b} className="bg-slate-950 text-white">
                {b}
              </option>
            ))}
          </select>
        </div>

        {loadedBadge && (
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Loaded {loadedBadge}</span>
          </span>
        )}
      </div>
    );
  }

  // Banner or Card mode (used in CrewStudio, ProDashboard, and ProModeModal)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-[#EB6658]">
          <FolderGit2 className="w-4 h-4 text-[#EB6658] shrink-0" />
          <select
            aria-label="Select Target Project to Load"
            value={isCustomMode ? '__custom__' : selectedRepo}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                setIsCustomMode(true);
              } else {
                setIsCustomMode(false);
                applyProjectSelection(val);
              }
            }}
            className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none cursor-pointer"
          >
            {liveRepos.length > 0 && (
              <optgroup
                label={`Your Connected GitHub Projects (${liveRepos.length})`}
                className="bg-slate-950 text-emerald-300"
              >
                {allKnownRepos
                  .filter((r) => r.source === 'github')
                  .map((r) => (
                    <option key={`gh-${r.repo}`} value={r.repo} className="bg-slate-950 text-white">
                      {r.label}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup
              label="Curated Architecture & Crew Projects"
              className="bg-slate-950 text-amber-300"
            >
              {allKnownRepos
                .filter((r) => r.source === 'curated')
                .map((r) => (
                  <option key={`cur-${r.repo}`} value={r.repo} className="bg-slate-950 text-white">
                    {r.label}
                  </option>
                ))}
            </optgroup>
            {allKnownRepos.some((r) => r.source === 'custom') && (
              <optgroup label="Custom Loaded Projects" className="bg-slate-950 text-sky-300">
                {allKnownRepos
                  .filter((r) => r.source === 'custom')
                  .map((r) => (
                    <option key={`cus-${r.repo}`} value={r.repo} className="bg-slate-950 text-white">
                      {r.label}
                    </option>
                  ))}
              </optgroup>
            )}
            <option value="__custom__" className="bg-slate-950 text-amber-300">
              + Type / Paste Custom GitHub Repository or URL...
            </option>
          </select>
        </div>

        {/* Branch Selector / Input */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <input
            type="text"
            list="target-repo-branches-datalist"
            value={branchInput}
            onChange={(e) => setBranchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyProjectSelection(isCustomMode ? customRepoInput : selectedRepo, branchInput);
              }
            }}
            placeholder="main"
            aria-label="Target Branch"
            className="bg-transparent text-xs font-mono text-sky-300 w-24 outline-none"
          />
          <datalist id="target-repo-branches-datalist">
            {branches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>

        <button
          type="button"
          onClick={() =>
            applyProjectSelection(isCustomMode ? customRepoInput : selectedRepo, branchInput)
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer shrink-0"
          title="Load selected project repository and branch across Studio, Graphs, and Pro Mode"
        >
          <span>Load Project</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsCustomMode((prev) => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shrink-0 ${
            isCustomMode
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
          title="Enter any custom GitHub owner/repo or repository URL"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Custom Repo</span>
        </button>

        <button
          type="button"
          onClick={fetchAvailableRepos}
          disabled={isLoadingRepos}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer shrink-0"
          title="Refresh repositories from GitHub"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepos ? 'animate-spin text-[#EB6658]' : ''}`} />
        </button>

        <a
          href={`https://github.com/${selectedRepo}`}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition shrink-0"
          title={`Open ${selectedRepo} on GitHub`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Custom Repo Input Row (when toggled or when typing custom owner/repo) */}
      {isCustomMode && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-950/90 border border-amber-500/30">
          <span className="text-[11px] font-semibold text-amber-300">
            Load Any GitHub Project:
          </span>
          <input
            type="text"
            value={customRepoInput}
            onChange={(e) => setCustomRepoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyProjectSelection(customRepoInput, branchInput);
              }
            }}
            placeholder="owner/repository or https://github.com/owner/repository"
            className="flex-1 min-w-[240px] bg-slate-900 text-xs font-mono text-white px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-[#EB6658]"
            autoFocus
          />
          <button
            type="button"
            onClick={() => applyProjectSelection(customRepoInput, branchInput)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
          >
            Load &amp; Activate Project
          </button>
        </div>
      )}

      {loadedBadge && (
        <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            Active target project switched to <strong>{loadedBadge}</strong> — Workforce, 4-Graph Architecture, and Constitutional Guard synced.
          </span>
        </div>
      )}
    </div>
  );
};
