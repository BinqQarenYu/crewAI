import React, { useMemo } from 'react';
import { 
  BarChart3, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  TrendingUp,
  Users,
  Trophy,
  AlertTriangle
} from 'lucide-react';
import { ExecutionRunRecord } from './CrewStudio';

interface AgentStats {
  agentName: string;
  totalRuns: number;
  successfulRuns: number;
  totalDurationMs: number;
  totalTokens: number;
  avgDurationMs: number;
  successRate: number;
}

export const ObservabilityDashboard: React.FC = () => {
  const history: ExecutionRunRecord[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('crewai_studio_execution_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load history for dashboard', e);
    }
    return [];
  }, []);

  const stats = useMemo(() => {
    const agentMap: Record<string, AgentStats> = {};
    let totalTokens = 0;
    let totalSuccessful = 0;
    let totalDuration = 0;
    const hourlyIntensity = new Array(24).fill(0);

    history.forEach(run => {
      totalTokens += run.tokensUsed;
      if (run.status === 'completed') totalSuccessful++;
      totalDuration += run.durationMs;

      // Extract hour for heatmap (0-23)
      try {
        const date = new Date(run.isoTime);
        const hour = date.getHours();
        if (hour >= 0 && hour <= 23) {
          hourlyIntensity[hour]++;
        }
      } catch (e) {
        // invalid date
      }

      // Extract unique agents from logs
      const agentsInRun = new Set<string>();
      run.logs.forEach(log => {
        if (log.agentName) agentsInRun.add(log.agentName);
      });

      agentsInRun.forEach(agentName => {
        if (!agentMap[agentName]) {
          agentMap[agentName] = {
            agentName,
            totalRuns: 0,
            successfulRuns: 0,
            totalDurationMs: 0,
            totalTokens: 0,
            avgDurationMs: 0,
            successRate: 0
          };
        }
        const s = agentMap[agentName];
        s.totalRuns++;
        if (run.status === 'completed') s.successfulRuns++;
        
        // Distribute run stats roughly to agents for visualization
        // In a real system, we'd have per-agent spans
        s.totalDurationMs += run.durationMs / agentsInRun.size;
        s.totalTokens += Math.floor(run.tokensUsed / agentsInRun.size);
      });
    });

    const agentList = Object.values(agentMap).map(s => ({
      ...s,
      avgDurationMs: s.totalRuns > 0 ? s.totalDurationMs / s.totalRuns : 0,
      successRate: s.totalRuns > 0 ? (s.successfulRuns / s.totalRuns) * 100 : 0
    })).sort((a, b) => b.totalRuns - a.totalRuns);

    const maxIntensity = Math.max(...hourlyIntensity, 1);

    return {
      agentList,
      totalTokens,
      avgSuccessRate: history.length > 0 ? (totalSuccessful / history.length) * 100 : 0,
      avgLatency: history.length > 0 ? totalDuration / history.length : 0,
      totalRuns: history.length,
      hourlyIntensity,
      maxIntensity
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
          <BarChart3 className="w-10 h-10 text-slate-700" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Execution Data Available</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Execute a crew in the Studio to generate telemetry data for the observability dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-12 h-12 text-[#EB6658]" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Orchestrations</span>
          <div className="text-3xl font-extrabold text-white">{stats.totalRuns}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Lifetime Activity</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-12 h-12 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Success Rate</span>
          <div className="text-3xl font-extrabold text-white">{stats.avgSuccessRate.toFixed(1)}%</div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div 
              className="h-full bg-emerald-400 rounded-full" 
              style={{ width: `${stats.avgSuccessRate}%` }} 
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-12 h-12 text-sky-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Latency</span>
          <div className="text-3xl font-extrabold text-white">{(stats.avgLatency / 1000).toFixed(2)}s</div>
          <span className="text-[11px] text-slate-400">End-to-end pipeline</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Cpu className="w-12 h-12 text-amber-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tokens Audited</span>
          <div className="text-3xl font-extrabold text-white">{(stats.totalTokens / 1000).toFixed(1)}k</div>
          <span className="text-[11px] text-slate-400 font-mono">Infrastructure cost tracking</span>
        </div>
      </div>

      {/* 24-Hour Activity Heatmap */}
      <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">24-Hour Orchestration Intensity</h3>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-slate-800" />
              <span>Idle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[#EB6658]/40" />
              <span>Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[#EB6658]" />
              <span>Peak</span>
            </div>
          </div>
        </div>

        <div 
          className="grid gap-1.5 pt-2" 
          style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
        >
          {stats.hourlyIntensity.map((count, hour) => {
            const intensity = count / stats.maxIntensity;
            let bgColor = 'bg-slate-800/40';
            if (count > 0) {
              if (intensity < 0.3) bgColor = 'bg-[#EB6658]/20';
              else if (intensity < 0.6) bgColor = 'bg-[#EB6658]/50';
              else if (intensity < 0.9) bgColor = 'bg-[#EB6658]/80';
              else bgColor = 'bg-[#EB6658]';
            }

            return (
              <div key={hour} className="space-y-2 group relative">
                <div 
                  className={`h-10 rounded-lg border border-slate-800/50 transition-all group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-[#EB6658]/20 ${bgColor}`}
                  title={`${count} runs at ${hour}:00`}
                />
                <div className="text-[9px] text-center text-slate-500 font-mono">
                  {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour-12}p` : `${hour}a`}
                </div>
                
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-xl font-bold">
                  {count} Orchestrations @ {hour}:00
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#EB6658]" />
            <h3 className="text-lg font-bold text-white tracking-tight">Active Agent Performance Audits</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">N={stats.agentList.length} specialized roles</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4">
                <th className="pb-2 pl-4">Agent Role</th>
                <th className="pb-2">Success Rate</th>
                <th className="pb-2">Avg Execution</th>
                <th className="pb-2">Token Usage</th>
                <th className="pb-2 pr-4 text-right">Activity</th>
              </tr>
            </thead>
            <tbody>
              {stats.agentList.map((agent) => (
                <tr key={agent.agentName} className="group">
                  <td className="bg-slate-950/40 border-y border-l border-slate-800/60 rounded-l-2xl py-4 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-[#EB6658] font-bold text-xs border border-slate-700">
                        {agent.agentName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 text-sm">{agent.agentName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Specialized Specialist</div>
                      </div>
                    </div>
                  </td>
                  <td className="bg-slate-950/40 border-y border-slate-800/60 py-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{agent.successRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-24 bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${agent.successRate}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="bg-slate-950/40 border-y border-slate-800/60 py-4">
                    <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>{(agent.avgDurationMs / 1000).toFixed(2)}s</span>
                    </div>
                  </td>
                  <td className="bg-slate-950/40 border-y border-slate-800/60 py-4">
                    <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{agent.totalTokens.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="bg-slate-950/40 border-y border-r border-slate-800/60 rounded-r-2xl py-4 pr-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-white">{agent.totalRuns} runs</span>
                      <span className="text-[10px] text-slate-500">Load Factor: High</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Intelligence Insights */}
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Automated Observability Insight</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Based on the last <strong className="text-slate-200">{stats.totalRuns}</strong> executions, your agents are performing with a 
              <strong className="text-emerald-400"> {stats.avgSuccessRate.toFixed(1)}%</strong> success rate. 
              {stats.avgLatency > 5000 ? " We recommend optimizing your prompt backstories to reduce the 5s+ latency spike observed in complex sequential processes." : " Latency is within the sub-5s performance threshold for real-time agentic orchestration."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
