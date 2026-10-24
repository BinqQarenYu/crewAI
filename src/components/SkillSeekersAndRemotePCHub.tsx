import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Globe,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Play,
  Server,
  Layers,
  Database,
  Code2,
  FileText,
  ExternalLink,
  AlertCircle,
  Network,
  Wrench,
  FolderGit2,
  HardDrive,
  Lock
} from 'lucide-react';

interface SkillSeekersSourceType {
  id: string;
  name: string;
  cliExample: string;
  category: 'code_and_web' | 'documents_and_media' | 'enterprise_and_chat' | 'remote_pc_mesh';
  description: string;
  supportedByDefault: boolean;
}

interface SkillSeekersExportTarget {
  id: string;
  name: string;
  group: 'llm_platform' | 'rag_vector' | 'ide_and_agent';
  outputFormat: string;
  cliFlag: string;
}

interface SynthesizedSkillAsset {
  id: string;
  name: string;
  sourceInput: string;
  sourceType: string;
  preset: 'quick' | 'standard' | 'comprehensive';
  qualityScore: number;
  fts5Indexed: boolean;
  gofPatternsDetected: string[];
  exportedTargets: string[];
  createdAt: string;
  providerUsed: string;
  skillMarkdown: string;
  crewAiToolSnippet: string;
}

interface AuthorizedRemotePcNode {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http_agent_mesh' | 'ollama_gpu_node' | 'skill_seekers_mcp' | 'openssh_authorized' | 'tailscale_lan_peer';
  osPlatform: 'Windows 11 / Server' | 'Linux (Ubuntu/Debian)' | 'macOS (Apple Silicon)' | 'Docker / WSL2 Node';
  authMethod: 'mutual_bearer_token' | 'six_digit_pin' | 'ssh_ed25519_key' | 'tailscale_acl';
  maskedCredential: string;
  legalOwnerConsent: boolean;
  legalAttestationText: string;
  allowedScopes: Array<'skill_seekers_scan' | 'ollama_gpu_infer' | 'repo_git_sync' | 'authorized_shell_diag'>;
  status: 'online_direct' | 'paired_companion_bridge' | 'standby';
  latencyMs: number;
  detectedCapabilities: string[];
  lastConnectedAt: string;
  lastCommandOutput?: string;
}

interface RemotePcAuditRecord {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeName: string;
  hostEndpoint: string;
  action: string;
  legalConsentVerified: boolean;
  protocolUsed: string;
  status: 'completed' | 'blocked_missing_consent';
  summary: string;
}

interface SkillSeekersAndRemotePCHubProps {
  onEquipInStudio?: (toolName: string) => void;
  onUseSkillPromptInStudio?: (formattedPrompt: string) => void;
}

