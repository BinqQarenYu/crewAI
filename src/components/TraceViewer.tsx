import React, { useState } from 'react';
import { 
  Activity, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  Search, 
  Filter, 
  Layers, 
  ArrowUpRight,
  Database,
  Sliders,
  Terminal,
  Zap,
  BarChart3
} from 'lucide-react';
import { ObservabilityDashboard } from './ObservabilityDashboard';
import { DashboardView } from './DashboardView';

interface TraceSpan {
  id: string;
  name: string;
  agent: string;
  type: 'llm_call' | 'tool_execution' | 'agent_step' | 'delegation';
  durationMs: number;
  tokens: { prompt: number; completion: number; total: number };
  status: 'success' | 'error';
  timestamp: string;
  details: {
    model?: string;
    temperature?: number;
    promptSnippet?: string;
    outputSnippet?: string;
    toolParams?: Record<string, any>;
  };
}

const SAMPLE_SPANS: TraceSpan[] = [
  {
    id: 'span-001',
    name: 'Crew Kickoff: Tech Research Pipeline',
    agent: 'Root Orchestrator',
    type: 'agent_step',
    durationMs: 4120,
    tokens: { prompt: 1840, completion: 620, total: 2460 },
    status: 'success',
    timestamp: '05:41:12',
    details: {
      promptSnippet: 'Execute comprehensive research on multi-agent execution patterns.',
      outputSnippet: 'Produced verified research brief with citations.'
    }
  },
  {
    id: 'span-002',
    name: 'LLM Generation (Reasoning & Tool Selection)',
    agent: 'Dr. Evelyn Vance (Researcher)',
    type: 'llm_call',
    durationMs: 980,
    tokens: { prompt: 620, completion: 140, total: 760 },
    status: 'success',
    timestamp: '05:41:13',
    details: {
      model: 'gemini/gemini-2.5-flash',
      temperature: 0.2,
      promptSnippet: 'System: You are Dr. Evelyn Vance, Senior Tech Researcher. Task: Find 2026 multi-agent benchmarks.',
      outputSnippet: 'Action: SerperDevTool(query="autonomous agents benchmarks 2026")'
    }
  },
  {
    id: 'span-003',
    name: 'SerperDevTool.search("autonomous agents benchmarks 2026")',
    agent: 'Dr. Evelyn Vance (Researcher)',
    type: 'tool_execution',
    durationMs: 420,
    tokens: { prompt: 40, completion: 380, total: 420 },
    status: 'success',
    timestamp: '05:41:14',
    details: {
      toolParams: { query: 'autonomous agents benchmarks 2026', num_results: 5 },
      outputSnippet: 'Retrieved 5 authoritative articles on durable execution and Langfuse telemetry.'
    }
  },
  {
    id: 'span-004',
    name: 'Agent Delegation -> Marcus Sterling',
    agent: 'Dr. Evelyn Vance (Researcher)',
    type: 'delegation',
    durationMs: 120,
    tokens: { prompt: 210, completion: 45, total: 255 },
    status: 'success',
    timestamp: '05:41:15',
    details: {
      promptSnippet: 'Delegate raw findings to Lead Technical Journalist for narrative refinement.'
    }
  },
  {
    id: 'span-005',
    name: 'LLM Synthesis: Technical Brief',
    agent: 'Marcus Sterling (Journalist)',
    type: 'llm_call',
    durationMs: 1600,
    tokens: { prompt: 970, completion: 435, total: 1405 },
    status: 'success',
    timestamp: '05:41:16',
    details: {
      model: 'gemini/gemini-2.5-flash',
      temperature: 0.3,
      promptSnippet: 'Draft executive report with sections for Executive Summary and Architectural Principles.',
      outputSnippet: '# Executive Brief: 2026 Multi-Agent Paradigms...'
    }
  }
];

