import { useState, useEffect } from 'react';

export type TaskPriority = 'high' | 'normal' | 'background';

export interface ThrottlerMetrics {
  activeTasks: number;
  queuedTasks: number;
  maxConcurrency: number;
  heavyOpsCount: number;
  activeHeavyOps: string[];
  activeTaskLabels: string[];
  queuedTaskLabels: string[];
  coalescedRequests: number;
  cachedPollResponses: number;
  throttledBackgroundTasks: number;
  droppedHiddenPolls: number;
  lastFrameLagMs: number;
  isCongested: boolean;
  ecoMode: boolean;
  pollingMultiplier: number;
}

interface QueuedTask<T> {
  id: string;
  label: string;
  priority: TaskPriority;
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  enqueuedAt: number;
}

interface CachedPollEntry {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  timestamp: number;
}

// High-frequency read-only status/polling endpoints that benefit from automatic TTL caching & request coalescing
const POLLING_ENDPOINTS_TTL_MS: Record<string, number> = {
  '/api/crew/execution-status': 2000,
  '/api/agents/heartbeat': 4000,
  '/api/gemini/quota-status': 5000,
  '/api/jules/status': 6000,
  '/api/jules/tasks': 4000,
  '/api/ollama/status': 5000,
  '/api/ollama/pool': 4000,
  '/api/github/status': 6000,
  '/api/antigravity/session': 2500,
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  normal: 2,
  background: 1,
};

class GlobalTaskThrottler {
  private queue: QueuedTask<any>[] = [];
  private activeCount = 0;
  private activeTasksMap = new Map<string, string>();
  private maxConcurrency = 3;
  private ecoMode = true;
  private heavyOperations = new Map<string, { label: string; startedAt: number }>();
  private inFlightGetRequests = new Map<string, Promise<CachedPollEntry>>();
  private pollCache = new Map<string, CachedPollEntry>();
  private listeners = new Set<(metrics: ThrottlerMetrics) => void>();

