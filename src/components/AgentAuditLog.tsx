import React, { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { AgentConfig, TaskConfig, ExecutionLog } from '../types';
import { LiveTaskExecutionItem } from './CrewExecutionProgressBar';

interface AgentAuditLogProps {
  agents: AgentConfig[];
  tasks: TaskConfig[];
  logs: ExecutionLog[];
  taskExecutions: Record<string, LiveTaskExecutionItem>;
}

export const AgentAuditLog: React.FC<AgentAuditLogProps> = ({ agents, tasks, logs, taskExecutions }) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (taskId: string) => {
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTasks(next);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, color: 'text-emerald-400', label: 'Completed' };
      case 'reasoning':
      case 'tool_exec':
      case 'controller_gate':
      case 'throttled':
        return { icon: Loader2, color: 'text-sky-400', label: 'Running' };
      case 'queued':
      default:
        return { icon: Clock, color: 'text-slate-400', label: 'Pending' };
    }
  };

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const agent = agents.find((a) => a.id === task.agentId);
        const execution = taskExecutions[task.id];
        const status = execution?.status || 'pending';
        const { icon: StatusIcon, color, label } = getStatusInfo(status);
        const taskLogs = logs.filter((l) => l.agentId === agent?.id);
        const isExpanded = expandedTasks.has(task.id);

        return (
          <div key={task.id} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
            <button
              onClick={() => toggleTask(task.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-900 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">{task.name}</div>
                  <div className="text-[10px] text-slate-400">Agent: {agent?.name || 'Unknown'}</div>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${['reasoning', 'tool_exec', 'controller_gate', 'throttled'].includes(status) ? 'animate-spin' : ''}`} />
                {label}
              </div>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 pt-0 text-[11px] text-slate-400 bg-slate-900/50 space-y-2">
                {taskLogs.length > 0 ? (
                  taskLogs.map((log, idx) => (
                    <div key={idx} className="border-l-2 border-slate-700 pl-2 py-1">
                      <div className="font-mono text-slate-500">[{log.stage}] {log.title}</div>
                      <div className="text-slate-300">{log.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="italic">No execution logs available for this task yet.</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
