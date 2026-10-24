/**
 * Real crew execution gateway.
 *
 * Bridges the Express API to the Python runner (`runner/main.py`), which does
 * the actual crewAI work. One child process per run gives us isolation, a hard
 * timeout, and a trivial kill switch.
 *
 * Endpoints:
 *   GET  /api/runner/health      is the Python runner installed and usable?
 *   GET  /api/crews              crew folders on disk
 *   POST /api/crews/:name/runs   start a run (optionally saving the definition)
 *   GET  /api/runs               recent runs
 *   GET  /api/runs/:id           status + result of one run
 *   GET  /api/runs/:id/events    Server-Sent Events stream (replay + live)
 *
 * Every field returned here comes from a real runner event. Nothing is
 * synthesised; a run that has not produced output has no output.
 */

import type { Express, Request, Response } from 'express';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const REPO_ROOT = process.cwd();
const RUNNER_DIR = path.join(REPO_ROOT, 'runner');
const RUNNER_MAIN = path.join(RUNNER_DIR, 'main.py');
const CREWS_DIR = path.join(REPO_ROOT, 'crews');

const PYTHON_EXE =
  process.platform === 'win32'
    ? path.join(RUNNER_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(RUNNER_DIR, '.venv', 'bin', 'python');

const DEFAULT_MODEL = process.env.CREW_DEFAULT_MODEL || 'ollama/llama3.2';
const RUN_TIMEOUT_MS = Number(process.env.CREW_RUN_TIMEOUT_MS || 15 * 60 * 1000);
const MAX_EVENTS_PER_RUN = 5000;
const MAX_BUFFERED_RUNS = 50;

export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface CrewEvent {
  type: string;
  ts?: number;
  [key: string]: unknown;
}

interface RunRecord {
  id: string;
  crew: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  events: CrewEvent[];
  output?: string;
  error?: string;
  tokens?: number | null;
  model?: string;
  listeners: Set<(event: CrewEvent) => void>;
  child?: ChildProcessWithoutNullStreams;
  timer?: NodeJS.Timeout;
}

const runs = new Map<string, RunRecord>();

/** Crew names become directory names, so they are strictly validated. */
function safeCrewName(raw: string): string {
  const name = String(raw || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error('Invalid crew name: use 1-64 letters, digits, dot, dash or underscore');
  }
  return name;
}

function crewPath(name: string): string {
  const dir = path.join(CREWS_DIR, name);
  // Defence in depth: the resolved path must stay inside CREWS_DIR.
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(CREWS_DIR) + path.sep)) {
    throw new Error('Invalid crew path');
  }
  return dir;
}

