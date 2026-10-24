/**
 * Real crew execution gateway + autonomy layer.
 *
 * Bridges the Express API to the Python runner (`runner/main.py`), which does the
 * actual crewAI work. One child process per run gives isolation, a hard timeout
 * and a trivial kill switch.
 *
 * Beyond running a crew on demand this module provides what "autonomous" needs:
 *   - persistence  : run history and schedules survive a server restart
 *   - scheduling   : a crew can be on a timer instead of waiting for a click
 *   - approvals    : a schedule can require a human green light per run
 *   - retries      : failed runs back off and retry, then trip a circuit breaker
 *   - budgets      : concurrency cap, run timeout, token ceiling, tool-call cap
 *   - memory       : each crew gets a run journal the runner reads back in
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
const DATA_DIR = path.join(REPO_ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'crew-studio.json');

const PYTHON_EXE =
  process.platform === 'win32'
    ? path.join(RUNNER_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(RUNNER_DIR, '.venv', 'bin', 'python');

const DEFAULT_MODEL = process.env.CREW_DEFAULT_MODEL || 'ollama/llama3.2';
const RUN_TIMEOUT_MS = Number(process.env.CREW_RUN_TIMEOUT_MS || 15 * 60 * 1000);
const MAX_TOKENS_PER_RUN = Number(process.env.CREW_MAX_TOKENS_PER_RUN || 0);
const MAX_CONCURRENT_RUNS = Number(process.env.CREW_MAX_CONCURRENT_RUNS || 2);
const MAX_CONSECUTIVE_FAILURES = Number(process.env.CREW_MAX_CONSECUTIVE_FAILURES || 3);
const TICK_MS = Number(process.env.CREW_SCHEDULER_TICK_MS || 5000);
const MAX_EVENTS_PER_RUN = 5000;

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'awaiting_approval' | 'cancelled';

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
  scheduleId?: string;
  attempt?: number;
  definitionPath?: string;
  pendingInputs?: Record<string, unknown>;
  pendingModel?: string;
  listeners: Set<(event: CrewEvent) => void>;
  child?: ChildProcessWithoutNullStreams;
  timer?: NodeJS.Timeout;
}

interface ScheduleRecord {
  id: string;
  crew: string;
  every_seconds: number;
  inputs: Record<string, unknown>;
  model?: string;
  max_tokens?: number;
  max_retries: number;
  require_approval: boolean;
  enabled: boolean;
  next_run_at: number;
  last_run_at?: number;
  last_run_id?: string;
  consecutive_failures: number;
  created_at: number;
  paused_reason?: string;
}

interface PersistedState {
  runs: ReturnType<typeof serialize>[];
  schedules: ScheduleRecord[];
}

const runs = new Map<string, RunRecord>();
const schedules = new Map<string, ScheduleRecord>();

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function ensureDirs() {
  fs.mkdirSync(CREWS_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as Partial<PersistedState>;
    for (const schedule of raw.schedules ?? []) {
      if (schedule && typeof schedule.id === 'string') schedules.set(schedule.id, schedule);
    }
    for (const run of raw.runs ?? []) {
      if (!run || typeof run.id !== 'string') continue;
      runs.set(run.id, {
        id: run.id,
        crew: run.crew,
        // A run that was 'running' when the process died is no longer running.
        status: run.status === 'running' ? 'failed' : run.status,
        startedAt: run.started_at,
        finishedAt: run.finished_at ?? undefined,
        events: [],
        output: run.output ?? undefined,
        error:
          run.status === 'running'
            ? 'Interrupted: the server restarted while this run was executing.'
            : (run.error ?? undefined),
        tokens: run.tokens ?? null,
        model: run.model ?? undefined,
        scheduleId: run.schedule_id ?? undefined,
        attempt: run.attempt ?? undefined,
        listeners: new Set()
      });
    }
  } catch (error) {
    console.warn('[autonomy] could not load state:', (error as Error).message);
  }
}

function saveState() {
  try {
    ensureDirs();
    const state: PersistedState = {
      runs: [...runs.values()]
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 200)
        .map(serialize),
      schedules: [...schedules.values()]
    };
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, STORE_FILE); // atomic-ish: never leave a half-written file
  } catch (error) {
    console.warn('[autonomy] could not persist state:', (error as Error).message);
  }
}

/** Append a run summary to the crew's memory journal, read back by the runner. */
function appendMemory(run: RunRecord) {
  try {
    const dir = path.join(CREWS_DIR, run.crew);
    if (!fs.existsSync(dir)) return;
    const file = path.join(dir, 'memory.json');
    let entries: unknown[] = [];
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        entries = [];
      }
    }
    entries.push({
      run_id: run.id,
      status: run.status,
      started_at: new Date(run.startedAt).toISOString(),
      finished_at: new Date(run.finishedAt ?? Date.now()).toISOString(),
      tokens: run.tokens ?? null,
      output: String(run.output ?? run.error ?? '').slice(0, 2000)
    });
    fs.writeFileSync(file, JSON.stringify(entries.slice(-50), null, 2), 'utf-8');
  } catch (error) {
    console.warn('[autonomy] could not append crew memory:', (error as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeCrewName(raw: string): string {
  const name = String(raw || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error('Invalid crew name: use 1-64 letters, digits, dot, dash or underscore');
  }
  return name;
}

function crewPath(name: string): string {
  const resolved = path.resolve(path.join(CREWS_DIR, name));
  if (!resolved.startsWith(path.resolve(CREWS_DIR) + path.sep)) {
    throw new Error('Invalid crew path');
  }
  return resolved;
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
    max_concurrent_runs: MAX_CONCURRENT_RUNS,
    max_tokens_per_run: MAX_TOKENS_PER_RUN || null,
    run_timeout_ms: RUN_TIMEOUT_MS,
    hint: fs.existsSync(PYTHON_EXE)
      ? undefined
      : 'Runner not installed. Run: npm run runner:install'
  };
}

function runningCount() {
  return [...runs.values()].filter((run) => run.status === 'running').length;
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
    schedule_id: run.scheduleId ?? null,
    attempt: run.attempt ?? null,
    event_count: run.events.length
  };
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

function finalize(run: RunRecord, status: RunStatus, extra: Partial<RunRecord> = {}) {
  if (run.status !== 'running' && run.status !== 'awaiting_approval') return;
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

  appendMemory(run);
  saveState();
  updateScheduleAfterRun(run);
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

interface StartOptions {
  definition?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  requireApproval?: boolean;
  scheduleId?: string;
  attempt?: number;
}

export function startRun(crewName: string, options: StartOptions = {}) {
  const health = runnerHealth();
  if (!health.ready) {
    throw new Error('Runner not installed');
  }
  const name = safeCrewName(crewName);
  const dir = crewPath(name);

  if (options.definition && typeof options.definition === 'object') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'crew.jsonc'), JSON.stringify(options.definition, null, 2), 'utf-8');
  }

  const file = definitionFile(dir);
  if (!file) {
    throw new Error(`No crew definition found for "${name}" (expected crew.jsonc)`);
  }

  const id = randomUUID();
  const requireApproval = Boolean(options.requireApproval);
  const run: RunRecord = {
    id,
    crew: name,
    status: requireApproval ? 'awaiting_approval' : 'running',
    startedAt: Date.now(),
    events: [],
    listeners: new Set(),
    model: options.model || DEFAULT_MODEL,
    scheduleId: options.scheduleId,
    attempt: options.attempt,
    definitionPath: file,
    pendingInputs: options.inputs ?? {},
    pendingModel: options.model
  };
  runs.set(id, run);

  if (requireApproval) {
    saveState();
    return { id, status: run.status };
  }

  spawnRun(run, file, options.inputs, options.model, options.maxTokens);
  saveState();
  return { id, status: run.status };
}

