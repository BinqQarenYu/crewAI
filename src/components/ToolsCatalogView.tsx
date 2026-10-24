import React, { useState } from 'react';
import { TOOLS_CATALOG } from '../data/toolsCatalog';
import {
  Wrench,
  Search,
  Key,
  Copy,
  Check,
  Sparkles,
  Mail,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { GmailWorkspacePanel } from './GmailWorkspacePanel';
import { SkillSeekersAndRemotePCHub } from './SkillSeekersAndRemotePCHub';

interface ToolsCatalogViewProps {
  onEquipInStudio?: (toolName: string) => void;
  onUseEmailInStudio?: (formattedTopic: string) => void;
}

export const ToolsCatalogView: React.FC<ToolsCatalogViewProps> = ({
  onEquipInStudio,
  onUseEmailInStudio,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLiveGmailConsole, setShowLiveGmailConsole] = useState<boolean>(true);
  const [showSkillSeekersHub, setShowSkillSeekersHub] = useState<boolean>(true);

  const categories = [
    { id: 'all', label: 'All Tools & Skills' },
    { id: 'ai_ml', label: 'Skill Seekers & AI/ML' },
    { id: 'automation', label: 'Legal Remote PC & Automation' },
    { id: 'integration', label: 'MCP & Google Workspace' },
    { id: 'search', label: 'Search & Research' },
    { id: 'scraping', label: 'Web Scraping' },
    { id: 'database', label: 'Database & SQL' },
    { id: 'files', label: 'File & Document' },
    { id: 'cloud', label: 'Cloud & SRE' },
  ];

  const filteredTools = TOOLS_CATALOG.filter((tool) => {
    const matchesCategory =
      selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.envKeys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              <Wrench className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              CrewAI Tools, Skill Seekers v3.9+ & Remote PC Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Universal skill synthesis from bingkltech/Skill_Seekers (19 sources → 23 targets, 40 MCP tools), legal multi-PC connection bridge, and official CrewAI tools.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowSkillSeekersHub((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{showSkillSeekersHub ? 'Hide Skill Seekers & PC Hub' : 'Open Skill Seekers & PC Hub'}</span>
            {showSkillSeekersHub ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setShowLiveGmailConsole((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-red-400" />
            <span>{showLiveGmailConsole ? 'Hide Gmail Console' : 'Open Live Gmail Tool'}</span>
            {showLiveGmailConsole ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search Skill Seekers, Remote PC, tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 pl-9 pr-3 py-2 rounded-xl focus:border-[#EB6658] outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === cat.id
                ? 'bg-[#EB6658] text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Skill Seekers v3.9+ Universal Engine & Legal Multi-PC Connection Hub */}
      {showSkillSeekersHub && (
        <SkillSeekersAndRemotePCHub
          onEquipInStudio={onEquipInStudio}
          onUseSkillPromptInStudio={onUseEmailInStudio}
        />
      )}

      {/* Live Connected Gmail Workspace Tool Console inside the Catalog */}
      {showLiveGmailConsole &&
        (selectedCategory === 'all' || selectedCategory === 'integration') && (
          <GmailWorkspacePanel onUseEmailAsCrewInput={onUseEmailInStudio} />
        )}

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTools.map((tool) => {
          const isGmail = tool.id === 'gmail_toolkit';
          return (
            <div
              key={tool.id}
              className={`p-5 rounded-2xl transition flex flex-col justify-between group space-y-4 ${
                isGmail
                  ? 'bg-gradient-to-b from-red-950/30 to-slate-900/60 border border-red-500/40 hover:border-red-400/70'
                  : 'bg-slate-900/40 border border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Category & Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border font-semibold ${
                      isGmail
                        ? 'text-red-300 bg-red-500/15 border-red-500/30'
                        : 'text-[#EB6658] bg-[#EB6658]/10 border-[#EB6658]/20'
                    }`}
                  >
                    {tool.categoryLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isGmail && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Connected</span>
                      </span>
                    )}
                    {tool.popular && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Popular</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Desc */}
                <h3 className="text-base font-bold text-white group-hover:text-[#EB6658] transition">
                  {tool.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {tool.description}
                </p>

                {/* Environment Variables Required */}
                {tool.envKeys.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <Key className="w-3 h-3 text-slate-500" />
                    {tool.envKeys.map((key) => (
                      <span
                        key={key}
                        className="text-[10px] font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                )}

                {isGmail && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowLiveGmailConsole(true)}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                    >
                      <Mail className="w-3.5 h-3.5 text-red-400" />
                      <span>Use Live Gmail Console Above</span>
                    </button>
                    {onEquipInStudio && (
                      <button
                        onClick={() => onEquipInStudio('GmailToolkit')}
                        className="px-3 py-1.5 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-[11px] font-semibold transition"
                      >
                        Equip in Crew Studio
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Code Snippet Box */}
              <div className="rounded-xl border border-slate-800 bg-[#080C14] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px]">
                  <span className="font-mono text-slate-400">Usage Snippet</span>
                  <button
                    onClick={() => copyCode(tool.codeSnippet, tool.id)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 transition"
                  >
                    {copiedId === tool.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                  <code>{tool.codeSnippet}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
