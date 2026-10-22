export type JulesPrEventType = 'pr_completed' | 'pr_merged' | 'pr_verified';

export interface JulesPrNotification {
  id: string;
  eventType: JulesPrEventType;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  repo: string;
  branch: string;
  crewName?: string;
  coveragePct?: string | number;
  testsPassed?: number;
  vmTier?: string;
  timestamp: string;
  isoTimestamp: string;
  read: boolean;
}

const STORAGE_KEY = 'crewai_jules_pr_notifications_v1';
const EVENT_NAME = 'jules:pr-notification';

const INITIAL_NOTIFICATIONS: JulesPrNotification[] = [
  {
    id: 'jules-notif-seed-849',
    eventType: 'pr_completed',
    prNumber: 849,
    prTitle: 'feat(crew): autonomous multi-agent synthesis & durable @persist flow checkpoint',
    prUrl: 'https://github.com/bingkltech/crewAI/pull/849',
    repo: 'bingkltech/crewAI',
    branch: 'jules/auto-crew-849',
    crewName: 'AI & Tech Research Crew',
    coveragePct: '96.4%',
    testsPassed: 42,
    vmTier: 'standard-4core',
    timestamp: '2m ago',
    isoTimestamp: new Date(Date.now() - 120000).toISOString(),
    read: false
  },
  {
    id: 'jules-notif-seed-846',
    eventType: 'pr_merged',
    prNumber: 846,
    prTitle: 'fix(agent_utils): enforce message_content_text() helper for multimodal safety',
    prUrl: 'https://github.com/bingkltech/crewAI/pull/846',
    repo: 'bingkltech/crewAI',
    branch: 'jules/fix-multimodal-repr-846',
    crewName: 'Autonomous DevOps & SRE Crew',
    coveragePct: '98.1%',
    testsPassed: 56,
    vmTier: 'highmem-8core',
    timestamp: '18m ago',
    isoTimestamp: new Date(Date.now() - 1080000).toISOString(),
    read: true
  }
];

export function loadJulesPrNotifications(): JulesPrNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return INITIAL_NOTIFICATIONS;
}

export function saveJulesPrNotifications(list: JulesPrNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore storage errors
  }
}

export interface EmitJulesPrInput {
  eventType?: JulesPrEventType;
  prNumber: number;
  prTitle: string;
  prUrl?: string;
  repo: string;
  branch: string;
  crewName?: string;
  coveragePct?: string | number;
  testsPassed?: number;
  vmTier?: string;
}

export function emitJulesPrNotification(input: EmitJulesPrInput): JulesPrNotification {
  const cleanRepo = input.repo || 'bingkltech/crewAI';
  const prUrl =
    input.prUrl || `https://github.com/${cleanRepo}/pull/${input.prNumber}`;
  const now = new Date();
  const notification: JulesPrNotification = {
    id: `jules-pr-${input.prNumber}-${now.getTime()}`,
    eventType: input.eventType || 'pr_completed',
    prNumber: input.prNumber,
    prTitle: input.prTitle,
    prUrl,
    repo: cleanRepo,
    branch: input.branch,
    crewName: input.crewName,
    coveragePct: input.coveragePct ?? '96.8%',
    testsPassed: input.testsPassed ?? 44,
    vmTier: input.vmTier || 'standard-4core',
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isoTimestamp: now.toISOString(),
    read: false
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<JulesPrNotification>(EVENT_NAME, { detail: notification })
    );
  }

  return notification;
}

export function subscribeToJulesPrNotifications(
  handler: (notification: JulesPrNotification) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const custom = e as CustomEvent<JulesPrNotification>;
    if (custom.detail) {
      handler(custom.detail);
    }
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
