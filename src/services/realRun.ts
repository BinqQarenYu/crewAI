/**
 * Real crew execution client.
 *
 * Starts a run through the gateway (`server/crewRunner.ts`), subscribes to its
 * Server-Sent Events stream, and reports back what the runner actually emitted.
 *
 * Nothing here invents data. If the Python runner is not installed, `start`
 * resolves to `false` and the caller may fall back to the offline simulator —
 * explicitly, rather than silently.
 */

import type { AuditLogSeverity, CrewConfig, ExecutionLog } from '../types';

export interface RunnerHealth {
  ready: boolean;
  python?: string;
  runner?: string;
  default_model?: string;
  hint?: string;
}

export interface RunResult {
  ok: boolean;
  output: string;
  error?: string;
  durationMs: number;
  tokens?: number | null;
}

export interface RunCallbacks {
  /** A new log line for the execution console. */
  onLog: (log: ExecutionLog) => void;
  /** Task lifecycle, keyed by the task description crewAI reports. */
  onTask?: (task: string, status: 'running' | 'completed' | 'failed', agent?: string) => void;
  /** 0-100, derived from completed tasks over total tasks. */
  onProgress?: (percent: number) => void;
  /** Token total reported by crewAI. */
  onTokens?: (tokens: number) => void;
  /** Terminal event. Always called exactly once on a successful start. */
  onDone: (result: RunResult) => void;
}

export interface StartRunOptions {
  inputs?: Record<string, unknown>;
  /** Overrides the server default (e.g. "ollama/llama3.2"). */
  model?: string;
  /** Crew folder name; defaults to a slug of the crew's name. */
  slug?: string;
}

const API = '/api';

function slugify(name: string): string {
  const slug = String(name || 'crew')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+/g, '-')
    .slice(0, 64);
  return slug || 'crew';
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

let logSeq = 0;
function makeLog(
  partial: Partial<ExecutionLog> & Pick<ExecutionLog, 'type' | 'title' | 'content'>
): ExecutionLog {
  logSeq += 1;
  return {
    id: `real-${Date.now()}-${logSeq}`,
    timestamp: timestamp(),
    isoTimestamp: new Date().toISOString(),
    stage: 'crew',
    severity: 'info' as AuditLogSeverity,
    ...partial
  } as ExecutionLog;
}

/** Shape the studio's crew into the JSON the runner expects (same as export). */
export function crewToDefinition(crew: CrewConfig): Record<string, unknown> {
  return {
    name: crew.name,
    process: crew.process,
    manager_model: crew.managerModel,
    agents: (crew.agents || []).map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      category: agent.category || 'general',
      role: agent.role,
      goal: agent.goal,
      backstory: agent.backstory,
      duties: agent.duties || [],
      tools: agent.tools || [],
      settings: {
        verbose: agent.verbose,
        memory: agent.memory,
        max_iter: agent.maxIter,
        allow_delegation: agent.allowDelegation
      }
    })),
    tasks: (crew.tasks || []).map((task: any, index: number) => ({
      id: task.id,
      sequence_order: index + 1,
      name: task.name,
      phase: task.phase,
      description: task.description,
      expected_output: task.expectedOutput,
      agent: task.agentId,
      controller_agent: task.controllerAgentId,
      depends_on: task.dependsOnTaskIds || (index > 0 ? [crew.tasks[index - 1].id] : []),
      output_format: task.outputFormat
    }))
  };
}

export async function getRunnerHealth(): Promise<RunnerHealth> {
  try {
    const res = await fetch(`${API}/runner/health`);
    if (!res.ok) return { ready: false, hint: `health check returned ${res.status}` };
    return (await res.json()) as RunnerHealth;
  } catch (error: any) {
    return { ready: false, hint: error?.message || 'runner unreachable' };
  }
}

/**
 * Start a real run. Resolves `false` when the runner is unavailable so the
 * caller can choose to simulate instead.
 */
