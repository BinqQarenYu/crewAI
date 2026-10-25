import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  FolderGit2,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowRight,
  ExternalLink,
  Search,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CURATED_TARGET_REPOS, resolveRepoWorkforceProfile } from '../utils/repoWorkforceMapping';

export interface GitHubRepoOption {
  id?: number;
  name?: string;
  full_name: string;
  default_branch?: string;
  description?: string;
  private?: boolean;
  language?: string;
  updated_at?: string;
  html_url?: string;
  owner_login?: string;
}

interface PatUserSummary {
  login: string;
  name?: string;
  avatar_url?: string;
  public_repos?: number;
  total_private_repos?: number;
  tokenType?: string;
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

  cleaned = cleaned.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  cleaned = cleaned.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');

  const treeMatch = cleaned.match(/^([^/]+\/[^/]+)\/tree\/(.+)$/i);
  if (treeMatch) {
    return { repo: treeMatch[1], extractedBranch: treeMatch[2] };
  }

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
  const [patUser, setPatUser] = useState<PatUserSummary | null>(null);
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
  const [showPatRepoGrid, setShowPatRepoGrid] = useState(true);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
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

  const fetchPatAccountAndRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const token = localStorage.getItem('crewai_github_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [userRes, reposRes] = await Promise.all([
        fetch('/api/github/user', { headers }).catch(() => null),
        fetch('/api/github/repos', { headers }).catch(() => null)
      ]);

      if (userRes && userRes.ok) {
        const uData = await userRes.json().catch(() => null);
        if (uData && uData.login) {
          setPatUser({
            login: uData.login,
            name: uData.name,
            avatar_url: uData.avatar_url,
            public_repos: uData.public_repos,
            total_private_repos: uData.total_private_repos,
            tokenType: uData.tokenType
          });
        }
      }

      if (reposRes && reposRes.ok) {
        const data = await reposRes.json().catch(() => null);
        if (Array.isArray(data)) {
          setLiveRepos(
            data
              .filter((r: any) => r && typeof r.full_name === 'string')
              .map((r: any) => ({
                id: r.id,
                name: r.name || r.full_name.split('/')[1] || r.full_name,
                full_name: r.full_name,
                default_branch: r.default_branch || 'main',
                description: r.description || '',
                private: Boolean(r.private),
                language: r.language || '',
                updated_at: r.updated_at || '',
                html_url: r.html_url || `https://github.com/${r.full_name}`,
                owner_login: r.owner?.login || r.full_name.split('/')[0]
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
      const [ownerPart, repoPart] = repoName.split('/');
      const res = await fetch(
        `/api/github/branches?owner=${encodeURIComponent(ownerPart)}&repo=${encodeURIComponent(
          repoPart
        )}`,
        { headers }
      );
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
    fetchPatAccountAndRepos();
    const handlePatUpdate = () => fetchPatAccountAndRepos();
    window.addEventListener('github-pat-updated', handlePatUpdate);
    return () => window.removeEventListener('github-pat-updated', handlePatUpdate);
  }, []);

  useEffect(() => {
    fetchRepoBranches(selectedRepo);
  }, [selectedRepo]);

  const allKnownRepos = useMemo(() => {
    const map = new Map<
      string,
      {
        repo: string;
        label: string;
        defaultBranch: string;
        private?: boolean;
        language?: string;
        description?: string;
        source: 'github' | 'curated' | 'custom';
      }
    >();

    // 1. All Live GitHub PAT Account Repositories FIRST
    for (const r of liveRepos) {
      const visTag = r.private ? 'Private' : 'Public';
      const langTag = r.language ? ` · ${r.language}` : '';
      const descTag = r.description ? ` — ${r.description.slice(0, 48)}` : '';
      map.set(r.full_name.toLowerCase(), {
        repo: r.full_name,
        label: `${r.full_name} [${visTag}${langTag}]${descTag}`,
        defaultBranch: r.default_branch || 'main',
        private: r.private,
        language: r.language,
        description: r.description,
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

    // Ensure currently selectedRepo is always present
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

  const filteredPatRepos = useMemo(() => {
    const q = repoSearchQuery.trim().toLowerCase();
    return liveRepos.filter((r) => {
      if (visibilityFilter === 'public' && r.private) return false;
      if (visibilityFilter === 'private' && !r.private) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.language || '').toLowerCase().includes(q)
      );
    });
  }, [liveRepos, repoSearchQuery, visibilityFilter]);

  const publicCount = useMemo(() => liveRepos.filter((r) => !r.private).length, [liveRepos]);
  const privateCount = useMemo(() => liveRepos.filter((r) => r.private).length, [liveRepos]);

  const applyProjectSelection = (rawRepo: string, rawBranch?: string) => {
    const { repo, extractedBranch } = normalizeRepoInput(rawRepo);
    if (!repo) return;

    const known = allKnownRepos.find((k) => k.repo.toLowerCase() === repo.toLowerCase());
    const liveMatch = liveRepos.find((l) => l.full_name.toLowerCase() === repo.toLowerCase());
    const nextBranch =
      extractedBranch ||
      rawBranch ||
      liveMatch?.default_branch ||
      known?.defaultBranch ||
      selectedBranch ||
      'main';

    const isCurated = CURATED_TARGET_REPOS.some(
      (c) => c.displayRepo.toLowerCase() === repo.toLowerCase()
    );
    const isLive = Boolean(liveMatch);
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
    setTimeout(() => setLoadedBadge(null), 4000);
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 text-xs">
          <FolderGit2 className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />
          <span className="text-slate-400 text-[11px] whitespace-nowrap">
            {patUser ? `@${patUser.login} PAT Repo` : label}:
          </span>
          {!isCustomMode ? (
            <select
              aria-label="Select Target Repository Project"
              value={selectedRepo}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomMode(true);
                } else {
                  const chosen = e.target.value;
                  const match = liveRepos.find(
                    (l) => l.full_name.toLowerCase() === chosen.toLowerCase()
                  );
                  applyProjectSelection(chosen, match?.default_branch);
                }
              }}
              className="bg-transparent text-white font-mono font-semibold text-xs outline-none cursor-pointer max-w-[260px] truncate"
            >
              {liveRepos.length > 0 && (
                <optgroup
                  label={`PAT GitHub Account (${patUser ? `@${patUser.login}` : 'Connected'} · ${liveRepos.length} Repos)`}
                  className="bg-slate-950 text-emerald-300"
                >
                  {liveRepos.map((r) => (
                    <option
                      key={`gh-${r.full_name}`}
                      value={r.full_name}
                      className="bg-slate-950 text-white"
                    >
                      {r.full_name} {r.private ? '🔒 (Private)' : '(Public)'} · {r.default_branch || 'main'}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup
                label="Curated Architecture Blueprints"
                className="bg-slate-950 text-amber-300"
              >
                {allKnownRepos
                  .filter((r) => r.source !== 'github')
                  .map((r) => (
                    <option
                      key={`cur-${r.repo}`}
                      value={r.repo}
                      className="bg-slate-950 text-white"
                    >
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
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Loaded {loadedBadge}</span>
          </span>
        )}
      </div>
    );
  }

  // Banner / Card mode: Full dropdown + Interactive Visual Grid of ALL PAT GitHub Account Repositories
  return (
    <div className="space-y-3">
      {/* Top Control Row: Dropdown + Branch + Load Project + Toggle PAT Repo Browser */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[260px] flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-[#EB6658]">
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
                const match = liveRepos.find(
                  (l) => l.full_name.toLowerCase() === val.toLowerCase()
                );
                applyProjectSelection(val, match?.default_branch);
              }
            }}
            className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none cursor-pointer"
          >
            {liveRepos.length > 0 && (
              <optgroup
                label={`PAT GitHub Account (${patUser ? `@${patUser.login}` : 'Connected'} · All ${liveRepos.length} Repositories)`}
                className="bg-slate-950 text-emerald-300"
              >
                {liveRepos.map((r) => (
                  <option
                    key={`gh-${r.full_name}`}
                    value={r.full_name}
                    className="bg-slate-950 text-white"
                  >
                    {r.full_name} [{r.private ? 'Private' : 'Public'}
                    {r.language ? ` · ${r.language}` : ''} · branch:{r.default_branch || 'main'}]
                    {r.description ? ` — ${r.description.slice(0, 45)}` : ''}
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

        {liveRepos.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPatRepoGrid((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shrink-0 tabular-nums ${
              showPatRepoGrid
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Show or hide all repositories from your connected GitHub PAT account"
          >
            <span>
              PAT Account Repos ({liveRepos.length})
            </span>
            {showPatRepoGrid ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}

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
          onClick={fetchPatAccountAndRepos}
          disabled={isLoadingRepos}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer shrink-0"
          title="Refresh repositories from GitHub PAT account"
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

      {/* Visual Browser to SEE and SELECT All Repositories on the Connected GitHub PAT Account */}
      {liveRepos.length > 0 && showPatRepoGrid && (
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              {patUser?.avatar_url && (
                <img
                  src={patUser.avatar_url}
                  alt={patUser.login}
                  className="w-5 h-5 rounded-full border border-emerald-500/40"
                />
              )}
              <span className="font-bold text-white">
                Connected GitHub PAT Account:{' '}
                <span className="text-emerald-400 font-mono">
                  @{patUser?.login || liveRepos[0]?.owner_login || 'GitHub'}
                </span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-[11px] font-mono text-slate-300 tabular-nums">
                {liveRepos.length} Total Repos ({publicCount} Public · {privateCount} Private)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={repoSearchQuery}
                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                  placeholder={`Search all ${liveRepos.length} PAT repos...`}
                  className="bg-slate-900 text-xs text-white pl-8 pr-2.5 py-1 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658] w-48 sm:w-56"
                />
              </div>

              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px] font-mono tabular-nums">
                <button
                  type="button"
                  onClick={() => setVisibilityFilter('all')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    visibilityFilter === 'all'
                      ? 'bg-[#EB6658] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({liveRepos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVisibilityFilter('public')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    visibilityFilter === 'public'
                      ? 'bg-[#EB6658] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Public ({publicCount})
                </button>
                <button
                  type="button"
                  onClick={() => setVisibilityFilter('private')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition ${
                    visibilityFilter === 'private'
                      ? 'bg-[#EB6658] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Private ({privateCount})
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
            {filteredPatRepos.map((repoItem) => {
              const isSelected =
                repoItem.full_name.toLowerCase() === selectedRepo.toLowerCase();
              const defBranch = repoItem.default_branch || 'main';
              return (
                <button
                  key={repoItem.full_name}
                  type="button"
                  onClick={() => applyProjectSelection(repoItem.full_name, defBranch)}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#EB6658]/15 border-[#EB6658] text-white shadow-sm'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-xs font-bold truncate text-white">
                        {repoItem.full_name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${
                          repoItem.private
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        {repoItem.private ? (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-2.5 h-2.5" />
                            <span>Public</span>
                          </>
                        )}
                      </span>
                    </div>
                    {repoItem.description ? (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {repoItem.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic mt-0.5">
                        GitHub repository on @{repoItem.owner_login || patUser?.login}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between w-full pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-400 tabular-nums">
                    <span className="flex items-center gap-1 text-sky-300">
                      <GitBranch className="w-3 h-3" />
                      <span>{defBranch}</span>
                      {repoItem.language ? (
                        <span className="text-slate-400">· {repoItem.language}</span>
                      ) : null}
                    </span>
                    <span
                      className={`font-bold ${
                        isSelected ? 'text-emerald-400' : 'text-[#EB6658]'
                      }`}
                    >
                      {isSelected ? '✓ Active Project' : 'Select & Load →'}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredPatRepos.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-400">
                No PAT repositories match &ldquo;{repoSearchQuery}&rdquo;.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Repo Input Row */}
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