  // Telemetry counters
  private coalescedRequests = 0;
  private cachedPollResponses = 0;
  private throttledBackgroundTasks = 0;
  private droppedHiddenPolls = 0;
  private lastFrameLagMs = 0;
  private isCongested = false;
  private fetchInstalled = false;
  private originalFetch: typeof window.fetch | null = null;
  private notifyTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedEco = localStorage.getItem('crewai_eco_cpu_mode');
        this.ecoMode = savedEco === null ? true : savedEco === 'true';
        const savedConc = localStorage.getItem('crewai_throttler_concurrency');
        if (savedConc) {
          const parsed = parseInt(savedConc, 10);
          if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 8) {
            this.maxConcurrency = parsed;
          }
        } else {
          this.maxConcurrency = this.ecoMode ? 2 : 4;
        }
      } catch {
        // Ignore storage errors
      }

      window.addEventListener('crewai:eco-mode-change', ((e: CustomEvent) => {
        const enabled = Boolean(e.detail?.enabled);
        this.setEcoMode(enabled);
      }) as EventListener);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.processQueue();
        }
        this.scheduleNotify();
      });
    }
  }

  public setEcoMode(enabled: boolean) {
    this.ecoMode = enabled;
    if (enabled && this.maxConcurrency > 2) {
      this.maxConcurrency = 2;
    } else if (!enabled && this.maxConcurrency < 3) {
      this.maxConcurrency = 4;
    }
    this.scheduleNotify();
    this.processQueue();
  }

  public setMaxConcurrency(limit: number) {
    const clamped = Math.max(1, Math.min(8, limit));
    this.maxConcurrency = clamped;
    try {
      localStorage.setItem('crewai_throttler_concurrency', String(clamped));
    } catch {
      // Ignore
    }
    this.scheduleNotify();
    this.processQueue();
  }

  public getPollingMultiplier(): number {
    let mult = 1;
    if (this.ecoMode) mult *= 2;
    if (this.heavyOperations.size > 0) mult *= 2.5;
    if (this.isCongested) mult *= 2;
    if (typeof document !== 'undefined' && document.hidden) mult *= 4;
    return mult;
  }

  /**
   * Registers a heavy foreground operation (e.g., Crew execution, folder import, repo scan)
   * so background polling and low-priority tasks automatically back off.
   */
  public beginHeavyOperation(id: string, label: string): () => void {
    this.heavyOperations.set(id, { label, startedAt: Date.now() });
    this.measureFrameLag();
    this.scheduleNotify();

    // Auto-expire stale lock after 45s as a safety guard so locks never leak
    const timeoutId = window.setTimeout(() => {
      if (this.heavyOperations.has(id)) {
        this.heavyOperations.delete(id);
        this.scheduleNotify();
        this.processQueue();
      }
    }, 45000);

    return () => {
      window.clearTimeout(timeoutId);
      this.endHeavyOperation(id);
    };
  }

  public endHeavyOperation(id: string) {
    if (this.heavyOperations.delete(id)) {
      this.scheduleNotify();
      this.processQueue();
    }
  }

  /**
   * Lightweight non-continuous frame lag probe triggered only during task scheduling.
   */
  private measureFrameLag() {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const start = performance.now();
    window.setTimeout(() => {
      const elapsed = performance.now() - start;
      const lag = Math.max(0, Math.round(elapsed - 16));
      this.lastFrameLagMs = lag;
      this.isCongested = lag > 65;
      if (this.isCongested) {
        this.scheduleNotify();
      }
    }, 16);
  }

  /**
   * Yields execution back to the browser main thread so UI remains responsive
   * during large loops or multi-step synchronous tasks.
   */
  public yieldToMain(timeoutMs = 50): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }
      if ('requestIdleCallback' in window && (this.ecoMode || this.heavyOperations.size > 0)) {
        (window as any).requestIdleCallback(() => resolve(), { timeout: timeoutMs });
      } else {
        window.setTimeout(resolve, 0);
      }
    });
  }

  /**
   * Schedules an async task through the global priority & concurrency queue.
   */
  public scheduleTask<T>(
    label: string,
    execute: () => Promise<T>,
    priority: TaskPriority = 'normal'
  ): Promise<T> {
    // Cap queue depth for background tasks to avoid unbounded memory growth
    if (priority === 'background' && this.queue.length >= 20) {
      const oldestBgIdx = this.queue.findIndex((q) => q.priority === 'background');
      if (oldestBgIdx !== -1) {
        const [dropped] = this.queue.splice(oldestBgIdx, 1);
        dropped.reject(new Error('Dropped stale background task due to queue saturation'));
      }
    }

    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        priority,
        execute,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      this.queue.push(task);
      this.queue.sort((a, b) => {
        const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return a.enqueuedAt - b.enqueuedAt;
      });

      if (priority === 'background' && (this.heavyOperations.size > 0 || this.activeCount >= this.maxConcurrency)) {
        this.throttledBackgroundTasks++;
      }

      this.scheduleNotify();
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    // Effective concurrency drops to 1 for background tasks when a heavy foreground op is active
    const effectiveMax =
      this.heavyOperations.size > 0 || this.isCongested
        ? Math.max(1, Math.floor(this.maxConcurrency / 2))
        : this.maxConcurrency;

    while (this.activeCount < effectiveMax && this.queue.length > 0) {
      const nextTask = this.queue[0];

      // If a heavy operation is running and the next task is low-priority background work,
      // keep at least 1 slot free for high/normal tasks unless nothing else is running.
      if (
        nextTask.priority === 'background' &&
        this.heavyOperations.size > 0 &&
        this.activeCount >= 1
      ) {
        break;
      }

      this.queue.shift();
      this.activeCount++;
      this.activeTasksMap.set(nextTask.id, nextTask.label);
      this.measureFrameLag();
      this.scheduleNotify();

      const delayMs =
        nextTask.priority === 'background' && (this.heavyOperations.size > 0 || this.isCongested)
          ? 180
          : 0;

      const run = () => {
        nextTask
          .execute()
          .then((result) => nextTask.resolve(result))
          .catch((err) => nextTask.reject(err))
          .finally(() => {
            this.activeCount = Math.max(0, this.activeCount - 1);
            this.activeTasksMap.delete(nextTask.id);
            this.scheduleNotify();
            this.processQueue();
          });
      };

      if (delayMs > 0 && typeof window !== 'undefined') {
        window.setTimeout(run, delayMs);
      } else {
        run();
      }
    }
  }

  private getMatchingPollTtl(url: string): number | null {
    for (const [prefix, ttl] of Object.entries(POLLING_ENDPOINTS_TTL_MS)) {
      if (url.includes(prefix)) {
        return Math.round(ttl * this.getPollingMultiplier());
      }
    }
    return null;
  }

  private buildResponseFromEntry(entry: CachedPollEntry): Response {
    return new Response(entry.bodyText, {
      status: entry.status,
      statusText: entry.statusText,
      headers: entry.headers,
    });
  }

  /**
   * Executes a fetch request with automatic GET /api/* deduplication (coalescing),
   * TTL caching for high-frequency polling endpoints, and concurrency throttling.
   */
  public async throttledFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const nativeFetch =
      this.originalFetch ||
      (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : fetch);

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Only throttle/coalesce read-only GET requests to local /api/* endpoints
    if (method !== 'GET' || !url.includes('/api/')) {
      return nativeFetch(input, init);
    }

    const pollTtl = this.getMatchingPollTtl(url);
    const isPollingEndpoint = pollTtl !== null;

    // 1. Check TTL cache for polling endpoints
    if (isPollingEndpoint && pollTtl) {
      const cached = this.pollCache.get(url);
      const now = Date.now();
      // If tab is hidden, extend cache validity up to 60s to prevent background tab CPU drain
      const effectiveTtl = typeof document !== 'undefined' && document.hidden ? Math.max(pollTtl, 45000) : pollTtl;

      if (cached && now - cached.timestamp < effectiveTtl) {
        if (typeof document !== 'undefined' && document.hidden) {
          this.droppedHiddenPolls++;
        } else {
          this.cachedPollResponses++;
        }
        this.scheduleNotify();
        return this.buildResponseFromEntry(cached);
      }
    }

    // 2. Coalesce identical in-flight GET /api/* requests
    const existingInFlight = this.inFlightGetRequests.get(url);
    if (existingInFlight) {
      this.coalescedRequests++;
      this.scheduleNotify();
      const entry = await existingInFlight;
      return this.buildResponseFromEntry(entry);
    }

    // 3. Execute request through the task scheduler (background priority for polling endpoints)
    const priority: TaskPriority = isPollingEndpoint ? 'background' : 'normal';

    const requestPromise = this.scheduleTask<CachedPollEntry>(
      `GET ${url.split('?')[0]}`,
      async () => {
        const response = await nativeFetch(input, init);
        const bodyText = await response.text();
        const headers: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headers[key] = val;
        });

        const entry: CachedPollEntry = {
          status: response.status,
          statusText: response.statusText,
          headers,
          bodyText,
          timestamp: Date.now(),
        };

        if (isPollingEndpoint && response.ok) {
          this.pollCache.set(url, entry);
          // Keep cache bounded
          if (this.pollCache.size > 40) {
            const oldestKey = this.pollCache.keys().next().value;
            if (oldestKey) this.pollCache.delete(oldestKey);
          }
        }

        return entry;
      },
      priority
    );

    this.inFlightGetRequests.set(url, requestPromise);

    try {
      const entry = await requestPromise;
      return this.buildResponseFromEntry(entry);
    } finally {
      this.inFlightGetRequests.delete(url);
    }
  }

  /**
   * Installs a global window.fetch interceptor that automatically:
   * 1. Deduplicates (coalesces) concurrent identical GET /api/* calls
   * 2. Serves fresh TTL-cached responses for high-frequency polling endpoints
   * 3. Routes background polling calls through the concurrency limiter during heavy operations
   * Safely handles environments where window.fetch is a read-only getter property.
   */
  public installGlobalFetchThrottler() {
    if (this.fetchInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    this.fetchInstalled = true;
    this.originalFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
      this.throttledFetch(input, init);

    try {
      const ownDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (!ownDesc) {
        // Property might live on Window.prototype as a getter-only property
        const proto = Object.getPrototypeOf(window);
        const protoDesc = proto ? Object.getOwnPropertyDescriptor(proto, 'fetch') : undefined;
        if (protoDesc && protoDesc.get && !protoDesc.set) {
          Object.defineProperty(window, 'fetch', {
            value: wrappedFetch,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          return;
        }
        window.fetch = wrappedFetch;
      } else if (ownDesc.writable || ownDesc.set) {
        window.fetch = wrappedFetch;
      } else if (ownDesc.configurable) {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          writable: true,
          configurable: true,
          enumerable: ownDesc.enumerable ?? true,
        });
      }
    } catch {
      // Host environment prevents overriding window.fetch; fallback gracefully to throttledFetch / scheduleTask
    }
  }

  public clearPollCache() {
    this.pollCache.clear();
    this.scheduleNotify();
  }

  public getMetrics(): ThrottlerMetrics {
    return {
      activeTasks: this.activeCount,
      queuedTasks: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      heavyOpsCount: this.heavyOperations.size,
      activeHeavyOps: Array.from(this.heavyOperations.values()).map((op) => op.label),
      activeTaskLabels: Array.from(this.activeTasksMap.values()).slice(0, 6),
      queuedTaskLabels: this.queue.slice(0, 6).map((q) => q.label),
      coalescedRequests: this.coalescedRequests,
      cachedPollResponses: this.cachedPollResponses,
      throttledBackgroundTasks: this.throttledBackgroundTasks,
      droppedHiddenPolls: this.droppedHiddenPolls,
      lastFrameLagMs: this.lastFrameLagMs,
      isCongested: this.isCongested,
      ecoMode: this.ecoMode,
      pollingMultiplier: this.getPollingMultiplier(),
    };
  }

  public subscribe(listener: (metrics: ThrottlerMetrics) => void): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleNotify() {
    if (this.listeners.size === 0 || typeof window === 'undefined') return;
    if (this.notifyTimer !== null) return;
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      const snapshot = this.getMetrics();
      this.listeners.forEach((listener) => listener(snapshot));
    }, 150);
  }
}

export const globalTaskThrottler = new GlobalTaskThrottler();

/**
 * React hook for observing real-time Global Task Throttler metrics in UI popovers.
 * Only subscribes when `enabled` is true so closed popovers incur zero re-renders.
 */
export function useTaskThrottlerMetrics(enabled = true): ThrottlerMetrics {
  const [metrics, setMetrics] = useState<ThrottlerMetrics>(() =>
    globalTaskThrottler.getMetrics()
  );

  useEffect(() => {
    if (!enabled) return;
    return globalTaskThrottler.subscribe(setMetrics);
  }, [enabled]);

  return metrics;
}