export const SkillSeekersAndRemotePCHub: React.FC<SkillSeekersAndRemotePCHubProps> = ({
  onEquipInStudio,
  onUseSkillPromptInStudio
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'skill_seekers' | 'remote_pc_mesh'>('skill_seekers');

  // Skill Seekers State
  const [sourceTypes, setSourceTypes] = useState<SkillSeekersSourceType[]>([]);
  const [exportTargets, setExportTargets] = useState<SkillSeekersExportTarget[]>([]);
  const [synthesizedSkills, setSynthesizedSkills] = useState<SynthesizedSkillAsset[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('skill-ss-core');

  // Skill Synthesis Form State
  const [sourceInput, setSourceInput] = useState<string>('https://github.com/bingkltech/Skill_Seekers.git');
  const [sourceType, setSourceType] = useState<string>('github');
  const [preset, setPreset] = useState<'quick' | 'standard' | 'comprehensive'>('comprehensive');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([
    'crewai-studio',
    'gemini',
    'claude',
    'langchain',
    'qdrant',
    'cursor'
  ]);
  const [enableFts5Index, setEnableFts5Index] = useState<boolean>(true);
  const [targetRemotePcId, setTargetRemotePcId] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Remote PC State
  const [pcNodes, setPcNodes] = useState<AuthorizedRemotePcNode[]>([]);
  const [auditLogs, setAuditLogs] = useState<RemotePcAuditRecord[]>([]);
  const [companionPairToken, setCompanionPairToken] = useState<string>('CREW-LEGAL-PC-9942-AUTH');
  const [bootstrapScripts, setBootstrapScripts] = useState<{
    windowsPowerShell: string;
    linuxMacBash: string;
  }>({
    windowsPowerShell: '',
    linuxMacBash: ''
  });

  // Natural Language "Ask to Connect to Other PC" Bar
  const [askPcPrompt, setAskPcPrompt] = useState<string>(
    'Connect to my other PC at 192.168.1.50:8765 and run skill-seekers scan on https://github.com/bingkltech/Skill_Seekers.git'
  );
  const [askLegalConsent, setAskLegalConsent] = useState<boolean>(true);
  const [isExecutingAsk, setIsExecutingAsk] = useState<boolean>(false);
  const [askOutput, setAskOutput] = useState<string>('');

  // Connect New PC Form State
  const [newPcName, setNewPcName] = useState<string>('Workstation PC #2 (Dev & GPU)');
  const [newPcHost, setNewPcHost] = useState<string>('192.168.1.88');
  const [newPcPort, setNewPcPort] = useState<number>(8765);
  const [newPcProtocol, setNewPcProtocol] = useState<AuthorizedRemotePcNode['protocol']>('skill_seekers_mcp');
  const [newPcOs, setNewPcOs] = useState<AuthorizedRemotePcNode['osPlatform']>('Windows 11 / Server');
  const [newPcAuthMethod, setNewPcAuthMethod] = useState<AuthorizedRemotePcNode['authMethod']>('mutual_bearer_token');
  const [newPcToken, setNewPcToken] = useState<string>('CREW-LEGAL-PC-9942-AUTH');
  const [newPcLegalConsent, setNewPcLegalConsent] = useState<boolean>(true);
  const [isConnectingPc, setIsConnectingPc] = useState<boolean>(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchAllStatus = useCallback(async () => {
    try {
      const [ssRes, pcRes] = await Promise.all([
        fetch('/api/skill-seekers/status'),
        fetch('/api/remote-pc/status')
      ]);
      if (ssRes.ok) {
        const ssData = await ssRes.json();
        if (Array.isArray(ssData.sourceTypes)) setSourceTypes(ssData.sourceTypes);
        if (Array.isArray(ssData.exportTargets)) setExportTargets(ssData.exportTargets);
        if (Array.isArray(ssData.synthesizedSkills)) {
          setSynthesizedSkills(ssData.synthesizedSkills);
        }
      }
      if (pcRes.ok) {
        const pcData = await pcRes.json();
        if (Array.isArray(pcData.nodes)) setPcNodes(pcData.nodes);
        if (Array.isArray(pcData.auditLogs)) setAuditLogs(pcData.auditLogs);
        if (pcData.companionPairToken) setCompanionPairToken(pcData.companionPairToken);
        if (pcData.bootstrapScripts) setBootstrapScripts(pcData.bootstrapScripts);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchAllStatus();
  }, [fetchAllStatus]);

  const toggleTarget = (targetId: string) => {
    setSelectedTargets((prev) =>
      prev.includes(targetId)
        ? prev.length > 1
          ? prev.filter((id) => id !== targetId)
          : prev
        : [...prev, targetId]
    );
  };

  const handleSynthesizeSkill = async () => {
    if (!sourceInput.trim() || isSynthesizing) return;
    setIsSynthesizing(true);
    setBannerMessage({
      type: 'info',
      text: `Running Skill Seekers v3.9.0+ C3.x pipeline on "${sourceInput}" (${selectedTargets.length} export targets)...`
    });
    try {
      const res = await fetch('/api/skill-seekers/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceInput: sourceInput.trim(),
          sourceType,
          preset,
          targets: selectedTargets,
          enableFts5Index,
          remotePcId: targetRemotePcId || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.skill) {
        setSynthesizedSkills(data.state?.synthesizedSkills || [data.skill, ...synthesizedSkills]);
        setSelectedSkillId(data.skill.id);
        setBannerMessage({
          type: 'success',
          text: `Synthesized skill "${data.skill.name}" (Quality Gate: ${data.skill.qualityScore}/10) across ${data.skill.exportedTargets.length} targets!`
        });
        fetchAllStatus();
      } else {
        setBannerMessage({
          type: 'error',
          text: data.error || 'Skill synthesis failed.'
        });
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err?.message || 'Network error during skill synthesis.'
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleAskConnectPc = async () => {
    if (!askPcPrompt.trim() || isExecutingAsk) return;
    setIsExecutingAsk(true);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/remote-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: askPcPrompt.trim(),
          environment: 'remote',
          legalOwnerConsent: askLegalConsent
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAskOutput(data.output || 'Completed on remote PC.');
        setBannerMessage({
          type: 'success',
          text: 'Legal Remote PC connection & command execution completed.'
        });
        fetchAllStatus();
      } else {
        setAskOutput(`Error: ${data.error}`);
        setBannerMessage({
          type: 'error',
          text: data.error || 'Remote PC request blocked.'
        });
      }
    } catch (err: any) {
      setAskOutput(`Error: ${err?.message || 'Request failed'}`);
    } finally {
      setIsExecutingAsk(false);
    }
  };

  const handleConnectNewPc = async () => {
    if (!newPcHost.trim() || isConnectingPc) return;
    setIsConnectingPc(true);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/remote-pc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPcName.trim() || `Authorized PC (${newPcHost})`,
          host: newPcHost.trim(),
          port: newPcPort,
          protocol: newPcProtocol,
          osPlatform: newPcOs,
          authMethod: newPcAuthMethod,
          authTokenOrPin: newPcToken,
          legalOwnerConsent: newPcLegalConsent,
          legalAttestationText:
            'I confirm I own or have explicit written authorization to connect to and execute commands/skills on this remote machine.'
        })
      });
      const data = await res.json();
      if (res.ok && data.node) {
        setPcNodes(data.state?.nodes || [data.node, ...pcNodes]);
        setAuditLogs(data.state?.auditLogs || auditLogs);
        setBannerMessage({
          type: 'success',
          text: `Connected & verified "${data.node.name}" (${data.node.host}:${data.node.port}) under legal owner authorization.`
        });
      } else {
        setBannerMessage({
          type: 'error',
          text: data.error || 'Failed to connect remote PC.'
        });
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err?.message || 'Network error while connecting remote PC.'
      });
    } finally {
      setIsConnectingPc(false);
    }
  };

  const handleRunTaskOnNode = async (
    node: AuthorizedRemotePcNode,
    taskType: 'skill_seekers_scan' | 'ollama_gpu_infer' | 'authorized_shell_diag',
    commandOrPrompt: string
  ) => {
    setExecutingNodeId(node.id);
    try {
      const res = await fetch('/api/remote-pc/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          taskType,
          commandOrPrompt,
          legalOwnerConsent: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.state?.nodes) setPcNodes(data.state.nodes);
        if (data.state?.auditLogs) setAuditLogs(data.state.auditLogs);
        setAskOutput(data.output || '');
        setBannerMessage({
          type: 'success',
          text: `Executed "${commandOrPrompt}" on ${node.name} (${node.host}:${node.port}).`
        });
      }
    } catch {
      // Ignore
    } finally {
      setExecutingNodeId(null);
    }
  };

  const activeSkill =
    synthesizedSkills.find((s) => s.id === selectedSkillId) || synthesizedSkills[0];

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 sm:p-6 space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Skill Seekers v3.9+ Universal Hub & Legal Multi-PC Bridge
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Powered by{' '}
            <a
              href="https://github.com/bingkltech/Skill_Seekers"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline font-mono"
            >
              bingkltech/Skill_Seekers
            </a>{' '}
            · 19 Source Types · 23 Export Targets · 40 MCP Tools · Legal Consent-Verified Remote PC Mesh
          </p>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl self-start">
          <button
            onClick={() => setActiveSubTab('skill_seekers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'skill_seekers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Skill Seekers Engine (19 Sources → 23 Targets)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('remote_pc_mesh')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'remote_pc_mesh'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connect to Other PC (Legal Mesh · {pcNodes.length} Nodes)</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {bannerMessage && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : bannerMessage.type === 'error'
              ? 'bg-red-950/40 border-red-500/40 text-red-200'
              : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-white text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 1: SKILL SEEKERS v3.9.0+ UNIVERSAL ENGINE
         ===================================================================== */}
      {activeSubTab === 'skill_seekers' && (
        <div className="space-y-6">
          {/* Quick Presets Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5">
            <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">Quick Repository & Source Presets:</span>
              <button
                onClick={() => {
                  setSourceInput('https://github.com/bingkltech/Skill_Seekers.git');
                  setSourceType('github');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 font-mono text-[11px] transition cursor-pointer"
              >
                bingkltech/Skill_Seekers.git
              </button>
              <button
                onClick={() => {
                  setSourceInput('https://github.com/bingkltech/crewAI.git');
                  setSourceType('github');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 font-mono text-[11px] transition cursor-pointer"
              >
                bingkltech/crewAI.git
              </button>
              <button
                onClick={() => {
                  setSourceInput('remote-pc://192.168.1.50:8765/workspace');
                  setSourceType('remote_pc_node');
                  setTargetRemotePcId(pcNodes[1]?.id || pcNodes[0]?.id || '');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[11px] transition cursor-pointer"
              >
                remote-pc://192.168.1.50:8765 (Other PC)
              </button>
              <button
                onClick={() => {
                  setSourceInput('https://docs.crewai.com/');
                  setSourceType('docs_web');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 font-mono text-[11px] transition cursor-pointer"
              >
                https://docs.crewai.com/ (llms.txt SPA)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>19 Sources</span>
              <span aria-hidden="true">·</span>
              <span>23 Export Targets</span>
              <span aria-hidden="true">·</span>
              <span>40 MCP Tools</span>
            </div>
          </div>

          {/* Main 2-Column Synthesis & Live Skill Output */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Synthesis Controls */}
            <div className="lg:col-span-5 space-y-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  01. Configure Skill Seekers C3.x Pipeline
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  v3.9.0+ · FTS5 Ready
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Source URL, GitHub Repo, File Path, or Remote PC URI
                  </label>
                  <input
                    type="text"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    placeholder="https://github.com/bingkltech/Skill_Seekers.git"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Source Type (19 Supported)
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      {sourceTypes.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Analysis Depth Preset
                    </label>
                    <select
                      value={preset}
                      onChange={(e) => setPreset(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="quick">quick (1–2 min surface scan)</option>
                      <option value="standard">standard (balanced AST + docs)</option>
                      <option value="comprehensive">comprehensive (deep C3.x + 10 GoF patterns)</option>
                    </select>
                  </div>
                </div>

                {/* Optional Remote PC Execution Host */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Execution Host (Local Studio or Connected Legal Remote PC)
                  </label>
                  <select
                    value={targetRemotePcId}
                    onChange={(e) => setTargetRemotePcId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Primary CrewAI Studio Node (Patient Gemini / Ollama)</option>
                    {pcNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        Remote PC: {node.name} ({node.host}:{node.port} · {node.protocol})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Export Targets Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Export Targets ({selectedTargets.length} of 23 selected)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTargets(
                          selectedTargets.length === exportTargets.length
                            ? ['crewai-studio', 'gemini', 'claude', 'langchain']
                            : exportTargets.map((t) => t.id)
                        )
                      }
                      className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedTargets.length === exportTargets.length ? 'Reset Default' : 'Select All 23'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    {exportTargets.map((t) => {
                      const active = selectedTargets.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTarget(t.id)}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white font-semibold'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FTS5 SQLite Toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={enableFts5Index}
                    onChange={(e) => setEnableFts5Index(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Build SQLite FTS5 Search Index (<code className="font-mono text-indigo-300">--index</code>) so agents query exact <code className="font-mono">file#anchor</code> before reading
                  </span>
                </label>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSynthesizeSkill}
                    disabled={isSynthesizing}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isSynthesizing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>
                      {isSynthesizing
                        ? 'Synthesizing Skill Asset...'
                        : 'Synthesize Skill & Package Targets'}
                    </span>
                  </button>

                  {onEquipInStudio && (
                    <button
                      onClick={() => onEquipInStudio('SkillSeekersUniversalTool')}
                      className="px-3.5 py-2.5 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Equip in Crew Studio
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Synthesized SKILL.md & CrewAI Tool Output */}
            <div className="lg:col-span-7 space-y-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      02. Synthesized Skill Packages ({synthesizedSkills.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Select any synthesized asset below to inspect its SKILL.md and CrewAI agent tool code.
                    </p>
                  </div>

                  {/* Skill Selector Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {synthesizedSkills.map((sk) => (
                      <button
                        key={sk.id}
                        onClick={() => setSelectedSkillId(sk.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition cursor-pointer ${
                          activeSkill?.id === sk.id
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {sk.name}
                      </button>
                    ))}
                  </div>
                </div>

                {activeSkill && (
                  <div className="space-y-3">
                    {/* Metadata Row (Unboxed clean typography per anti-slop rules) */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-white font-semibold">{activeSkill.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>Quality Score: {activeSkill.qualityScore}/10</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSkill.fts5Indexed ? 'SQLite FTS5 Indexed' : 'Standard Markdown'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSkill.providerUsed}</span>
                    </div>

                    {/* GoF Patterns Detected */}
                    <div className="text-xs text-slate-300 bg-slate-900/70 border border-slate-800/80 rounded-lg p-2.5">
                      <span className="font-semibold text-indigo-300">C3.x GoF & Architectural Patterns Detected: </span>
                      <span>{activeSkill.gofPatternsDetected.join(' · ')}</span>
                    </div>

                    {/* SKILL.md Preview */}
                    <div className="rounded-xl border border-slate-800 bg-[#070B12] overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px]">
                        <span className="font-mono text-slate-300">
                          output/{activeSkill.name}/SKILL.md
                        </span>
                        <div className="flex items-center gap-2">
                          {onUseSkillPromptInStudio && (
                            <button
                              onClick={() =>
                                onUseSkillPromptInStudio(
                                  `Use Skill Seekers asset "${activeSkill.name}" from ${activeSkill.sourceInput} (${activeSkill.exportedTargets.join(', ')}) to architect and verify the current repository.`
                                )
                              }
                              className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                            >
                              Send to Crew Studio Input
                            </button>
                          )}
                          <button
                            onClick={() => copyText(activeSkill.skillMarkdown, `md-${activeSkill.id}`)}
                            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                          >
                            {copiedKey === `md-${activeSkill.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy SKILL.md</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                        <code>{activeSkill.skillMarkdown}</code>
                      </pre>
                    </div>

                    {/* CrewAI Python Tool Snippet */}
                    <div className="rounded-xl border border-slate-800 bg-[#070B12] overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px]">
                        <span className="font-mono text-slate-300">
                          CrewAI 8-Agent Workforce Tool Integration
                        </span>
                        <button
                          onClick={() => copyText(activeSkill.crewAiToolSnippet, `py-${activeSkill.id}`)}
                          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                        >
                          {copiedKey === `py-${activeSkill.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Python Tool</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3 text-[11px] font-mono text-indigo-200 overflow-x-auto leading-relaxed">
                        <code>{activeSkill.crewAiToolSnippet}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 2: LEGAL CONSENT-VERIFIED MULTI-PC CONNECTION BRIDGE
         ===================================================================== */}
      {activeSubTab === 'remote_pc_mesh' && (
        <div className="space-y-6">
          {/* Legal & Consent Policy Callout */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Legal & Owner-Authorized Multi-PC Connection Policy Active</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Whenever asked to connect to another PC, this bridge connects immediately <strong>as long as legal owner/administrator authorization is confirmed</strong>. Uses standard developer protocols only: Skill Seekers MCP (<code className="font-mono">:8765</code>), Ollama GPU REST (<code className="font-mono">:11434</code>), HTTP/WebSocket Companion Mesh, Tailscale ACLs, or Authorized OpenSSH (<code className="font-mono">:22</code>).
              </p>
            </div>
            {onEquipInStudio && (
              <button
                onClick={() => onEquipInStudio('AuthorizedRemotePCBridgeTool')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 transition cursor-pointer"
              >
                Equip Remote PC Tool in Studio
              </button>
            )}
          </div>

          {/* Natural Language "Ask to Connect to Other PC" Bar */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>01. Ask to Connect to Any Authorized PC (Natural Language Bridge)</span>
              </h3>
              <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={askLegalConsent}
                  onChange={(e) => setAskLegalConsent(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600"
                />
                <span>I confirm legal ownership / explicit permission for the target PC</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={askPcPrompt}
                onChange={(e) => setAskPcPrompt(e.target.value)}
                placeholder="e.g., Connect to my other PC at 192.168.1.50:8765 and scan skills..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-emerald-500 outline-none"
              />
              <button
                onClick={handleAskConnectPc}
                disabled={isExecutingAsk}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shrink-0 transition cursor-pointer"
              >
                {isExecutingAsk ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Connect & Execute on PC</span>
              </button>
            </div>

            {askOutput && (
              <pre className="p-3.5 rounded-xl bg-[#070B12] border border-slate-800 text-xs font-mono text-emerald-200 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {askOutput}
              </pre>
            )}
          </div>

          {/* 2-Column Layout: Left = Register New PC + Companion Scripts | Right = Connected PC Fleet & Audit Trail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Connect Another PC Form & One-Line Companion Scripts */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  02. Pair / Connect Another PC Node
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">PC Friendly Name</label>
                    <input
                      type="text"
                      value={newPcName}
                      onChange={(e) => setNewPcName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-300 mb-1">Host / IP / Tailscale</label>
                      <input
                        type="text"
                        value={newPcHost}
                        onChange={(e) => setNewPcHost(e.target.value)}
                        placeholder="192.168.1.88"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Port</label>
                      <input
                        type="number"
                        value={newPcPort}
                        onChange={(e) => setNewPcPort(Number(e.target.value) || 8765)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Connection Protocol</label>
                      <select
                        value={newPcProtocol}
                        onChange={(e) => {
                          const proto = e.target.value as AuthorizedRemotePcNode['protocol'];
                          setNewPcProtocol(proto);
                          if (proto === 'ollama_gpu_node') setNewPcPort(11434);
                          if (proto === 'skill_seekers_mcp') setNewPcPort(8765);
                          if (proto === 'openssh_authorized') setNewPcPort(22);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none"
                      >
                        <option value="skill_seekers_mcp">Skill Seekers MCP (:8765)</option>
                        <option value="ollama_gpu_node">Ollama GPU Node (:11434)</option>
                        <option value="http_agent_mesh">HTTP/WS Companion Agent</option>
                        <option value="openssh_authorized">Authorized OpenSSH (:22)</option>
                        <option value="tailscale_lan_peer">Tailscale Private Mesh</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Remote OS</label>
                      <select
                        value={newPcOs}
                        onChange={(e) => setNewPcOs(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none"
                      >
                        <option value="Windows 11 / Server">Windows 11 / Server</option>
                        <option value="Linux (Ubuntu/Debian)">Linux (Ubuntu/Debian)</option>
                        <option value="macOS (Apple Silicon)">macOS (Apple Silicon)</option>
                        <option value="Docker / WSL2 Node">Docker / WSL2 Node</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Auth Method</label>
                      <select
                        value={newPcAuthMethod}
                        onChange={(e) => setNewPcAuthMethod(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none"
                      >
                        <option value="mutual_bearer_token">Mutual Bearer Token</option>
                        <option value="six_digit_pin">6-Digit Pairing PIN</option>
                        <option value="ssh_ed25519_key">SSH Ed25519 Key</option>
                        <option value="tailscale_acl">Tailscale Identity ACL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Pairing Token / PIN</label>
                      <input
                        type="text"
                        value={newPcToken}
                        onChange={(e) => setNewPcToken(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={newPcLegalConsent}
                      onChange={(e) => setNewPcLegalConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-600"
                    />
                    <span>
                      <strong>Legal Attestation:</strong> I confirm I own or have explicit written authorization to connect to this PC and execute Skill Seekers / CrewAI workloads.
                    </span>
                  </label>

                  <button
                    onClick={handleConnectNewPc}
                    disabled={isConnectingPc}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isConnectingPc ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span>Verify Consent & Connect Remote PC</span>
                  </button>
                </div>
              </div>

              {/* One-Command Bootstrap Scripts for the Other PC */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">
                    One-Command Setup for Your Other PC
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Token: {companionPairToken}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Run either command on your second PC to start the legal Skill Seekers MCP + Ollama listener:
                </p>

                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-800 bg-[#070B12] p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Windows PowerShell</span>
                      <button
                        onClick={() => copyText(bootstrapScripts.windowsPowerShell, 'win-ps')}
                        className="text-indigo-400 hover:underline cursor-pointer"
                      >
                        {copiedKey === 'win-ps' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {bootstrapScripts.windowsPowerShell}
                    </pre>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#070B12] p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Linux / macOS Bash</span>
                      <button
                        onClick={() => copyText(bootstrapScripts.linuxMacBash, 'nix-sh')}
                        className="text-indigo-400 hover:underline cursor-pointer"
                      >
                        {copiedKey === 'nix-sh' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {bootstrapScripts.linuxMacBash}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Authorized Remote PC Fleet & Audit Log */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    03. Connected & Authorized Remote PCs ({pcNodes.length})
                  </h3>
                  <button
                    onClick={fetchAllStatus}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Nodes</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {pcNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <h4 className="text-sm font-bold text-white">{node.name}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                            <span>
                              {node.host}:{node.port}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{node.protocol}</span>
                            <span aria-hidden="true">·</span>
                            <span>{node.osPlatform}</span>
                            <span aria-hidden="true">·</span>
                            <span>{node.latencyMs}ms</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleRunTaskOnNode(
                                node,
                                'skill_seekers_scan',
                                'skill-seekers create bingkltech/Skill_Seekers --preset comprehensive --index'
                              )
                            }
                            disabled={executingNodeId === node.id}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold transition cursor-pointer"
                          >
                            {executingNodeId === node.id ? 'Running...' : 'Run Skill Seekers Scan'}
                          </button>
                          <button
                            onClick={() =>
                              handleRunTaskOnNode(
                                node,
                                'ollama_gpu_infer',
                                'ollama list && skill-seekers quality output/Skill_Seekers/ --threshold 7'
                              )
                            }
                            disabled={executingNodeId === node.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold transition cursor-pointer"
                          >
                            Verify GPU & MCP
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        <span className="text-slate-300 font-medium">Capabilities: </span>
                        {node.detectedCapabilities.join(' · ')}
                      </div>

                      {node.lastCommandOutput && (
                        <pre className="p-2.5 rounded-lg bg-[#070B12] border border-slate-800/90 text-[11px] font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
                          {node.lastCommandOutput}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal Audit Trail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-bold text-white">
                  Immutable Legal Connection & Execution Audit Trail
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-200">
                          {log.nodeName} ({log.hostEndpoint})
                        </span>
                        <span>
                          {log.timestamp} · {log.legalConsentVerified ? 'Legal Consent Verified' : 'Blocked'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-indigo-300">{log.action}</div>
                      <div className="text-[11px] text-slate-400">{log.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
