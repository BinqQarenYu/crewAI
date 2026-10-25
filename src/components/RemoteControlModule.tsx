import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Send, Server, ShieldCheck } from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

interface RemoteControlModuleProps {
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

export const RemoteControlModule: React.FC<RemoteControlModuleProps> = ({ onNotify }) => {
  const [input, setInput] = useState(
    'Connect to my other PC at 192.168.1.50:8765 and run skill-seekers scan bingkltech/Skill_Seekers'
  );
  const [output, setOutput] = useState('');
  const [legalOwnerConsent, setLegalOwnerConsent] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  const handleExecute = async (overrideInput?: string) => {
    const cmdText = (overrideInput ?? input).trim();
    if (!cmdText) return;
    setIsExecuting(true);
    setOutput('Connecting & executing across Authorized Remote PC / Skill Seekers v3.9+ Bridge...');
    try {
      const res = await fetch('/api/remote-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: cmdText,
          legalOwnerConsent,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.output || 'No output.');
        onNotify?.('success', 'Remote PC & Skill Seekers command executed.');
      } else {
        setOutput(`Error: ${data.error}`);
        onNotify?.('error', data.error || 'Remote control execution failed.');
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
      onNotify?.('error', 'Remote control execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Terminal className="w-4 h-4" />
          </span>
          <div>
            <h3>Remote Control (Legal Multi-PC Bridge & Skill Seekers v3.9+)</h3>
            <p className="text-[11px] font-normal text-slate-400">
              Ask to connect to any owner-authorized PC, run Skill Seekers scans, or dispatch Antigravity tasks
            </p>
          </div>
        </div>

        <CardMinMaxButtons
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onExpand={() => setIsMinimized(false)}
          title="Remote Control (Legal Multi-PC Bridge & Skill Seekers)"
          className="ml-auto"
        />
      </div>

      {!isMinimized && (
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          {/* Quick Legal PC & Skill Seekers Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const p = 'Connect to other PC 192.168.1.50:8765 and run skill-seekers create bingkltech/Skill_Seekers --preset comprehensive';
                  setInput(p);
                  handleExecute(p);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-indigo-300 flex items-center gap-1 transition cursor-pointer"
              >
                <Server className="w-3 h-3" />
                <span>Connect LAN PC (192.168.1.50:8765)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = 'Connect to remote GPU PC 127.0.0.1:11434 and check Ollama models + Skill Seekers FTS5 index';
                  setInput(p);
                  handleExecute(p);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-300 flex items-center gap-1 transition cursor-pointer"
              >
                <span>Connect Ollama GPU PC (:11434)</span>
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-emerald-400 cursor-pointer">
              <input
                type="checkbox"
                checked={legalOwnerConsent}
                onChange={(e) => setLegalOwnerConsent(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-600"
              />
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Legal Owner Authorization Confirmed</span>
            </label>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask to connect to another PC (e.g. Connect to PC 192.168.1.50:8765) or scan skills..."
              className="flex-grow px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleExecute()}
              disabled={isExecuting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Run</span>
            </button>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs h-36 overflow-y-auto whitespace-pre-wrap border border-slate-800">
            {output || 'Ready. Ask to connect to any owner-authorized PC (LAN, Tailscale, Ollama :11434, Skill Seekers MCP :8765, OpenSSH :22) or synthesize skills from bingkltech/Skill_Seekers.'}
          </div>
        </div>
      )}
    </div>
  );
};
