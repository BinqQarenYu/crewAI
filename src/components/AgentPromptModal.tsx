import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink, Sparkles, BookOpen } from 'lucide-react';

interface AgentPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentPromptModal: React.FC<AgentPromptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const agentSetupPrompt = `Set up this environment so I can build with CrewAI.

First install the official CrewAI coding-agent skills if this environment supports npx:

npx skills add crewaiinc/skills

If npx is missing or the current agent cannot load skills, do not fail the whole setup. Report the exact issue and continue using the CrewAI docs directly.

Use these CrewAI docs as source of truth before making assumptions:
- https://skills.crewai.com
- https://docs.crewai.com/llms.txt
- https://docs.crewai.com/en/installation
- https://docs.crewai.com/en/guides/coding-tools/build-with-ai

Setup steps:
1. Check python3 --version. CrewAI requires Python >=3.10 and <3.14.
2. Install uv if missing:
   curl -LsSf https://astral.sh/uv/install.sh | sh
3. Source the uv environment if needed:
   source "$HOME/.local/bin/env"
4. Install the CrewAI CLI:
   uv tool install crewai
5. Verify the CLI:
   crewai version
   crewai create --help
6. Create a project:
   CREWAI_DMN=true crewai create
7. After project creation, inspect the generated files before editing.
8. Run:
   crewai install
   crewai run

Do not hardcode API keys. Use .env.
Do not invent CLI flags. Validate with crewai --help or crewai create --help.
If a command fails, show the exact command and error, explain the likely cause, fix what you can safely fix, and retry once.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(agentSetupPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">CrewAI Coding-Agent Setup Prompt</h2>
              <p className="text-[11px] text-slate-400">Official prompt for Claude Code, Cursor, Windsurf & Codex</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Quick CLI command */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 mb-1.5 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#EB6658]" />
              <span>One-command installation via skills CLI</span>
            </div>
            <div className="flex items-center justify-between bg-black/50 p-2 rounded-lg font-mono text-[11px] text-[#EB6658] border border-slate-800/80">
              <code>npx skills add crewaiinc/skills</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('npx skills add crewaiinc/skills');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">
              Copy Full System Prompt for Coding Agents:
            </label>
            <div className="relative rounded-xl border border-slate-800 bg-[#080C14] overflow-hidden">
              <pre className="p-3 text-[11px] font-mono text-slate-300 h-64 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                <code>{agentSetupPrompt}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <a
            href="https://skills.crewai.com"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-slate-400 hover:text-[#EB6658] flex items-center gap-1 transition"
          >
            <span>Learn more at skills.crewai.com</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-[#EB6658] hover:bg-[#C94C3C] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Agent Setup Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