export async function startRealRun(
  crew: CrewConfig,
  callbacks: RunCallbacks,
  options: StartRunOptions = {}
): Promise<boolean> {
  const health = await getRunnerHealth();
  if (!health.ready) {
    callbacks.onLog(
      makeLog({
        type: 'system',
        severity: 'warn',
        title: 'Python runner not installed',
        content:
          health.hint ||
          'Run `npm run runner:install` to enable real execution. Falling back to the offline simulator.'
      })
    );
    return false;
  }

  const slug = options.slug || slugify(crew.name);
  const definition = crewToDefinition(crew);
  const totalTasks = definition.tasks ? (definition.tasks as unknown[]).length : 0;
  const startedAt = Date.now();
  let completedTasks = 0;
  let settled = false;
  let tokens: number | null = null;

  const finish = (result: RunResult) => {
    if (settled) return;
    settled = true;
    callbacks.onDone(result);
  };

  let runId: string;
  try {
    const res = await fetch(`${API}/crews/${encodeURIComponent(slug)}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition,
        inputs: options.inputs || {},
        model: options.model
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      finish({
        ok: false,
        output: '',
        error: (payload as any)?.error || `Failed to start run (HTTP ${res.status})`,
        durationMs: Date.now() - startedAt
      });
      return true;
    }
    runId = (payload as any).run_id;
  } catch (error: any) {
    finish({
      ok: false,
      output: '',
      error: `Could not reach the gateway: ${error?.message || error}`,
      durationMs: Date.now() - startedAt
    });
    return true;
  }

  callbacks.onLog(
    makeLog({
      type: 'system',
      severity: 'info',
      title: 'Run started',
      content: `Executing "${crew.name}" with the real crewAI runner (${health.default_model}).`,
      meta: { model: health.default_model }
    })
  );

  const source = new EventSource(`${API}/runs/${runId}/events`);

  const close = () => {
    try {
      source.close();
    } catch {
      /* already closed */
    }
  };

  source.onmessage = (message: MessageEvent<string>) => {
    let event: any;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }
    if (!event || typeof event.type !== 'string') return;

    switch (event.type) {
      case 'task_started': {
        const task = String(event.task || 'task');
        callbacks.onTask?.(task, 'running', event.agent ? String(event.agent) : undefined);
        callbacks.onLog(
          makeLog({
            type: 'thought',
            severity: 'info',
            title: `Task started: ${task.slice(0, 80)}`,
            content: event.agent ? `Assigned to ${event.agent}.` : 'Task dispatched.',
            agentName: event.agent ? String(event.agent) : undefined,
            meta: { model: health.default_model }
          })
        );
        break;
      }
      case 'agent_started':
        callbacks.onLog(
          makeLog({
            type: 'thought',
            severity: 'info',
            title: `${event.agent || 'Agent'} working`,
            content: 'Agent is reasoning over the task.',
            agentName: event.agent ? String(event.agent) : undefined
          })
        );
        break;
      case 'agent_finished':
        break;
      case 'task_completed': {
        completedTasks += 1;
        const task = String(event.task || 'task');
        const output = String(event.output || '');
        callbacks.onTask?.(task, 'completed', event.agent ? String(event.agent) : undefined);
        callbacks.onProgress?.(
          totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0
        );
        callbacks.onLog(
          makeLog({
            type: 'task_complete',
            severity: 'success',
            title: `Task complete: ${task.slice(0, 80)}`,
            content: output || 'Task finished with no text output.',
            agentName: event.agent ? String(event.agent) : undefined,
            meta: { durationMs: Date.now() - startedAt }
          })
        );
        break;
      }
      case 'task_failed':
        callbacks.onTask?.(String(event.task || 'task'), 'failed');
        callbacks.onLog(
          makeLog({
            type: 'system',
            severity: 'error',
            title: `Task failed: ${String(event.task || '').slice(0, 80)}`,
            content: String(event.error || 'unknown error')
          })
        );
        break;
      case 'agent_error':
        callbacks.onLog(
          makeLog({
            type: 'system',
            severity: 'error',
            title: `Agent error: ${event.agent || 'unknown'}`,
            content: String(event.error || 'unknown error')
          })
        );
        break;
      case 'crew_stats':
        if (typeof event.total_tokens === 'number') {
          tokens = event.total_tokens;
          callbacks.onTokens?.(event.total_tokens);
        }
        break;
      case 'log':
        callbacks.onLog(
          makeLog({
            type: 'system',
            severity: event.level === 'warning' ? 'warn' : 'info',
            title: 'Runner',
            content: String(event.message || '')
          })
        );
        break;
      case 'run_completed': {
        callbacks.onProgress?.(100);
        callbacks.onLog(
          makeLog({
            type: 'task_complete',
            severity: 'success',
            title: 'Run completed',
            content: String(event.output || 'Run finished.'),
            meta: {
              durationMs: Number(event.duration_ms) || Date.now() - startedAt,
              tokens: tokens ?? undefined,
              model: health.default_model
            }
          })
        );
        close();
        finish({
          ok: true,
          output: String(event.output || ''),
          durationMs: Number(event.duration_ms) || Date.now() - startedAt,
          tokens
        });
        break;
      }
      case 'run_failed':
        callbacks.onLog(
          makeLog({
            type: 'system',
            severity: 'error',
            title: 'Run failed',
            content: String(event.error || 'unknown error')
          })
        );
        close();
        finish({
          ok: false,
          output: '',
          error: String(event.error || 'unknown error'),
          durationMs: Number(event.duration_ms) || Date.now() - startedAt,
          tokens
        });
        break;
      default:
        break;
    }
  };

  source.onerror = () => {
    // EventSource retries automatically, but if the run already finished the
    // server closes the stream, which surfaces here as an error.
    if (!settled) {
      close();
      finish({
        ok: false,
        output: '',
        error: 'Stream disconnected before the run reported a result.',
        durationMs: Date.now() - startedAt,
        tokens
      });
    } else {
      close();
    }
  };

  return true;
}