function definitionFile(dir: string): string | null {
  for (const candidate of ['crew.jsonc', 'crew.json']) {
    const file = path.join(dir, candidate);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function runnerHealth() {
  return {
    ready: fs.existsSync(PYTHON_EXE) && fs.existsSync(RUNNER_MAIN),
    python: PYTHON_EXE,
    runner: RUNNER_MAIN,
    default_model: DEFAULT_MODEL,
    hint: fs.existsSync(PYTHON_EXE)
      ? undefined
      : 'Runner not installed. Run: cd runner && uv venv --python 3.12 .venv && uv pip install crewai'
  };
}

function pruneRuns() {
  if (runs.size <= MAX_BUFFERED_RUNS) return;
  const finished = [...runs.values()]
    .filter((r) => r.status !== 'running')
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const run of finished.slice(0, runs.size - MAX_BUFFERED_RUNS)) {
    runs.delete(run.id);
  }
}

function finalize(run: RunRecord, status: RunStatus, extra: Partial<RunRecord> = {}) {
  if (run.status !== 'running') return;
  run.status = status;
  run.finishedAt = Date.now();
  Object.assign(run, extra);
  if (run.timer) clearTimeout(run.timer);
  const payload: CrewEvent = {
    type: status === 'succeeded' ? 'run_completed' : 'run_failed',
    run_id: run.id,
    ts: run.finishedAt / 1000,
    ...(status === 'succeeded'
      ? { output: run.output ?? '', duration_ms: run.finishedAt - run.startedAt }
      : { error: run.error ?? 'run failed', duration_ms: run.finishedAt - run.startedAt })
  };
  broadcast(run, payload);
}

function broadcast(run: RunRecord, event: CrewEvent) {
  for (const listener of run.listeners) {
    try {
      listener(event);
    } catch {
      run.listeners.delete(listener);
    }
  }
}

function record(run: RunRecord, event: CrewEvent) {
  if (run.events.length < MAX_EVENTS_PER_RUN) run.events.push(event);

  switch (event.type) {
    case 'task_completed':
      // Keep the last task output as a fallback if the crew never reports one.
      if (typeof event.output === 'string') run.output = event.output;
      break;
    case 'crew_stats':
      if (typeof event.total_tokens === 'number') run.tokens = event.total_tokens;
      break;
    case 'run_completed':
      finalize(run, 'succeeded', {
        output: typeof event.output === 'string' ? event.output : run.output
      });
      return;
    case 'run_failed':
      finalize(run, 'failed', { error: String(event.error ?? 'run failed') });
      return;
  }
  broadcast(run, event);
}

function serialize(run: RunRecord) {
  return {
    id: run.id,
    crew: run.crew,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt ?? null,
    duration_ms: run.finishedAt ? run.finishedAt - run.startedAt : Date.now() - run.startedAt,
    output: run.output ?? null,
    error: run.error ?? null,
    tokens: run.tokens ?? null,
    model: run.model ?? null,
    event_count: run.events.length
  };
}

export function registerCrewRunner(app: Express) {
  fs.mkdirSync(CREWS_DIR, { recursive: true });

  app.get('/api/runner/health', (_req: Request, res: Response) => {
    res.json(runnerHealth());
  });

  app.get('/api/crews', (_req: Request, res: Response) => {
    const crews = fs.existsSync(CREWS_DIR)
      ? fs
          .readdirSync(CREWS_DIR, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => {
            const file = definitionFile(path.join(CREWS_DIR, entry.name));
            return file
              ? {
                  name: entry.name,
                  definition_file: path.relative(REPO_ROOT, file),
                  updated_at: fs.statSync(file).mtimeMs
                }
              : null;
          })
          .filter(Boolean)
      : [];
    res.json({ crews });
  });

  app.post('/api/crews/:name/runs', (req: Request, res: Response) => {
    const health = runnerHealth();
    if (!health.ready) {
      return res.status(503).json({ error: 'Runner not installed', ...health });
    }

    let name: string;
    let dir: string;
    try {
      name = safeCrewName(String(req.params.name));
      dir = crewPath(name);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }

    const { definition, inputs = {}, model } = req.body || {};

    // Persist the studio's definition so the run executes exactly what was exported.
    if (definition && typeof definition === 'object') {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'crew.jsonc'),
        JSON.stringify(definition, null, 2),
        'utf-8'
      );
    }

    const file = definitionFile(dir);
    if (!file) {
      return res.status(404).json({
        error: `No crew definition found for "${name}" (expected crew.jsonc)`
      });
    }

    const id = randomUUID();
    const run: RunRecord = {
      id,
      crew: name,
      status: 'running',
      startedAt: Date.now(),
      events: [],
      listeners: new Set(),
      model: model || DEFAULT_MODEL
    };
    runs.set(id, run);
    pruneRuns();

    const args = [
      RUNNER_MAIN,
      '--crew',
      file,
      '--run-id',
      id,
      '--inputs',
      JSON.stringify(inputs ?? {})
    ];
    if (model) args.push('--model', String(model));

    const child = spawn(PYTHON_EXE, args, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
        CREWAI_TRACING_ENABLED: 'false',
        OTEL_SDK_DISABLED: 'true'
      }
    });
    run.child = child;

    let stdoutBuffer = '';
    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      let newline = stdoutBuffer.indexOf('\n');
      while (newline !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line) {
          try {
            record(run, JSON.parse(line) as CrewEvent);
          } catch {
            // Non-JSON on stdout is a runner bug; surface it rather than hide it.
            record(run, { type: 'log', level: 'warning', message: line.slice(0, 500) });
          }
        }
        newline = stdoutBuffer.indexOf('\n');
      }
    });

    let stderrTail = '';
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-4000);
    });

    run.timer = setTimeout(() => {
      finalize(run, 'failed', { error: `Run exceeded ${RUN_TIMEOUT_MS} ms timeout` });
      child.kill('SIGKILL');
    }, RUN_TIMEOUT_MS);

    child.on('close', (code: number | null) => {
      if (run.status === 'running') {
        if (code === 0) {
          finalize(run, 'succeeded', { output: run.output });
        } else {
          finalize(run, 'failed', {
            error: `Runner exited with code ${code}. ${stderrTail.slice(-600)}`.trim()
          });
        }
      }
      run.child = undefined;
    });

    child.on('error', (error: Error) => {
      finalize(run, 'failed', { error: `Failed to start runner: ${error.message}` });
    });

    res.status(202).json({ run_id: id, status: 'running', crew: name });
  });

  app.get('/api/runs', (_req: Request, res: Response) => {
    const list = [...runs.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 25)
      .map(serialize);
    res.json({ runs: list });
  });

  app.get('/api/runs/:id', (req: Request, res: Response) => {
    const run = runs.get(String(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ ...serialize(run), events: run.events });
  });

  app.get('/api/runs/:id/events', (req: Request, res: Response) => {
    const run = runs.get(String(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`retry: 3000\n\n`);

    const send = (event: CrewEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Replay everything already produced, so a late subscriber misses nothing.
    for (const event of run.events) send(event);

    if (run.status !== 'running') {
      res.write('event: end\ndata: {}\n\n');
      res.end();
      return;
    }

    const listener = (event: CrewEvent) => send(event);
    run.listeners.add(listener);

    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      run.listeners.delete(listener);
    });
  });

  app.post('/api/runs/:id/cancel', (req: Request, res: Response) => {
    const run = runs.get(String(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.status !== 'running') {
      return res.status(409).json({ error: `Run already ${run.status}` });
    }
    finalize(run, 'failed', { error: 'Cancelled by user' });
    run.child?.kill('SIGKILL');
    res.json({ run_id: run.id, status: 'failed' });
  });
}