function spawnRun(
  run: RunRecord,
  file: string,
  inputs: Record<string, unknown> | undefined,
  model: string | undefined,
  maxTokens: number | undefined
) {
  const memoryFile = path.join(CREWS_DIR, run.crew, 'memory.json');
  const args = [
    RUNNER_MAIN,
    '--crew',
    file,
    '--run-id',
    run.id,
    '--inputs',
    JSON.stringify(inputs ?? {})
  ];
  if (model) args.push('--model', String(model));
  if (fs.existsSync(memoryFile)) args.push('--memory-file', memoryFile);
  const budget = maxTokens ?? MAX_TOKENS_PER_RUN;
  if (budget) args.push('--max-tokens', String(budget));

  run.status = 'running';
  run.startedAt = Date.now();

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
}

export function approveRun(id: string) {
  const run = runs.get(id);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'awaiting_approval') throw new Error(`Run is ${run.status}, not awaiting approval`);
  if (runningCount() >= MAX_CONCURRENT_RUNS) {
    throw new Error(`Concurrency limit reached (${MAX_CONCURRENT_RUNS} running)`);
  }
  const file = run.definitionPath!;
  spawnRun(run, file, run.pendingInputs, run.pendingModel, undefined);
  saveState();
  return { id: run.id, status: run.status };
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