export const TraceViewer: React.FC = () => {
  const [activeView, setActiveView] = useState<'traces' | 'dashboard'>('dashboard');
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan>(SAMPLE_SPANS[0]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {activeView === 'traces' ? 'Observability & OpenTelemetry Tracing' : 'Agent Performance & Trace Analytics Dashboard'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {activeView === 'traces' 
              ? 'Real-time execution telemetry, token audits, and sub-millisecond span waterfall breakdown.' 
              : 'Recharts visualizations of agent execution efficiency, P50/P95 latency distribution, and success rates from historical trace data.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-[#EB6658] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Recharts Dashboard</span>
            </button>
            <button
              onClick={() => setActiveView('traces')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeView === 'traces'
                  ? 'bg-[#EB6658] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Trace Spans</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block mx-1" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>OTel Collector Connected</span>
            </span>
          </div>
        </div>
      </div>

      {activeView === 'dashboard' ? (
        <div className="space-y-6">
          <DashboardView />
          <ObservabilityDashboard />
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-slate-400 text-xs">Total Traced Runs</span>
              <div className="text-xl sm:text-2xl font-bold text-white mt-1">1,248</div>
              <span className="text-[10px] text-emerald-400 font-medium">99.8% Success Rate</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-slate-400 text-xs">Avg Pipeline Latency</span>
              <div className="text-xl sm:text-2xl font-bold text-white mt-1">3.42s</div>
              <span className="text-[10px] text-slate-400 font-medium">P95: 5.10s</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-slate-400 text-xs">Total Tokens Audited</span>
              <div className="text-xl sm:text-2xl font-bold text-white mt-1">2.41M</div>
              <span className="text-[10px] text-[#EB6658] font-medium">$0.0018 / run</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80">
              <span className="text-slate-400 text-xs">Tool Invocations</span>
              <div className="text-xl sm:text-2xl font-bold text-white mt-1">4,819</div>
              <span className="text-[10px] text-emerald-400 font-medium">0 sandbox faults</span>
            </div>
          </div>

          {/* Waterfall & Span Inspector Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Waterfall Spans (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-semibold text-slate-300">Execution Waterfall (5 Spans)</span>
                <span>Total Duration: 4,120ms</span>
              </div>

              <div className="space-y-2">
                {SAMPLE_SPANS.map((span) => {
                  const isSelected = selectedSpan.id === span.id;
                  const widthPct = Math.max(15, Math.min(100, (span.durationMs / 4120) * 100));

                  return (
                    <div
                      key={span.id}
                      onClick={() => setSelectedSpan(span)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-slate-900/90 border-[#EB6658] ring-1 ring-[#EB6658]'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-white truncate max-w-[70%]">
                          {span.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#EB6658]">
                          {span.durationMs}ms
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                        <span>{span.agent}</span>
                        <span className="font-mono">{span.tokens.total} tokens</span>
                      </div>

                      {/* Latency Bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#EB6658] to-[#C94C3C] rounded-full"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Span Detail Inspector (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#EB6658]" />
                    <h3 className="text-sm font-bold text-white">Span Inspector</h3>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedSpan.id}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Span Name</span>
                  <p className="font-semibold text-white">{selectedSpan.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block mb-1">Agent Executor</span>
                    <p className="text-slate-200 font-medium">{selectedSpan.agent}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Status</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Success (200)</span>
                    </span>
                  </div>
                </div>

                {selectedSpan.details.model && (
                  <div>
                    <span className="text-slate-400 block mb-1">Model & Temperature</span>
                    <p className="font-mono text-[#EB6658]">
                      {selectedSpan.details.model} (t={selectedSpan.details.temperature})
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-1">Tokens Breakdown</span>
                  <div className="flex gap-4 font-mono text-[11px] text-slate-300">
                    <span>Prompt: {selectedSpan.tokens.prompt}</span>
                    <span>Completion: {selectedSpan.tokens.completion}</span>
                    <span className="text-white font-bold">Total: {selectedSpan.tokens.total}</span>
                  </div>
                </div>

                {selectedSpan.details.promptSnippet && (
                  <div>
                    <span className="text-slate-400 block mb-1">Input / Prompt Context</span>
                    <div className="p-2.5 rounded-lg bg-[#080C14] border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                      {selectedSpan.details.promptSnippet}
                    </div>
                  </div>
                )}

                {selectedSpan.details.outputSnippet && (
                  <div>
                    <span className="text-slate-400 block mb-1">Generated Output / Tool Result</span>
                    <div className="p-2.5 rounded-lg bg-[#080C14] border border-slate-800 font-mono text-[11px] text-emerald-400/90 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                      {selectedSpan.details.outputSnippet}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
