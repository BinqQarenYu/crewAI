import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Send } from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

interface RemoteControlModuleProps {
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

export const RemoteControlModule: React.FC<RemoteControlModuleProps> = ({ onNotify }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
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

  const handleExecute = async () => {
    if (!input) return;
    setIsExecuting(true);
    setOutput('Executing command...');
    try {
      const res = await fetch('/api/remote-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.output || 'No output.');
        onNotify?.('success', 'Antigravity agent executed successfully.');
      } else {
        setOutput(`Error: ${data.error}`);
        onNotify?.('error', 'Remote control execution failed.');
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
      onNotify?.('error', 'Remote control execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Terminal className="w-4 h-4" />
          </span>
          <h3>Remote Control (Antigravity Agent)</h3>
        </div>

        <CardMinMaxButtons
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onExpand={() => setIsMinimized(false)}
          title="Remote Control (Antigravity Agent)"
          className="ml-auto"
        />
      </div>

      {!isMinimized && (
        <div className="space-y-3 pt-1 border-t border-slate-800/80">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command for the antigravity agent..."
              className="flex-grow px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Run</span>
            </button>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs h-36 overflow-y-auto whitespace-pre-wrap border border-slate-800">
            {output || 'Agent output will appear here.'}
          </div>
        </div>
      )}
    </div>
  );
};