function updateScheduleAfterRun(run: RunRecord) {
  if (!run.scheduleId) return;
  const schedule = schedules.get(run.scheduleId);
  if (!schedule) return;

  schedule.last_run_id = run.id;
  schedule.last_run_at = Date.now();

  if (run.status === 'succeeded') {
    schedule.consecutive_failures = 0;
    schedule.next_run_at = Date.now() + schedule.every_seconds * 1000;
  } else if (run.status === 'failed') {
    schedule.consecutive_failures += 1;
    if (schedule.consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
      schedule.enabled = false;
      schedule.paused_reason =
        `Circuit breaker: ${schedule.consecutive_failures} consecutive failures. ` +
        `Last error: ${(run.error ?? 'unknown').slice(0, 200)}`;
    } else if (schedule.consecutive_failures <= schedule.max_retries) {
      // Backoff before retrying: 30s, 60s, 120s …
      const backoff = Math.min(30_000 * 2 ** (schedule.consecutive_failures - 1), 300_000);
      schedule.next_run_at = Date.now() + backoff;
    } else {
      schedule.next_run_at = Date.now() + schedule.every_seconds * 1000;
    }
  }
  saveState();
}

function tick() {
  const now = Date.now();
  for (const schedule of schedules.values()) {
    if (!schedule.enabled || schedule.next_run_at > now) continue;
    if (runningCount() >= MAX_CONCURRENT_RUNS) continue;

    // If the previous run from this schedule is still waiting for a human,
    // don't pile up more approvals — skip until it is resolved.
    const pending = [...runs.values()].find(
      (run) => run.scheduleId === schedule.id && run.status === 'awaiting_approval'
    );
    if (pending) {
      schedule.next_run_at = now + schedule.every_seconds * 1000;
      continue;
    }

    try {
      const result = startRun(schedule.crew, {
        inputs: schedule.inputs,
        model: schedule.model,
        maxTokens: schedule.max_tokens,
        requireApproval: schedule.require_approval,
        scheduleId: schedule.id,
        attempt: schedule.consecutive_failures + 1
      });
      schedule.next_run_at = now + schedule.every_seconds * 1000;
      schedule.last_run_id = result.id;
      saveState();
    } catch (error) {
      schedule.enabled = false;
      schedule.paused_reason = `Could not start run: ${(error as Error).message}`;
      saveState();
    }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerCrewRunner(app: Express) {
  ensureDirs();
  loadState();
  setInterval(tick, TICK_MS).unref();

  app.get('/api/runner/health', (_req: Request, res: Response) => {
    res.json({ ...runnerHealth(), running: runningCount(), schedules: schedules.size });
  });

  app.get('/api/crews', (_req: Request, res: Response) => {
    const crews = fs
      .readdirSync(CREWS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const file = definitionFile(path.join(CREWS_DIR, entry.name));
        return file
          ? {
              name: entry.name,
              definition_file: path.relative(REPO_ROOT, file),
              updated_at: fs.statSync(file).mtimeMs,
              schedules: [...schedules.values()].filter((s) => s.crew === entry.name).length
            }
          : null;
      })
      .filter(Boolean);
    res.json({ crews });
  });

  app.post('/api/crews/:name/runs', (req: Request, res: Response) => {
    if (!runnerHealth().ready) {
      return res.status(503).json({ error: 'Runner not installed', ...runnerHealth() });
    }
    if (runningCount() >= MAX_CONCURRENT_RUNS) {
      return res.status(429).json({
        error: `Concurrency limit reached (${MAX_CONCURRENT_RUNS} runs in flight)`
      });
    }
    const { definition, inputs = {}, model, max_tokens, require_approval } = req.body || {};
    try {
      const result = startRun(String(req.params.name), {
        definition,
        inputs,
        model,
        maxTokens: max_tokens,
        requireApproval: require_approval
      });
      return res.status(202).json({ run_id: result.id, status: result.status, crew: String(req.params.name) });
    } catch (error: any) {
      const message = String(error?.message || error);
      const code = message.includes('Invalid crew name') || message.includes('Invalid crew path')
        ? 400
        : message.includes('No crew definition')
          ? 404
          : 500;
      return res.status(code).json({ error: message });
    }
  });

  app.get('/api/runs', (_req: Request, res: Response) => {
    const list = [...runs.values()]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50)
      .map(serialize);
    res.json({ runs: list });
  });

  app.get('/api/runs/:id', (req: Request, res: Response) => {
    const run = runs.get(String(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ ...serialize(run), events: run.events });
  });

  app.post('/api/runs/:id/approve', (req: Request, res: Response) => {
    try {
      res.json(approveRun(String(req.params.id)));
    } catch (error: any) {
      const message = String(error?.message || error);
      res.status(message.includes('not found') ? 404 : 409).json({ error: message });
    }
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

    for (const event of run.events) send(event);

    if (run.status !== 'running' && run.status !== 'awaiting_approval') {
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
    if (run.status !== 'running') return res.status(409).json({ error: `Run already ${run.status}` });
    finalize(run, 'cancelled', { error: 'Cancelled by user' });
    run.child?.kill('SIGKILL');
    res.json({ run_id: run.id, status: run.status });
  });

  // --- Schedules -----------------------------------------------------------

  app.get('/api/schedules', (_req: Request, res: Response) => {
    res.json({ schedules: [...schedules.values()].sort((a, b) => a.created_at - b.created_at) });
  });

  app.post('/api/crews/:name/schedules', (req: Request, res: Response) => {
    const { every_seconds, inputs = {}, model, max_tokens, max_retries = 2, require_approval = false } = req.body || {};
    const seconds = Number(every_seconds);
    if (!Number.isFinite(seconds) || seconds < 30) {
      return res.status(400).json({ error: 'every_seconds must be a number >= 30' });
    }
    let name: string;
    try {
      name = safeCrewName(String(req.params.name));
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    if (!definitionFile(crewPath(name))) {
      return res.status(404).json({ error: `No crew definition found for "${name}"` });
    }
    const schedule: ScheduleRecord = {
      id: randomUUID(),
      crew: name,
      every_seconds: seconds,
      inputs,
      model,
      max_tokens,
      max_retries: Math.max(0, Number(max_retries) || 0),
      require_approval: Boolean(require_approval),
      enabled: true,
      next_run_at: Date.now() + seconds * 1000,
      consecutive_failures: 0,
      created_at: Date.now()
    };
    schedules.set(schedule.id, schedule);
    saveState();
    res.status(201).json({ schedule });
  });

  app.patch('/api/schedules/:id', (req: Request, res: Response) => {
    const schedule = schedules.get(String(req.params.id));
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    const { enabled } = req.body || {};
    if (typeof enabled === 'boolean') {
      schedule.enabled = enabled;
      if (enabled) {
        schedule.consecutive_failures = 0;
        schedule.paused_reason = undefined;
        schedule.next_run_at = Date.now() + schedule.every_seconds * 1000;
      }
    }
    saveState();
    res.json({ schedule });
  });

  app.delete('/api/schedules/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!schedules.delete(id)) return res.status(404).json({ error: 'Schedule not found' });
    saveState();
    res.json({ deleted: id });
  });
}
