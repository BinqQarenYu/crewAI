import React, { useState, useEffect, useRef } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  UploadCloud, 
  DownloadCloud, 
  ExternalLink, 
  Folder, 
  FileText, 
  RefreshCw, 
  Lock, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Code2, 
  ShieldCheck,
  Eye,
  EyeOff,
  Clipboard,
  LogOut
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';
import { CURATED_TARGET_REPOS, resolveRepoWorkforceProfile } from '../utils/repoWorkforceMapping';
import { Users, Cpu, Layers } from 'lucide-react';

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
  isServerSide?: boolean;
  tokenType?: string;
  scopes?: string[];
  rateLimit?: {
    remaining: number;
    limit: number;
  };
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  description: string;
  updated_at: string;
}

interface GitCommitItem {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
}

interface RemoteFileItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

interface GitHubHubProps {
  selectedRepo: string;
  onRepoChange: (repo: string) => void;
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
}

export const GitHubHub: React.FC<GitHubHubProps> = ({
  selectedRepo,
  onRepoChange,
  selectedBranch,
  onBranchChange
}) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem('crewai_github_token') || '');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showTokenSecret, setShowTokenSecret] = useState<boolean>(false);
  const [showPatConfigurator, setShowPatConfigurator] = useState<boolean>(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<{name: string}[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnectingPat, setIsConnectingPat] = useState<boolean>(false);
  const [isFetchingBranches, setIsFetchingBranches] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  // Pull State
  const [remoteFiles, setRemoteFiles] = useState<RemoteFileItem[]>([]);
  const [recentCommits, setRecentCommits] = useState<GitCommitItem[]>([]);
  const [selectedRemoteFile, setSelectedRemoteFile] = useState<string | null>(null);
  const [remoteFileContent, setRemoteFileContent] = useState<string | null>(null);

  // Push State
  const [pushFilePath, setPushFilePath] = useState<string>('crews/content_crew/crew.jsonc');
  const [pushCommitMessage, setPushCommitMessage] = useState<string>('feat: update CrewAI agent orchestration pipeline');
  const [pushFileContent, setPushFileContent] = useState<string>(`{
  "name": "Production Research Crew",
  "process": "sequential",
  "agents": ["researcher", "writer"],
  "tasks": [
    {
      "name": "market_scan",
      "description": "Gather live multi-agent intelligence from GitHub and web",
      "agent": "researcher"
    }
  ]
}`);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isPushingFullApp, setIsPushingFullApp] = useState<boolean>(false);
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(null);

  // Per-Card Minimize State
  const [isFilesMinimized, setIsFilesMinimized] = useState<boolean>(false);
  const [isCommitsMinimized, setIsCommitsMinimized] = useState<boolean>(false);
  const [isPushMinimized, setIsPushMinimized] = useState<boolean>(false);
  const [isSyncLogsMinimized, setIsSyncLogsMinimized] = useState<boolean>(false);
  const [isWorkforceMinimized, setIsWorkforceMinimized] = useState<boolean>(false);

  const activeWorkforce = resolveRepoWorkforceProfile(selectedRepo);

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setIsFilesMinimized(detail.minimized);
        setIsCommitsMinimized(detail.minimized);
        setIsPushMinimized(detail.minimized);
        setIsSyncLogsMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  const patInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Activity Logs
  const [syncLogs, setSyncLogs] = useState<string[]>([
    '[System] GitHub Sync Hub loaded — Personal Access Token (PAT) authentication ready.',
    '[System] Repository target default: bingkltech/crewAI.'
  ]);

  const addLog = (msg: string) => {
    setSyncLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Focus PAT input when PAT configurator is shown
  useEffect(() => {
    if ((!user || showPatConfigurator) && patInputRef.current) {
      patInputRef.current.focus();
    }
  }, [user, showPatConfigurator]);

  // Listen for OAuth Popup PostMessage
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const code = event.data.code;
        if (code) {
          addLog('Received authorization code from GitHub OAuth popup. Exchanging for token...');
          try {
            const res = await fetch('/api/auth/github/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            const data = await res.json();
            if (data.access_token) {
              setToken(data.access_token);
              localStorage.setItem('crewai_github_token', data.access_token);
              addLog('GitHub OAuth access token received and stored securely.');
              await verifyAndConnectToken(data.access_token);
            } else {
              throw new Error(data.error || 'Failed to exchange token');
            }
          } catch (e: any) {
            setStatusMessage({ type: 'error', text: e.message });
            addLog(`OAuth error: ${e.message}`);
          }
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // On mount, verify existing localStorage PAT or auto-connect server-side PAT
  useEffect(() => {
    const handleExternalPatUpdate = () => {
      const stored = localStorage.getItem('crewai_github_token') || '';
      if (stored) {
        setToken(stored);
        verifyAndConnectToken(stored);
      } else {
        autoConnectServerSide();
      }
    };

    if (token) {
      verifyAndConnectToken(token);
    } else {
      autoConnectServerSide();
    }

    window.addEventListener('github-pat-updated', handleExternalPatUpdate);
    return () => window.removeEventListener('github-pat-updated', handleExternalPatUpdate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUserRepos = async (authToken?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const reposRes = await fetch('/api/github/repos', { headers });
      if (reposRes.ok) {
        const reposData = await reposRes.json();
        if (Array.isArray(reposData)) {
          setRepos(reposData);
          if (reposData.length > 0 && !selectedRepo) {
            const firstRepo = reposData[0].full_name;
            onRepoChange(firstRepo);
            localStorage.setItem('crewai_selected_repo', firstRepo);
          }
        }
      }
    } catch {
      // ignore repo list errors
    }
  };

  const autoConnectServerSide = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/github/user');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (userData.isServerSide) {
          addLog(`Connected using server-side GitHub PAT (@${userData.login})`);
          setStatusMessage({
            type: 'success',
            text: `Connected to GitHub via PAT as @${userData.login} (${userData.tokenType || 'Personal Access Token'})`
          });
        }
        await fetchUserRepos();
      }
    } catch {
      // No server-side token configured yet; user can enter PAT in UI
    } finally {
      setIsLoading(false);
    }
  };

  // Verify PAT via /api/github/connect-pat, sync with backend session, and load repos
  const verifyAndConnectToken = async (authToken: string) => {
    const cleanToken = authToken.trim();
    if (!cleanToken) return;

    setIsConnectingPat(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/github/connect-pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken })
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || `GitHub PAT verification failed (${res.status})`);
      }

      const connectedUser: GitHubUser = {
        ...payload.user,
        tokenType: payload.tokenType,
        scopes: payload.scopes,
        rateLimit: payload.rateLimit
      };

      setToken(cleanToken);
      localStorage.setItem('crewai_github_token', cleanToken);
      localStorage.setItem('crewai_github_user_login', connectedUser.login);
      setUser(connectedUser);
      setShowPatConfigurator(false);
      setTokenInput('');

      addLog(
        `[PAT AUTH SUCCESS] Authenticated as @${connectedUser.login} via ${payload.tokenType}. Scopes: [${(
          payload.scopes || []
        ).join(', ')}]`
      );

      await fetchUserRepos(cleanToken);
      window.dispatchEvent(new Event('github-pat-updated'));

      setStatusMessage({
        type: 'success',
        text: `Connected to GitHub via PAT as @${connectedUser.login} (${payload.tokenType})`
      });
    } catch (e: any) {
      setUser(null);
      setStatusMessage({ type: 'error', text: e.message || 'Invalid GitHub Personal Access Token' });
      addLog(`[PAT AUTH ERROR] ${e.message}`);
    } finally {
      setIsConnectingPat(false);
    }
  };

  // Connect via Personal Access Token form submit
  const handleConnectPAT = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const candidate = tokenInput.trim();
    if (!candidate) {
      setStatusMessage({
        type: 'error',
        text: 'Please paste your GitHub Personal Access Token (starts with ghp_ or github_pat_) first.'
      });
      patInputRef.current?.focus();
      return;
    }
    await verifyAndConnectToken(candidate);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        setTokenInput(clipText.trim());
        addLog('Pasted GitHub PAT from clipboard.');
      }
    } catch {
      patInputRef.current?.focus();
    }
  };

  // Launch OAuth Popup
  const handleConnectOAuth = async () => {
    try {
      addLog('Initiating GitHub OAuth Authorization flow...');
      const res = await fetch('/api/auth/github/url');
      const data = await res.json();

      if (!data.configured) {
        setStatusMessage({
          type: 'info',
          text: 'GitHub OAuth Client ID is not configured in .env. Paste your GitHub Personal Access Token (PAT) in the highlighted box below for instant connection.'
        });
        patInputRef.current?.focus();
        return;
      }

      const authWindow = window.open(
        data.url,
        'github_oauth_popup',
        'width=600,height=720,menubar=no,status=no'
      );

      if (!authWindow) {
        setStatusMessage({
          type: 'error',
          text: 'Popup was blocked by your browser. Please use your Personal Access Token (PAT) below.'
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to open GitHub OAuth' });
    }
  };

  const handleDisconnect = async () => {
    setToken('');
    setTokenInput('');
    setUser(null);
    setRepos([]);
    setBranches([]);
    localStorage.removeItem('crewai_github_token');
    localStorage.removeItem('crewai_github_user_login');
    try {
      await fetch('/api/github/disconnect-pat', { method: 'POST' });
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event('github-pat-updated'));
    addLog('Disconnected GitHub Personal Access Token.');
    setStatusMessage({ type: 'info', text: 'Disconnected from GitHub. Enter a new PAT below to reconnect.' });
  };

  // Fetch branches for selected repo
  useEffect(() => {
    if (selectedRepo) {
      fetchBranches(selectedRepo);
    }
  }, [selectedRepo, user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBranches = async (repoFullName: string) => {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return;

    setIsFetchingBranches(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBranches(data);
          const branchNames = data.map((b: any) => b.name);
          if (branchNames.length > 0 && !branchNames.includes(selectedBranch)) {
            const defaultBranch = data.find((b: any) => b.name === 'main' || b.name === 'master')?.name || branchNames[0] || 'main';
            onBranchChange(defaultBranch);
          }
        }
      }
    } catch {
      addLog(`Could not fetch branch list for ${repoFullName}`);
    } finally {
      setIsFetchingBranches(false);
    }
  };

  const handleRepoChange = (newRepo: string) => {
    onRepoChange(newRepo);
  };

  const handleBranchChange = (newBranch: string) => {
    onBranchChange(newBranch);
  };

  // 1. PULL REPO DATA (Files & Commits via Server Proxy)
  const handlePullRepo = async () => {
    if (!selectedRepo) return;
    setIsLoading(true);
    addLog(`[GIT PULL] Fetching repository tree and commit history from https://github.com/${selectedRepo} (branch: ${selectedBranch})...`);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/github/pull-repo?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(selectedBranch)}`,
        { headers }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to pull ${selectedRepo} (${res.status})`);
      }

      setRecentCommits(data.commits || []);
      setRemoteFiles(data.files || []);
      addLog(`[GIT PULL] Pulled ${(data.commits || []).length} commits and ${(data.files || []).length} tree objects.`);
      setStatusMessage({ type: 'success', text: `Successfully pulled ${selectedRepo}@${selectedBranch}` });
    } catch (e: any) {
      addLog(`[GIT PULL ERROR] ${e.message}`);
      setStatusMessage({ type: 'error', text: `Pull error: ${e.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // View a remote file via server proxy
  const handleFetchFileContent = async (filePath: string) => {
    setSelectedRemoteFile(filePath);
    setRemoteFileContent('Fetching remote content...');
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/github/file-content?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(
          selectedBranch
        )}&path=${encodeURIComponent(filePath)}`,
        { headers }
      );
      const data = await res.json();
      if (res.ok && typeof data.content === 'string') {
        setRemoteFileContent(data.content);
        addLog(`[GIT PULL] Loaded content of ${filePath} (${data.content.length} chars).`);
      } else {
        setRemoteFileContent(data.error || `Error loading file: HTTP ${res.status}`);
      }
    } catch (e: any) {
      setRemoteFileContent(`Failed to fetch file: ${e.message}`);
    }
  };

  // 2. PUSH / COMMIT TO GITHUB
  const handlePushCommit = async () => {
    if (!token && !user) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your GitHub Personal Access Token (PAT) first to push commits.'
      });
      setShowPatConfigurator(true);
      patInputRef.current?.focus();
      return;
    }
    if (!selectedRepo || !pushFilePath.trim() || !pushFileContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill in repository, file path, and code content.' });
      return;
    }

    setIsPushing(true);
    addLog(`[GIT PUSH] Initiating commit to ${selectedRepo}/${pushFilePath} on branch ${selectedBranch}...`);

    try {
      const res = await fetch('/api/github/push-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          token: token || undefined,
          owner: selectedRepo.split('/')[0],
          repo: selectedRepo.split('/')[1],
          path: pushFilePath,
          content: pushFileContent,
          message: pushCommitMessage,
          branch: selectedBranch
        })
      });

      const pushResult = await res.json();

      if (!res.ok) {
        throw new Error(pushResult.error || 'Failed to push commit');
      }

      const commitSha = pushResult.commit?.sha?.substring(0, 7) || 'latest';
      const commitUrl = pushResult.commit?.html_url || `https://github.com/${selectedRepo}/commits/${selectedBranch}`;
      setLastCommitUrl(commitUrl);

      addLog(`[GIT PUSH SUCCESS] Commit ${commitSha} created successfully! Link: ${commitUrl}`);
      setStatusMessage({ type: 'success', text: `Committed ${pushFilePath} to ${selectedRepo}@${selectedBranch} (Commit ${commitSha})` });

      handlePullRepo();
    } catch (e: any) {
      addLog(`[GIT PUSH ERROR] ${e.message}`);
      setStatusMessage({ type: 'error', text: `Push failed: ${e.message}` });
    } finally {
      setIsPushing(false);
    }
  };

  // 3. PUSH ENTIRE APPLICATION WORKSPACE TO GITHUB VIA PAT
  const handlePushFullApp = async () => {
    const activeToken = (token || localStorage.getItem('crewai_github_token') || '').trim();
    if (!activeToken && !user) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your GitHub Personal Access Token (PAT) first to push this app.'
      });
      setShowPatConfigurator(true);
      patInputRef.current?.focus();
      return;
    }

    setIsPushingFullApp(true);
    addLog(`[FULL APP PUSH] Bundling all workspace files (server.ts, package.json, src/**/*) and pushing to ${selectedRepo}@${selectedBranch}...`);

    try {
      const res = await fetch('/api/github/push-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          token: activeToken || undefined,
          repo: selectedRepo || 'bingkltech/crewAI',
          branch: selectedBranch || 'main',
          message: pushCommitMessage || 'feat(app): push full CrewAI Studio application workspace via PAT'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to push full app (${res.status})`);
      }

      if (data.repo && data.repo !== selectedRepo) {
        onRepoChange(data.repo);
        localStorage.setItem('crewai_selected_repo', data.repo);
      }
      if (data.branch && data.branch !== selectedBranch) {
        onBranchChange(data.branch);
        localStorage.setItem('crewai_selected_branch', data.branch);
      }

      const commitSha = data.shortSha || 'latest';
      const commitUrl = data.commitUrl || `https://github.com/${data.repo || selectedRepo}/commits/${data.branch || selectedBranch}`;
      setLastCommitUrl(commitUrl);

      addLog(
        `[FULL APP PUSH SUCCESS] Pushed ${data.filesPushed || 47} application files to ${data.repo}@${data.branch} (Commit ${commitSha})! Link: ${commitUrl}`
      );
      setStatusMessage({
        type: 'success',
        text: `Pushed entire app (${data.filesPushed || 47} files) to ${data.repo}@${data.branch} (Commit ${commitSha})`
      });

      handlePullRepo();
    } catch (e: any) {
      addLog(`[FULL APP PUSH ERROR] ${e.message}`);
      setStatusMessage({ type: 'error', text: `Full App Push failed: ${e.message}` });
    } finally {
      setIsPushingFullApp(false);
    }
  };

  // Download Self-Extracting Full-Stack Windows standalone.bat via Blob (works inside sandboxed iframes)
  const handleDownloadStandaloneBat = async () => {
    try {
      setStatusMessage({
        type: 'info',
        text: 'Building self-extracting standalone.bat (Full Frontend + Backend + .env archive)...'
      });
      const res = await fetch('/api/standalone/bat?includeEnv=1');
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const batText = await res.text();
      const blob = new Blob([batText], { type: 'application/x-bat;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'standalone.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('[STANDALONE.BAT] Downloaded self-extracting full-stack Windows launcher (Frontend + Backend + .env).');
      setStatusMessage({
        type: 'success',
        text: 'Downloaded standalone.bat! Double-click it in any folder on Windows to unpack & launch the full app on http://localhost:3000.'
      });
    } catch (e: any) {
      addLog(`[STANDALONE.BAT ERROR] ${e.message}`);
      setStatusMessage({ type: 'error', text: `Failed to download standalone.bat: ${e.message}` });
    }
  };

  const maskedCurrentToken = token
    ? `${token.slice(0, 7)}••••••••••••${token.slice(-4)}`
    : user?.isServerSide
    ? 'Server Runtime PAT Active'
    : '';

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
              <Key className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              GitHub PAT & Repository Sync Hub
            </h1>
            {user ? (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                PAT Connected (@{user.login})
              </span>
            ) : (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Ready for PAT Connection
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect to GitHub using a Personal Access Token (<code className="text-slate-200 font-mono">ghp_...</code> or <code className="text-slate-200 font-mono">github_pat_...</code>) to pull trees, inspect commits, and push code directly from CrewAI Studio.
          </p>
        </div>

        {/* Connected User Profile & PAT Controls */}
        {user ? (
          <div className="flex items-center gap-3 bg-slate-900/90 border border-emerald-500/30 p-2.5 rounded-2xl flex-wrap">
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-9 h-9 rounded-full border border-emerald-500/40"
            />
            <div className="text-left text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <span>@{user.login}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {user.tokenType || 'PAT Active'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>{user.public_repos} public repos</span>
                {user.rateLimit && (
                  <span>• API Quota: {user.rateLimit.remaining}/{user.rateLimit.limit}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => setShowPatConfigurator((v) => !v)}
                className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center gap-1"
              >
                <Key className="w-3 h-3 text-[#EB6658]" />
                <span>{showPatConfigurator ? 'Hide PAT Box' : 'Change PAT'}</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/settings/tokens/new?description=CrewAI+Studio+PAT&scopes=repo,workflow,read:user"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 text-xs font-bold transition"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Generate GitHub PAT (repo scope)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {lastCommitUrl && statusMessage.type === 'success' && (
            <a
              href={lastCommitUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 underline text-xs font-semibold ml-2"
            >
              <span>View Commit on GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Personal Access Token (PAT) Connection Panel — Shown when not connected OR when user clicks "Change PAT" */}
      {(!user || showPatConfigurator) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Primary PAT Authenticator Card (7 cols) */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/70 border-2 border-[#EB6658]/40 shadow-xl shadow-[#EB6658]/5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Connect to GitHub with Personal Access Token (PAT)
                    </h3>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#EB6658] text-white font-bold">
                      Direct & Instant
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports both Classic (<code className="text-slate-200 font-mono">ghp_...</code>) and Fine-Grained (<code className="text-slate-200 font-mono">github_pat_...</code>) tokens.
                  </p>
                </div>
              </div>

              {user && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  Active: {maskedCurrentToken}
                </span>
              )}
            </div>

            <form onSubmit={handleConnectPAT} className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    GitHub Personal Access Token
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?description=CrewAI+Studio+PAT&scopes=repo,workflow,read:user"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#EB6658] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Create new token on GitHub.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={patInputRef}
                      type={showTokenSecret ? 'text' : 'password'}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx or github_pat_..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-[#EB6658] rounded-xl pl-3.5 pr-20 py-2.5 text-xs text-white font-mono outline-none transition"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        title="Paste token from clipboard"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTokenSecret((s) => !s)}
                        title={showTokenSecret ? 'Hide token' : 'Show token'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        {showTokenSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isConnectingPat}
                    className="px-5 py-2.5 bg-[#EB6658] hover:bg-[#d95547] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-[#EB6658]/20 cursor-pointer shrink-0"
                  >
                    {isConnectingPat ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying PAT...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Connect with PAT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Required Scopes Strip */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400">Recommended Scopes:</span>
                  <code className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    repo
                  </code>
                  <code className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                    workflow
                  </code>
                  <code className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                    read:user
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleConnectOAuth}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Or use GitHub OAuth Popup
                </button>
              </div>
            </form>
          </div>

          {/* Right: Quick 3-Step PAT Guide (5 cols) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EB6658]" />
              <h3 className="text-sm font-bold text-white">How to Connect with a GitHub PAT</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#EB6658] text-white text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Click{' '}
                  <a
                    href="https://github.com/settings/tokens/new?description=CrewAI+Studio+PAT&scopes=repo,workflow,read:user"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#EB6658] font-semibold hover:underline"
                  >
                    Create new token on GitHub.com
                  </a>{' '}
                  (pre-selects <code className="text-emerald-400 font-mono">repo</code>,{' '}
                  <code className="text-sky-400 font-mono">workflow</code>, and{' '}
                  <code className="text-purple-300 font-mono">read:user</code> scopes).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#EB6658] text-white text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Copy your generated <code className="text-slate-200 font-mono">ghp_...</code> or{' '}
                  <code className="text-slate-200 font-mono">github_pat_...</code> token, paste it into the field on the left, and click <strong>Connect with PAT</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#EB6658] text-white text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Your PAT is immediately verified against <code className="text-slate-200 font-mono">api.github.com/user</code> and synced across Crew Studio, LangGraph, and Google Jules for commits & PRs.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <Lock className="w-3 h-3" />
                  <span>Zero-Leak Security Guard</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Your token is stored locally in your browser and passed via Bearer headers to the backend GitHub proxy. <code className="text-slate-300 font-mono">.env</code> files are automatically blocked from ever being pushed to remote repositories.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connected PAT Scope & Session Telemetry Bar */}
      {user && user.scopes && user.scopes.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-semibold">Verified PAT Scopes:</span>
            {user.scopes.map((scope) => (
              <span
                key={scope}
                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[11px]"
              >
                {scope}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>Token: {maskedCurrentToken}</span>
            <span>•</span>
            <span>Target: {selectedRepo}@{selectedBranch}</span>
          </div>
        </div>
      )}

      {/* Repository & Branch Controls + Dictated Agent Workforce Matrix */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="min-w-[260px]">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                Target Repository <span className="text-slate-500">· Dictates Assigned Crew & Agents</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Target GitHub Repository Preset or Connected Repo"
                  value={
                    CURATED_TARGET_REPOS.some((r) => r.displayRepo === selectedRepo) ||
                    repos.some((r) => r.full_name === selectedRepo)
                      ? selectedRepo
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      handleRepoChange(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-lg outline-none font-mono focus:border-[#EB6658]"
                >
                  <optgroup label="Curated Target Repositories (Auto-Mapped Crews)">
                    {CURATED_TARGET_REPOS.map((item) => (
                      <option key={item.displayRepo} value={item.displayRepo}>
                        {item.displayRepo} — {item.crewName.replace(/\s*\(.*\)/, '')}
                      </option>
                    ))}
                  </optgroup>
                  {repos.length > 0 && (
                    <optgroup label="Your Connected GitHub PAT Repositories">
                      {repos
                        .filter((r) => !CURATED_TARGET_REPOS.some((c) => c.displayRepo === r.full_name))
                        .map((r) => (
                          <option key={r.id} value={r.full_name}>
                            {r.full_name} {r.private ? '(Private)' : ''}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  <option value="__custom__">Custom owner/repository...</option>
                </select>

                <input
                  type="text"
                  value={selectedRepo}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  placeholder="owner/repository"
                  title="Type any GitHub owner/repository"
                  className="w-44 bg-slate-950 border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-lg outline-none font-mono focus:border-[#EB6658]"
                />
              </div>
            </div>

            <div className="min-w-[150px]">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Branch</label>
              <div className="flex items-center gap-1.5">
                <div className="relative w-full">
                  {branches.length > 0 ? (
                    <select
                      aria-label="Target GitHub Branch"
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      disabled={isFetchingBranches}
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg outline-none font-mono focus:border-[#EB6658] appearance-none disabled:opacity-50"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      placeholder="main"
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg outline-none font-mono focus:border-[#EB6658]"
                    />
                  )}
                  <GitBranch className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {isFetchingBranches && (
                    <RefreshCw className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isPushingFullApp}
              onClick={handlePushFullApp}
              className="px-4 py-2 bg-gradient-to-r from-[#EB6658] to-[#C94C3C] hover:brightness-110 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-md shadow-[#EB6658]/20 cursor-pointer"
            >
              {isPushingFullApp ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing Entire App...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Push Entire App to GitHub</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handlePullRepo}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-sky-400" />
              <span>{isLoading ? 'Pulling...' : 'Git Pull'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadStandaloneBat}
              title="Download self-extracting standalone.bat with complete Frontend + Backend + .env bundled inside"
              className="px-3.5 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-cyan-500/40 cursor-pointer"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download standalone.bat (Full Front + Back)</span>
            </button>

            <a
              href={`https://github.com/${selectedRepo}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition flex items-center gap-1 border border-slate-800"
            >
              <span>Open in GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <CardMinMaxButtons
              isMinimized={isWorkforceMinimized}
              onMinimize={() => setIsWorkforceMinimized(true)}
              onExpand={() => setIsWorkforceMinimized(false)}
              title="Target Repository Assigned Workforce"
            />
          </div>
        </div>

        {/* Dictated Workforce & Collaborator Breakdown */}
        {!isWorkforceMinimized && (
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-[#EB6658]" />
                <span className="font-bold text-white">
                  Who Works With <code className="text-[#EB6658] font-mono">{selectedRepo}</code>:
                </span>
                <span className="text-slate-300 font-semibold">{activeWorkforce.crewName}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Process: {activeWorkforce.processMode} · Manager: {activeWorkforce.managerModel}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{activeWorkforce.label}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {/* 1. Task Maker */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  1. Task Maker & PRD Planner
                </div>
                <div className="font-bold text-slate-100">{activeWorkforce.taskMaker.name}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{activeWorkforce.taskMaker.role}</div>
              </div>

              {/* 2. Task Controller Gatekeeper */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-semibold">
                  2. Task Controller & QA Gate
                </div>
                <div className="font-bold text-slate-100">{activeWorkforce.taskController.name}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{activeWorkforce.taskController.role}</div>
              </div>

              {/* 3. Domain Specialists */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  3. Domain Specialists ({activeWorkforce.specialists.length})
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {activeWorkforce.specialists.map((spec) => (
                    <div key={spec.name} className="text-[11px] text-slate-300 truncate">
                      <span className="font-semibold text-white">{spec.name}</span>
                      <span className="text-slate-500"> · </span>
                      <span className="text-slate-400">{spec.category}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Closed-Loop VM & PR Collaborators */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                  4. Cloud VM & PR Gatekeepers
                </div>
                <div className="space-y-1">
                  {activeWorkforce.pipelineCollaborators.map((collab) => (
                    <div key={collab.name} className="text-[11px] text-slate-300 truncate">
                      <span className="font-semibold text-white">{collab.name}</span>
                      <span className="text-slate-500"> · </span>
                      <span className="text-slate-400">{collab.stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Pull & Files Left (6 cols), Push & Commits Right (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Remote Files & Pull Inspector (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Pulled Remote Files</h3>
                <span className="text-[11px] font-mono text-slate-400">
                  ({remoteFiles.length > 0 ? `${remoteFiles.length} files` : 'Click "Git Pull" to load'})
                </span>
              </div>
              <CardMinMaxButtons
                isMinimized={isFilesMinimized}
                onMinimize={() => setIsFilesMinimized(true)}
                onExpand={() => setIsFilesMinimized(false)}
                title="Pulled Remote Files"
                className="ml-auto"
              />
            </div>

            {!isFilesMinimized && (
              <>

            {remoteFiles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl p-4">
                <Folder className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p>No remote repository tree loaded yet.</p>
                <button
                  type="button"
                  onClick={handlePullRepo}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Pull {selectedRepo}
                </button>
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-xl bg-[#080C14] border border-slate-800 p-2 space-y-1 font-mono text-xs">
                {remoteFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => handleFetchFileContent(file.path)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                      selectedRemoteFile === file.path
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : 'text-slate-300 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {file.type === 'tree' ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.size && (
                      <span className="text-[10px] text-slate-500">
                        {Math.round(file.size / 1024)} KB
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Remote File Content Preview */}
            {selectedRemoteFile && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300 truncate">Preview: {selectedRemoteFile}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (remoteFileContent) {
                        setPushFileContent(remoteFileContent);
                        setPushFilePath(selectedRemoteFile);
                        addLog(`Loaded ${selectedRemoteFile} into Push Editor.`);
                      }
                    }}
                    className="text-[11px] text-[#EB6658] hover:underline font-semibold cursor-pointer"
                  >
                    Load into Push Editor
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[#080C14] border border-slate-800 text-[11px] font-mono text-slate-300 h-44 overflow-y-auto leading-relaxed">
                  <code>{remoteFileContent}</code>
                </pre>
              </div>
            )}
              </>
            )}
          </div>

          {/* Recent Commits from GitHub */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">Recent GitHub Commits</h3>
                <span className="text-[11px] font-mono text-slate-400">({recentCommits.length} commits)</span>
              </div>
              <CardMinMaxButtons
                isMinimized={isCommitsMinimized}
                onMinimize={() => setIsCommitsMinimized(true)}
                onExpand={() => setIsCommitsMinimized(false)}
                title="Recent GitHub Commits"
                className="ml-auto"
              />
            </div>

            {!isCommitsMinimized && (
              recentCommits.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Pull repository to view latest commit history.
              </div>
            ) : (
              <div className="relative space-y-6 pt-2 pl-2">
                {/* Vertical line */}
                <div className="absolute left-[13px] top-4 bottom-2 w-0.5 bg-slate-800"></div>

                {recentCommits.map((commit) => (
                  <div key={commit.sha} className="relative flex gap-4">
                    {/* Dot */}
                    <div className="w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#EB6658]"></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 -mt-1 group">
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 rounded-xl bg-slate-950/60 border border-slate-800 group-hover:border-[#EB6658]/30 transition"
                      >
                        <div className="font-semibold text-slate-200 text-xs group-hover:text-white transition">
                          {commit.message}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>{commit.author}</span>
                          <span>•</span>
                          <span className="font-mono">{commit.date}</span>
                          <span className="ml-auto font-mono text-[#EB6658]/80 group-hover:text-[#EB6658]">
                            {commit.sha.substring(0, 7)}
                          </span>
                        </div>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              )
            )}
          </div>
        </div>

        {/* Right Column: Git Push & Commit Studio (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">Git Push / Commit via PAT</h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Direct GitHub Contents API
                </span>
              </div>
              <CardMinMaxButtons
                isMinimized={isPushMinimized}
                onMinimize={() => setIsPushMinimized(true)}
                onExpand={() => setIsPushMinimized(false)}
                title="Git Push / Commit Studio"
                className="ml-auto"
              />
            </div>

            {!isPushMinimized && (
              <>
            {/* Target File Path */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1">Target File Path in Repo</label>
              <input
                type="text"
                value={pushFilePath}
                onChange={(e) => setPushFilePath(e.target.value)}
                placeholder="e.g., crews/content_crew/crew.jsonc or crew.py"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none focus:border-[#EB6658]"
              />
            </div>

            {/* Commit Message */}
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1">Commit Message</label>
              <input
                type="text"
                value={pushCommitMessage}
                onChange={(e) => setPushCommitMessage(e.target.value)}
                placeholder="e.g., feat(agents): add autonomous research agent"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#EB6658]"
              />
            </div>

            {/* Code Content */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
                <span>File Content to Commit</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPushFilePath('crew.py');
                      setPushFileContent(`from crewai import Agent, Task, Crew, Process

researcher = Agent(
    role="Senior AI Scout",
    goal="Discover breakthroughs in multi-agent collaboration",
    verbose=True
)

task = Task(
    description="Analyze GitHub repos and write report",
    expected_output="Markdown brief",
    agent=researcher
)

crew = Crew(agents=[researcher], tasks=[task], process=Process.sequential)
crew.kickoff()`);
                      addLog('Loaded standalone Python template into Push Editor.');
                    }}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Template: crew.py
                  </button>
                </div>
              </div>
              <textarea
                rows={9}
                value={pushFileContent}
                onChange={(e) => setPushFileContent(e.target.value)}
                className="w-full bg-[#080C14] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono outline-none focus:border-[#EB6658] resize-none leading-relaxed"
              />
            </div>

            {/* Push Button */}
            <button
              type="button"
              disabled={isPushing}
              onClick={handlePushCommit}
              className="w-full py-2.5 bg-gradient-to-r from-[#EB6658] to-[#C94C3C] disabled:opacity-50 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-[#EB6658]/20 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isPushing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Pushing Commit to GitHub...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Commit & Push to {selectedRepo}</span>
                </>
              )}
            </button>
              </>
            )}
          </div>

          {/* Sync Audit Logs */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>Real-Time Git Sync Stream</span>
              </span>
              <CardMinMaxButtons
                isMinimized={isSyncLogsMinimized}
                onMinimize={() => setIsSyncLogsMinimized(true)}
                onExpand={() => setIsSyncLogsMinimized(false)}
                title="Real-Time Git Sync Stream"
                className="ml-auto"
              />
            </div>
            {!isSyncLogsMinimized && (
              <div className="h-32 overflow-y-auto p-2.5 rounded-xl bg-[#080C14] border border-slate-800 font-mono text-[10px] text-slate-400 space-y-1">
                {syncLogs.map((log, lIdx) => (
                  <div
                    key={lIdx}
                    className={`leading-relaxed ${
                      log.includes('SUCCESS')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('ERROR')
                        ? 'text-red-400 font-bold'
                        : log.includes('PULL')
                        ? 'text-sky-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
