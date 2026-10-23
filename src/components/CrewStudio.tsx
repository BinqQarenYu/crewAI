import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentConfig, TaskConfig, CrewConfig, ExecutionLog, JulesContext, AuditCycleStage } from '../types';
import { TOOLS_CATALOG } from '../data/toolsCatalog';
import { 
  Play, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Layers, 
  GitBranch,
  UserPlus, 
  ListOrdered, 
  Cpu, 
  Terminal, 
  CheckCircle2, 
  Clock, 
  FileCode, 
  Copy, 
  Check, 
  Sparkles, 
  Wrench, 
  ShieldAlert,
  ArrowRight,
  Laptop,
  Save,
  Download,
  Upload,
  AlertCircle,
  History,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2,
  Search,
  Filter,
  FileText,
  Activity,
  AlertTriangle,
  Zap,
  ShieldCheck,
  RefreshCw,
  Mail
} from 'lucide-react';
import { GmailWorkspacePanel } from './GmailWorkspacePanel';
import { AutonomyStrategyDashboard } from './AutonomyStrategyDashboard';
import { StructuredAuditLogPanel } from './StructuredAuditLogPanel';
import { AgentAuditLog } from './AgentAuditLog';
import { AutonomousPRReviewModule } from './AutonomousPRReviewModule';
import { PredictiveSchedulerModule } from './PredictiveSchedulerModule';
import { PredictiveInsightsDashboard } from './PredictiveInsightsDashboard';
import { RepositoryHealthWidget } from './RepositoryHealthWidget';
import { WebhookSettingsPanel } from './WebhookSettingsPanel';
import { RemoteControlModule } from './RemoteControlModule';
import { SpoonFeedTopBar, ContextualGuideBubble, SpoonFeedStep } from './SpoonFeedGuideBanner';
import { CardMinMaxButtons } from './CardMinMaxControl';
import { CrewExecutionProgressBar, LiveTaskExecutionItem, LiveTaskExecStatus } from './CrewExecutionProgressBar';
import { TaskDependencyGraphVisualizer } from './TaskDependencyGraphVisualizer';
import { CURATED_TARGET_REPOS, resolveRepoWorkforceProfile } from '../utils/repoWorkforceMapping';
import { emitJulesPrNotification } from '../utils/prNotifications';
import { globalTaskThrottler } from '../utils/taskThrottler';
import { 
  ProviderStatus, 
  ConfigStatus, 
  resolveAvailableModel, 
  MODEL_PROVIDER_MAP,
  GeminiBudgetStrategy,
  GeminiQuotaStatus,
  resolveSmartGeminiRoute,
  GEMINI_MODEL_TIERS
} from '../utils/modelAvailability';

export const PRESET_CREWS: Record<string, CrewConfig> = {
  tech_research: {
    name: 'AI & Tech Research Crew',
    process: 'sequential',
    verbose: true,
    memory: true,
    agents: [
      {
        id: 'agent-1',
        name: 'Dr. Evelyn Vance',
        role: 'Senior Emerging Tech Researcher',
        goal: 'Uncover cutting-edge autonomous agent frameworks, state persistence methods, and benchmarks',
        backstory: 'Former principal scientist with 12 years analyzing distributed systems and machine learning runtime architecture.',
        model: 'gemini/gemini-3-flash-preview',
        tools: ['SerperDevTool', 'ScrapeWebsiteTool'],
        verbose: true,
        memory: true,
        maxIter: 10,
        allowDelegation: true
      },
      {
        id: 'agent-2',
        name: 'Marcus Sterling',
        role: 'Lead Technical Journalist & Synthesis Editor',
        goal: 'Synthesize research discoveries into a compelling, publication-ready executive technical brief',
        backstory: 'Veteran technology editor who has distilled thousands of complex whitepapers for engineering executives.',
        model: 'gemini/gemini-3-flash-preview',
        tools: ['FileWriteTool'],
        verbose: true,
        memory: true,
        maxIter: 8,
        allowDelegation: false
      }
    ],
    tasks: [
      {
        id: 'task-1',
        name: 'Research Breakthroughs',
        description: 'Search and analyze the latest multi-agent benchmarks, memory paradigms, and durable execution patterns in 2026.',
        expectedOutput: 'Detailed bulleted brief containing 3 key innovations, architectural diagrams overview, and cited sources.',
        agentId: 'agent-1',
        outputFormat: 'markdown'
      },
      {
        id: 'task-2',
        name: 'Draft Executive Brief',
        description: 'Using the research notes, craft an executive-ready report outlining architectural advantages and roadmap considerations.',
        expectedOutput: 'A polished Markdown report ready for engineering leadership with an Executive Summary, Technical Deep-Dive, and Recommendations.',
        agentId: 'agent-2',
        outputFormat: 'markdown'
      }
    ]
  },
  financial_audit: {
    name: 'FinTech Risk & Audit Crew',
    process: 'hierarchical',
    managerModel: 'gpt-4o',
    verbose: true,
    memory: true,
    agents: [
      {
        id: 'agent-fin-1',
        name: 'Sarah Chen, CFA',
        role: 'Quantitative Financial Analyst',
        goal: 'Extract 10-K financial ratios, operating margins, and balance sheet liabilities',
        backstory: 'Chartered Financial Analyst specializing in enterprise SaaS valuation and GAAP adjustments.',
        model: 'gpt-4o',
        tools: ['PDFSearchTool', 'CodeInterpreterTool'],
        verbose: true,
        memory: true,
        maxIter: 12,
        allowDelegation: true
      },
      {
        id: 'agent-fin-2',
        name: 'Jonathan Reynolds',
        role: 'Chief Compliance & Risk Officer',
        goal: 'Audit risk disclosures, regulatory exposure, and generate audit compliance scorecards',
        backstory: 'Former SEC regulatory counsel auditing risk frameworks for Fortune 500 corporations.',
        model: 'gpt-4o',
        tools: ['FileReadTool'],
        verbose: true,
        memory: true,
        maxIter: 8,
        allowDelegation: false
      }
    ],
    tasks: [
      {
        id: 'task-fin-1',
        name: 'Ratio Extraction & Trend Computation',
        description: 'Parse latest earnings statements, compute Rule of 40, Free Cash Flow conversion, and net burn rate.',
        expectedOutput: 'Structured JSON table of core financial indicators and comparative YoY ratios.',
        agentId: 'agent-fin-1',
        outputFormat: 'json'
      },
      {
        id: 'task-fin-2',
        name: 'Regulatory Risk Scorecard',
        description: 'Audit debt covenants and cross-border data compliance risks based on extracted financial data.',
        expectedOutput: 'Comprehensive risk matrix with traffic-light indicators (Green, Yellow, Red) and mitigation actions.',
        agentId: 'agent-fin-2',
        outputFormat: 'markdown'
      }
    ]
  },
  full_stack_app: {
    name: 'Full Stack App Development Crew (Complete 8-Agent Org)',
    process: 'hierarchical',
    managerModel: 'gemini/gemini-4-argon',
    verbose: true,
    memory: true,
    agents: [
      {
        id: 'agent-fs-task-maker',
        name: 'Elena Vance (Task Maker & PM Planner)',
        category: 'task_maker',
        role: 'Lead Task Maker, PRD Architect & Sprint Decomposer',
        goal: 'Decompose full-stack app visions into atomic, dependency-ordered engineering tasks, user stories, and strict acceptance criteria across Research, UI/UX, Frontend, Backend, Database, and DevOps',
        backstory: 'Principal Technical Product Manager and agile systems planner who transforms product ideas into unambiguous task graphs with strict input/output contracts using Linear, Jira, and GitHub Projects.',
        duties: [
          'Decompose high-level product requirements into atomic, dependency-ordered tasks for all 8 specialists',
          'Author detailed PRDs, user stories, and JSON/Pydantic acceptance criteria per task',
          'Provision sprint backlogs, story points, and milestone roadmaps in Project Management tools (Linear / Jira / GitHub Projects)',
          'Define strict API & UI contract boundaries between Design, Frontend, Backend, and Database layers'
        ],
        model: 'gemini/gemini-4-argon',
        tools: ['JiraLinearProjectTool', 'GitHubProjectBoardTool', 'SerperDevTool', 'FileWriteTool'],
        verbose: true,
        memory: true,
        maxIter: 12,
        allowDelegation: true
      },
      {
        id: 'agent-fs-task-controller',
        name: 'Marcus Sterling (Task Controller & QA Gatekeeper)',
        category: 'task_controller',
        role: 'Principal Task Controller, QA Gatekeeper & Project Management Orchestrator',
        goal: 'Control task execution order, enforce cross-agent handoff gates, audit deliverables against acceptance criteria, synchronize project management boards, and prevent scope or resource drift',
        backstory: 'Veteran Engineering Program Director and Release Controller who governs multi-agent software pipelines. Ensures zero unverified code passes between Design, Frontend, Backend, Database, and DevOps.',
        duties: [
          'Enforce task sequencing, dependency locks, and cross-agent handoff verification gates',
          'Audit every specialist output against the Task Maker acceptance checklist before advancing pipeline stage',
          'Synchronize live task status, blockers, and PR links across GitHub Projects, Linear, and Jira boards',
          'Sign off on Definition of Done (DoD), test coverage thresholds (>=95%), and CPU/Memory performance budgets'
        ],
        model: 'gemini/gemini-4-argon',
        tools: ['GitHubProjectBoardTool', 'JiraLinearProjectTool', 'ZapierActionsTool', 'FileReadTool'],
        verbose: true,
        memory: true,
        maxIter: 12,
        allowDelegation: true
      },
      {
        id: 'agent-fs-dash-researcher',
        name: 'Dr. Aria Lin (Deep Researcher: Beautiful Dashboards)',
        category: 'research',
        role: 'Deep Researcher on Beautiful Dashboards, Data Visualization & UX Intelligence',
        goal: 'Conduct deep research on what makes modern SaaS dashboards genuinely beautiful, scannable, and high-signal—covering bento grids, typographic hierarchy, color contrast, sparklines, and micro-interactions',
        backstory: 'Human-Computer Interaction (HCI) scientist and design intelligence researcher who benchmarks world-class interfaces (Linear, Stripe, Vercel, Raycast) to extract concrete visual and cognitive laws for breathtaking dashboards.',
        duties: [
          'Research state-of-the-art dashboard aesthetics, 12-column bento-grid layouts, and visual hierarchy rules',
          'Benchmark data density, KPI card anatomy, real-time telemetry sparklines, and progressive disclosure',
          'Synthesize a "Beautiful Dashboard Design Intelligence Brief" with concrete spacing, contrast, and motion rules',
          'Identify and eliminate UI anti-patterns (visual clutter, modal overload, low-contrast text, layout shift)'
        ],
        model: 'gemini/gemini-3.8-flash',
        tools: ['ExaSearchTool', 'TavilySearchTool', 'SerperDevTool', 'ScrapeWebsiteTool', 'VisionTool'],
        verbose: true,
        memory: true,
        maxIter: 10,
        allowDelegation: false
      },
      {
        id: 'agent-fs-uiux',
        name: 'Chloe Laurent (UI/UX Designer)',
        category: 'design',
        role: 'Principal UI/UX Designer & Design Systems Craftsperson',
        goal: 'Transform the Deep Researcher dashboard intelligence into a complete Tailwind design system, accessible color tokens, typographic scale, wireflows, and interactive component states',
        backstory: 'Award-winning UI/UX designer obsessed with pixel precision, WCAG AAA contrast compliance, tactile dark/light themes, and intuitive user flows that require zero training.',
        duties: [
          'Define design system tokens: surface elevation palette, accent colors, typography scale, and border radii',
          'Architect end-to-end user journeys, navigation ergonomics, empty states, skeleton loaders, and error UX',
          'Specify interactive component states (hover, focus-visible, keyboard shortcuts, [-] minimize / [+] expand controls)',
          'Verify responsive breakpoints across mobile, tablet, and ultra-wide desktop viewports'
        ],
        model: 'gemini/gemini-3.8-flash',
        tools: ['FigmaDesignTokensTool', 'VisionTool', 'DallETool', 'FileWriteTool'],
        verbose: true,
        memory: true,
        maxIter: 10,
        allowDelegation: false
      },
      {
        id: 'agent-fs-frontend-arch',
        name: 'Liam Vance (Frontend Architect)',
        category: 'frontend',
        role: 'Principal Frontend Architect (React, TypeScript, Tailwind & State Systems)',
        goal: 'Architect a modular, type-safe React + TypeScript frontend with zero-freeze rendering, throttled background polling, reusable UI primitives, and clean state management',
        backstory: 'Staff Frontend Architect specializing in React 19, strict TypeScript interfaces, Tailwind CSS v4, virtualized lists, and sub-16ms frame budgets so complex apps never freeze the browser.',
        duties: [
          'Architect modular /src component hierarchy, custom React hooks, and strict shared TypeScript interfaces (types.ts)',
          'Implement the Beautiful Dashboard layout grid, interactive charts, and accessible UI/UX component primitives',
          'Wire client-side API services with request coalescing, optimistic updates, and global task throttling',
          'Enforce zero-memory-leak cleanup, bounded log arrays, and strict TypeScript compilation'
        ],
        model: 'gemini/gemini-4-argon',
        tools: ['CodeInterpreterTool', 'DirectoryReadTool', 'FileReadTool', 'FileWriteTool', 'FigmaDesignTokensTool'],
        verbose: true,
        memory: true,
        maxIter: 15,
        allowDelegation: true
      },
      {
        id: 'agent-fs-backend',
        name: 'Noah Patel (Backend & API Lead)',
        category: 'backend',
        role: 'Senior Backend Systems & Distributed API Engineer',
        goal: 'Design and build secure, high-throughput REST/streaming API routes, authentication & RBAC middleware, payload validation, rate limiting, and service orchestration',
        backstory: 'Distributed backend engineer experienced in Node.js/Express and Python/FastAPI microservices, OAuth2/JWT security, idempotency keys, and fault-tolerant API gateways.',
        duties: [
          'Implement RESTful and SSE streaming API routes (/api/*) with strict input validation and typed responses',
          'Build authentication, session security, Role-Based Access Control (RBAC), and API rate-limiting middleware',
          'Orchestrate server-side business logic, webhook processors, and third-party OAuth/workspace integrations',
          'Guarantee structured JSON error envelopes, graceful timeouts, and sub-50ms p95 API latency'
        ],
        model: 'gemini/gemini-3.8-flash',
        tools: ['CodeInterpreterTool', 'FileReadTool', 'FileWriteTool', 'GithubSearchTool'],
        verbose: true,
        memory: true,
        maxIter: 15,
        allowDelegation: false
      },
      {
        id: 'agent-fs-database',
        name: 'Sofia Rostova (Database Architect)',
        category: 'database',
        role: 'Principal Database Architect & Data Modeling Engineer (SQL / NoSQL / Vector)',
        goal: 'Architect normalized relational schemas, high-performance composite indexes, zero-downtime migrations, query optimization plans, and multi-tenant data integrity',
        backstory: 'Database internals architect specializing in PostgreSQL, Drizzle/Prisma ORMs, pgvector semantic search, Redis caching layers, and ACID transaction safety under heavy load.',
        duties: [
          'Design normalized Entity-Relationship Diagrams (ERD), table schemas, foreign keys, and check constraints',
          'Create composite B-Tree, GIN, and pgvector indexes to eliminate slow full-table scans and N+1 queries',
          'Author idempotent up/down SQL migration scripts, ORM schema definitions, and deterministic seed data',
          'Configure Row-Level Security (RLS), connection pooling, and automated backup/retention policies'
        ],
        model: 'gemini/gemini-3.8-flash',
        tools: ['PGSearchTool', 'NL2SQLTool', 'QdrantVectorSearchTool', 'FileWriteTool', 'CodeInterpreterTool'],
        verbose: true,
        memory: true,
        maxIter: 12,
        allowDelegation: false
      },
      {
        id: 'agent-fs-devops',
        name: 'Kai Nakamura (DevOps & Cloud SRE)',
        category: 'devops',
        role: 'Principal DevOps, CI/CD Automation & Cloud Reliability Engineer',
        goal: 'Automate containerization, CI/CD test & build pipelines, environment security, observability telemetry, CPU/memory resource guards, and zero-downtime cloud rollouts',
        backstory: 'Site Reliability and DevSecOps architect who engineers self-healing cloud infrastructure with Docker, Kubernetes, GitHub Actions, OpenTelemetry, and Jules VM sandboxes.',
        duties: [
          'Author multi-stage Dockerfiles, Kubernetes manifests, .env.example templates, and GitHub Actions CI/CD workflows',
          'Configure automated lint, TypeScript compile, PyTest/Vitest suites, and SAST container security scans',
          'Provision /api/health probes, OpenTelemetry tracing, and CPU/RAM throttling guardrails',
          'Manage canary traffic rollouts, automated rollback triggers, and verified GitHub PR deployment gates'
        ],
        model: 'gemini/gemini-3.8-flash',
        tools: ['DockerK8sDeployTool', 'GithubSearchTool', 'DirectoryReadTool', 'FileWriteTool', 'ZapierActionsTool'],
        verbose: true,
        memory: true,
        maxIter: 12,
        allowDelegation: false
      }
    ],
    tasks: [
      {
        id: 'task-fs-1',
        name: '1. [Task Maker] PRD Decomposition & Sprint Backlog Creation',
        phase: 'Phase 1: Task Making & PM Setup',
        description: 'Decompose the full-stack application objective into epics, atomic tasks, dependency DAGs, and strict acceptance criteria across Research, UI/UX, Frontend, Backend, Database, and DevOps. Create tracked tickets in Project Management tools.',
        expectedOutput: 'Structured Sprint Backlog (Markdown + JSON) with task IDs, assigned specialists, story points, dependency order, and acceptance gates.',
        agentId: 'agent-fs-task-maker',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-2',
        name: '2. [Deep Research] Beautiful Dashboard & UX Benchmark Intelligence',
        phase: 'Phase 2: Deep Dashboard Research',
        description: 'Conduct deep research on what makes a modern dashboard genuinely beautiful and high-signal for this domain: bento-grid proportions, KPI hierarchy, chart density, dark-mode contrast, and micro-interactions.',
        expectedOutput: 'Beautiful Dashboard Intelligence Report detailing layout grid architecture, visual hierarchy laws, telemetry card patterns, and UX anti-patterns to avoid.',
        agentId: 'agent-fs-dash-researcher',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-3',
        name: '3. [UI/UX Design] Design System Tokens, Wireflows & Component Spec',
        phase: 'Phase 3: UI/UX Design System',
        description: 'Translate the Deep Researcher dashboard brief into concrete Tailwind CSS design tokens (colors, surfaces, typography scale, spacing), interactive user flows, and responsive component anatomy.',
        expectedOutput: 'Complete UI/UX Design System Specification & Wireflow Blueprint with WCAG AAA contrast verification and interactive state matrix.',
        agentId: 'agent-fs-uiux',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-4',
        name: '4. [Database Architecture] Relational Schema, Indexes & Migrations',
        phase: 'Phase 4: Database & Data Layer',
        description: 'Architect the production relational/vector database schema, entity relationships, foreign key constraints, composite indexes, and idempotent migration + seed scripts.',
        expectedOutput: 'Complete SQL/ORM Schema definition, ERD specification, query indexing plan, and migration scripts.',
        agentId: 'agent-fs-database',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-5',
        name: '5. [Backend Engineering] API Routes, Auth/RBAC & Service Layer',
        phase: 'Phase 5: Backend & API Engineering',
        description: 'Implement secure REST/streaming API routes, authentication & RBAC middleware, request validation schemas, rate limiting, and database service controllers.',
        expectedOutput: 'Production Backend API specification & implementation with route contracts, auth guards, and structured error handling.',
        agentId: 'agent-fs-backend',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-6',
        name: '6. [Frontend Architecture] React Component Tree, State & Dashboard UI',
        phase: 'Phase 6: Frontend Architecture',
        description: 'Architect and build the modular React + TypeScript frontend implementing the Beautiful Dashboard design system, shared TypeScript interfaces, responsive bento cards, and throttled API integration.',
        expectedOutput: 'Modular React + TypeScript component architecture, state hooks, and high-craft dashboard views.',
        agentId: 'agent-fs-frontend-arch',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-7',
        name: '7. [DevOps & SRE] CI/CD Pipeline, Dockerization & Resource Guardrails',
        phase: 'Phase 7: DevOps & Cloud Readiness',
        description: 'Create multi-stage Dockerfiles, GitHub Actions CI/CD test & build workflows, .env.example configuration, security hardening, and CPU/RAM health observability.',
        expectedOutput: 'Dockerfile, CI/CD workflow manifest, security audit report, and zero-downtime deployment runbook.',
        agentId: 'agent-fs-devops',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      },
      {
        id: 'task-fs-8',
        name: '8. [Task Controller] End-to-End QA Gate, PM Board Sync & Release Sign-Off',
        phase: 'Phase 8: Task Control & Release Sign-Off',
        description: 'Audit all 7 specialist deliverables against the Task Maker acceptance criteria, verify integration tests in Jules Cloud VM, sync Project Management boards to Done, and approve GitHub PR release.',
        expectedOutput: 'Executive Task Controller Sign-Off Scorecard with 100% requirement traceability, test coverage verification, and PR merge authorization.',
        agentId: 'agent-fs-task-controller',
        controllerAgentId: 'agent-fs-task-controller',
        outputFormat: 'markdown'
      }
    ]
  },
  devops_deployment: {
    name: 'Autonomous DevOps & SRE Crew',
    process: 'sequential',
    verbose: true,
    memory: true,
    agents: [
      {
        id: 'sre-1',
        name: 'Nexus-7',
        role: 'Site Reliability Engineer',
        goal: 'Monitor CI/CD health and automate zero-downtime rollouts',
        backstory: 'A highly optimized system agent focused on infrastructure stability and error budget management.',
        model: 'gemini/gemini-3-flash-preview',
        tools: ['GithubSearchTool', 'FileWriteTool'],
        verbose: true,
        memory: true,
        maxIter: 15,
        allowDelegation: false
      },
      {
        id: 'security-1',
        name: 'Aegis',
        role: 'DevSecOps Specialist',
        goal: 'Scan container images and dependencies for critical vulnerabilities',
        backstory: 'Hardened security kernel designed to intercept and patch security leaks before deployment.',
        model: 'gpt-4o',
        tools: ['ScrapeWebsiteTool'],
        verbose: true,
        memory: true,
        maxIter: 5,
        allowDelegation: true
      }
    ],
    tasks: [
      {
        id: 'devops-task-1',
        name: 'Pre-Flight Security Audit',
        description: 'Scan the latest repository PRs for secret leaks and insecure package versions.',
        expectedOutput: 'Detailed security scorecard and recommended patch list.',
        agentId: 'security-1',
        outputFormat: 'markdown'
      },
      {
        id: 'devops-task-2',
        name: 'Canary Deployment Prep',
        description: 'Configure a 5% canary traffic split for the new release and set up rollback triggers.',
        expectedOutput: 'Kubernetes manifest for canary deployment.',
        agentId: 'sre-1',
        outputFormat: 'json'
      }
    ]
  },
  content_strategy: {
    name: 'Multi-Channel Content Synthesis Crew',
    process: 'sequential',
    verbose: true,
    memory: true,
    agents: [
      {
        id: 'content-1',
        name: 'Aria Pen',
        role: 'Creative Storyteller',
        goal: 'Draft engaging long-form articles and technical blog posts',
        backstory: 'Novelist turned technical writer who knows how to make complex AI topics feel human and accessible.',
        model: 'claude-3-5-sonnet',
        tools: ['SerperDevTool'],
        verbose: true,
        memory: true,
        maxIter: 8,
        allowDelegation: false
      },
      {
        id: 'marketing-1',
        name: 'Growth Hacker',
        role: 'Social Media Strategist',
        goal: 'Optimize content for X, LinkedIn, and Threads to maximize reach',
        backstory: 'Viral marketing expert who understands algorithmic trend-surfing and hook-writing.',
        model: 'gemini/gemini-3-flash-preview',
        tools: [],
        verbose: true,
        memory: true,
        maxIter: 5,
        allowDelegation: true
      }
    ],
    tasks: [
      {
        id: 'content-task-1',
        name: 'Technical Blog Draft',
        description: 'Write a 1200-word deep-dive into the future of autonomous agent flows.',
        expectedOutput: 'Markdown formatted blog post with H1-H4 headings and code snippets.',
        agentId: 'content-1',
        outputFormat: 'markdown'
      },
      {
        id: 'content-task-2',
        name: 'Social Distribution Plan',
        description: 'Extract 5 high-impact hooks from the blog post for social media threads.',
        expectedOutput: 'JSON list of social posts and target hashtags.',
        agentId: 'marketing-1',
        outputFormat: 'json'
      }
    ]
  }
};

const AUTOSAVE_STORAGE_KEY = 'crewai_studio_workflow_autosave';

interface SavedWorkflowState {
  activePreset: string;
  crew: CrewConfig;
  selectedAgentId: string;
  runInput: string;
  savedAt: string;
}

const loadSavedWorkflow = (): SavedWorkflowState | null => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.crew &&
        Array.isArray(parsed.crew.agents) &&
        parsed.crew.agents.length > 0 &&
        Array.isArray(parsed.crew.tasks)
      ) {
        // Automatically upgrade legacy 3-agent full_stack_app or untouched initial tech_research cache to the full 8-agent Full Stack App Development preset
        if (
          (parsed.activePreset === 'full_stack_app' && parsed.crew.agents.length < 8) ||
          (parsed.activePreset === 'tech_research' &&
            parsed.crew.agents.length === 2 &&
            parsed.crew.agents[0]?.id === 'agent-1')
        ) {
          return {
            activePreset: 'full_stack_app',
            crew: PRESET_CREWS.full_stack_app,
            selectedAgentId: PRESET_CREWS.full_stack_app.agents[0].id,
            runInput:
              'Build an Enterprise SaaS Operations & Telemetry Platform with Beautiful Bento Dashboard, RBAC Auth, PostgreSQL & CI/CD',
            savedAt: new Date().toISOString()
          };
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load autosaved workflow from localStorage', e);
  }
  return null;
};

export interface ExecutionRunRecord {
  id: string;
  timestamp: string;
  isoTime: string;
  crewName: string;
  inputTopic: string;
  processMode: 'sequential' | 'hierarchical';
  agentsCount: number;
  tasksCount: number;
  status: 'completed' | 'failed';
  durationMs: number;
  tokensUsed: number;
  logs: ExecutionLog[];
  summary?: string;
}

const HISTORY_STORAGE_KEY = 'crewai_studio_execution_history';

const DEFAULT_HISTORY_RUNS: ExecutionRunRecord[] = [
  {
    id: 'run-init-1',
    timestamp: 'Today at 09:15 AM',
    isoTime: new Date(Date.now() - 7200000).toISOString(),
    crewName: 'AI & Tech Research Crew',
    inputTopic: 'Multi-Agent Event-Driven Systems',
    processMode: 'sequential',
    agentsCount: 2,
    tasksCount: 2,
    status: 'completed',
    durationMs: 4120,
    tokensUsed: 1420,
    summary: 'Synthesized 14 benchmarks on durable agentic execution, role isolation, and telemetry.',
    logs: [
      {
        id: 'hist-1-1',
        timestamp: '09:15:02 AM',
        type: 'system',
        title: 'Crew Execution Initialized',
        content: 'Starting AI & Tech Research Crew with 2 agents and 2 tasks in sequential mode. Inputs: { topic: "Multi-Agent Event-Driven Systems" }'
      },
      {
        id: 'hist-1-2',
        timestamp: '09:15:03 AM',
        type: 'thought',
        agentName: 'AI Tech Researcher',
        title: 'AI Tech Researcher enters reasoning loop',
        content: 'Analyzing objective for "Multi-Agent Event-Driven Systems". Querying research indices for architectural patterns.'
      },
      {
        id: 'hist-1-3',
        timestamp: '09:15:04 AM',
        type: 'tool_call',
        title: 'Invoking SerperDevTool',
        content: 'Query: "state of Multi-Agent Event-Driven Systems benchmarks 2026"',
        meta: { toolName: 'SerperDevTool', durationMs: 420 }
      },
      {
        id: 'hist-1-4',
        timestamp: '09:15:06 AM',
        type: 'task_complete',
        title: 'Crew Execution Complete (200 OK)',
        content: 'Executive Deliverable: Multi-Agent Event-Driven Systems synthesized with durable state checkpoints.',
        meta: { tokens: 1420, durationMs: 4120 }
      }
    ]
  },
  {
    id: 'run-init-2',
    timestamp: 'Yesterday at 04:30 PM',
    isoTime: new Date(Date.now() - 86400000).toISOString(),
    crewName: 'FinTech Risk & Audit Crew',
    inputTopic: 'Basel IV Capital Adequacy Compliance',
    processMode: 'hierarchical',
    agentsCount: 3,
    tasksCount: 2,
    status: 'completed',
    durationMs: 5890,
    tokensUsed: 2150,
    summary: 'Audited tier-1 risk portfolios and verified regulatory ratios.',
    logs: [
      {
        id: 'hist-2-1',
        timestamp: '04:30:00 PM',
        type: 'system',
        title: 'Hierarchical Crew Initialized',
        content: 'Manager agent coordinating risk audit and stress test analysts.'
      },
      {
        id: 'hist-2-2',
        timestamp: '04:30:05 PM',
        type: 'task_complete',
        title: 'Audit Complete (200 OK)',
        content: 'Capital buffers confirmed within statutory thresholds.',
        meta: { tokens: 2150, durationMs: 5890 }
      }
    ]
  }
];

const loadSavedHistory = (): ExecutionRunRecord[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not load execution history from localStorage', e);
  }
  return DEFAULT_HISTORY_RUNS;
};

interface CrewStudioProps {
  onOpenOllamaScanner?: () => void;
  onNavigateToGitHub?: () => void;
  onOpenJules?: (context?: JulesContext) => void;
  selectedRepo: string;
  selectedBranch: string;
  onRepoChange?: (repo: string) => void;
  onBranchChange?: (branch: string) => void;
}

export const CrewStudio: React.FC<CrewStudioProps> = ({ 
  onOpenOllamaScanner, 
  onNavigateToGitHub,
  onOpenJules,
  selectedRepo,
  selectedBranch,
  onRepoChange,
  onBranchChange
}) => {
  const initialSaved = useRef(loadSavedWorkflow()).current;

  const [activePreset, setActivePreset] = useState<string>(initialSaved?.activePreset || 'full_stack_app');
  const [crew, setCrew] = useState<CrewConfig>(initialSaved?.crew || PRESET_CREWS.full_stack_app);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    initialSaved?.selectedAgentId || initialSaved?.crew?.agents[0]?.id || PRESET_CREWS.full_stack_app.agents[0]?.id || ''
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'jsonc'>('python');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [runInput, setRunInput] = useState<string>(
    initialSaved?.runInput ||
      'Build an Enterprise SaaS Operations & Telemetry Platform with Beautiful Bento Dashboard, RBAC Auth, PostgreSQL & CI/CD'
  );
  const [isOrgMatrixMinimized, setIsOrgMatrixMinimized] = useState<boolean>(false);
  const [isRepoWorkforceMinimized, setIsRepoWorkforceMinimized] = useState<boolean>(false);
  const [autoSyncRepoCrew, setAutoSyncRepoCrew] = useState<boolean>(true);
  const repoWorkforce = resolveRepoWorkforceProfile(selectedRepo);

  // Auto-Save Status
  const [lastSaved, setLastSaved] = useState<string | null>(
    initialSaved?.savedAt ? new Date(initialSaved.savedAt).toLocaleTimeString() : null
  );
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>(initialSaved ? 'saved' : 'idle');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Execution History State
  const [executionHistory, setExecutionHistory] = useState<ExecutionRunRecord[]>(loadSavedHistory);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'all' | 'completed' | 'failed'>('all');
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [showGmailPanel, setShowGmailPanel] = useState<boolean>(false);

  // Model Availability & Gemini Credit Governor State
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [geminiQuota, setGeminiQuota] = useState<GeminiQuotaStatus | null>(null);
  const [geminiStrategy, setGeminiStrategy] = useState<GeminiBudgetStrategy>(() => {
    const saved = localStorage.getItem('crewai_gemini_strategy');
    if (saved === 'hybrid_auto' || saved === 'free_tier_guard' || saved === 'argon_priority') {
      return saved;
    }
    return 'hybrid_auto';
  });
  const [argonBudgetCap, setArgonBudgetCap] = useState<number>(() => {
    const saved = Number(localStorage.getItem('crewai_argon_budget_cap'));
    return saved >= 1000 ? saved : 50000;
  });

  // Real-Time Agent Heartbeat & 24/7 Autonomous Watchdog State
  type AgentLiveStatus = 'standby_pulse' | 'reasoning' | 'tool_exec' | 'delegating' | 'completed' | 'self_healing';
  interface AgentHeartbeatState {
    agentId: string;
    status: AgentLiveStatus;
    latencyMs: number;
    bpm: number;
    lastPulse: string;
    currentActivity: string;
    pulseWave: number[];
    uptimePct: string;
  }

  const [agentHeartbeats, setAgentHeartbeats] = useState<Record<string, AgentHeartbeatState>>({});
  const [heartbeatTick, setHeartbeatTick] = useState<number>(0);
  const [serverHeartbeatSlot, setServerHeartbeatSlot] = useState<string>('Primary Key Slot');
  const [autonomousDaemon, setAutonomousDaemon] = useState<boolean>(false);
  const [daemonCountdown, setDaemonCountdown] = useState<number>(20);
  const [daemonCycles, setDaemonCycles] = useState<number>(14);
  const [showAutonomyBlueprint, setShowAutonomyBlueprint] = useState<boolean>(false);
  const [fullCycleEnabled, setFullCycleEnabled] = useState<boolean>(true);
  const [activeCycleStage, setActiveCycleStage] = useState<AuditCycleStage | 'idle' | 'completed'>('completed');
  const [liveProgressPct, setLiveProgressPct] = useState<number>(100);
  const [activeExecTaskId, setActiveExecTaskId] = useState<string | null>(null);
  const [activeExecAgentId, setActiveExecAgentId] = useState<string | null>(null);
  const [taskExecutions, setTaskExecutions] = useState<Record<string, LiveTaskExecutionItem>>({});
  const [execElapsedMs, setExecElapsedMs] = useState<number>(4120);
  const [latestInterceptedPr, setLatestInterceptedPr] = useState<number | null>(null);
  const [loadedKeyCount, setLoadedKeyCount] = useState<number>(0);
  const envFileInputRef = useRef<HTMLInputElement | null>(null);

  // Per-Card Minimize State
  const [isQuotaGovernorMinimized, setIsQuotaGovernorMinimized] = useState<boolean>(false);
  const [isHeartbeatMinimized, setIsHeartbeatMinimized] = useState<boolean>(false);
  const [isAgentsCardMinimized, setIsAgentsCardMinimized] = useState<boolean>(false);
  const [isTasksCardMinimized, setIsTasksCardMinimized] = useState<boolean>(false);
  const [isCodeExportMinimized, setIsCodeExportMinimized] = useState<boolean>(false);
  const [areAllCardsMinimized, setAreAllCardsMinimized] = useState<boolean>(false);

  // Interactive Beginner Spoon-Feed Guide ("Click Me Here" / "Do This" Bubbles)
  const [isGuideMode, setIsGuideMode] = useState<boolean>(true);
  const [guideStep, setGuideStep] = useState<SpoonFeedStep>(1);
  const [isPushingPat, setIsPushingPat] = useState<boolean>(false);
  const [suggestingTaskId, setSuggestingTaskId] = useState<string | null>(null);
  const pendingPushAfterEnvRef = useRef<boolean>(false);

  const suggestImprovement = async (task: TaskConfig) => {
    setSuggestingTaskId(task.id);
    try {
      const res = await fetch('/api/ai/suggest-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: task.description })
      });
      const data = await res.json();
      if (data.improvedDescription) {
        setCrew(c => ({
          ...c,
          tasks: c.tasks.map(t => t.id === task.id ? { ...t, description: data.improvedDescription.trim() } : t)
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuggestingTaskId(null);
    }
  };

  const handleSelectGuideStep = useCallback((step: SpoonFeedStep) => {
    setIsGuideMode(true);
    setGuideStep(step);
    if (step === 3) setIsAgentsCardMinimized(false);
    if (step === 4) setIsTasksCardMinimized(false);
    if (step === 6) setIsCodeExportMinimized(false);
    setTimeout(() => {
      const el = document.getElementById(`guide-step-${step}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }, []);

  const handleStartFreshBeginnerProject = () => {
    const freshCrew: CrewConfig = {
      name: 'My Autonomous App Crew',
      process: 'sequential',
      verbose: true,
      memory: true,
      agents: [
        {
          id: 'agent-starter-1',
          name: 'Alex (Lead Architect)',
          role: 'Product & System Architect',
          goal: 'Break down the user project idea into a clear architecture and file plan',
          backstory: 'Friendly senior architect who turns simple ideas into clean technical blueprints.',
          model: 'gemini/gemini-3-flash-preview',
          tools: ['SerperDevTool', 'FileReadTool'],
          verbose: true,
          memory: true,
          maxIter: 10,
          allowDelegation: true
        },
        {
          id: 'agent-starter-2',
          name: 'Sam (Full-Stack Builder)',
          role: 'Autonomous Full-Stack Developer',
          goal: 'Write production-ready code and tests based on the architecture plan',
          backstory: 'Hands-on builder who writes clean code, runs tests in Jules VM, and prepares GitHub PRs.',
          model: 'gemini/gemini-3-flash-preview',
          tools: ['CodeInterpreterTool', 'FileWriteTool'],
          verbose: true,
          memory: true,
          maxIter: 12,
          allowDelegation: false
        }
      ],
      tasks: [
        {
          id: 'task-starter-1',
          name: '1. Plan the Project Architecture',
          description: 'Analyze the project topic and list the exact features, pages, and backend endpoints needed.',
          expectedOutput: 'Step-by-step Markdown blueprint of the project structure.',
          agentId: 'agent-starter-1',
          outputFormat: 'markdown'
        },
        {
          id: 'task-starter-2',
          name: '2. Build & Verify the Code',
          description: 'Implement the core modules, validate with automated tests, and package for GitHub.',
          expectedOutput: 'Verified code implementation and test summary.',
          agentId: 'agent-starter-2',
          outputFormat: 'markdown'
        }
      ]
    };
    setCrew(freshCrew);
    setActivePreset('custom');
    setSelectedAgentId(freshCrew.agents[0].id);
    setRunInput('Build a modern Task & Habit Tracker Web App');
    showNotification('success', 'Created fresh project "My Autonomous App Crew"! Now follow Step 2 below.');
    handleSelectGuideStep(2);
  };

  useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (detail && typeof detail.minimized === 'boolean') {
        setAreAllCardsMinimized(detail.minimized);
        setIsQuotaGovernorMinimized(detail.minimized);
        setIsHeartbeatMinimized(detail.minimized);
        setIsAgentsCardMinimized(detail.minimized);
        setIsTasksCardMinimized(detail.minimized);
        setIsCodeExportMinimized(detail.minimized);
      }
    };
    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggle);
    return () => window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggle);
  }, []);

  const buildSampleCycleLogs = useCallback(
    (targetCrew: CrewConfig, topic: string): ExecutionLog[] => {
      const a1 = targetCrew.agents[0];
      const a2 = targetCrew.agents[1] || targetCrew.agents[0];
      const traceId = 'tr-849a';
      const now = new Date();
      const fmt = (offsetSec: number) =>
        new Date(now.getTime() - offsetSec * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

      return [
        {
          id: 'seed-1',
          timestamp: fmt(14),
          isoTimestamp: new Date(now.getTime() - 14000).toISOString(),
          traceId,
          spanId: 'sp-01',
          stage: 'orchestrator',
          severity: 'info',
          agentName: 'Flow Orchestrator',
          type: 'system',
          title: '1. Orchestrator Triggered (@persist Flow State & Quota Governor)',
          content: `Initialized durable Flow state for "${targetCrew.name}" on topic "${topic}". Routed routine tasks to Gemini Free-Tier Pool and reserved Paid Argon for complex synthesis.`,
          meta: {
            model: a1?.model || 'gemini/gemini-3-flash-preview',
            keySlot: 'Free Pool Slot #1',
            durationMs: 18
          }
        },
        {
          id: 'seed-2',
          timestamp: fmt(12),
          isoTimestamp: new Date(now.getTime() - 12000).toISOString(),
          traceId,
          spanId: 'sp-02',
          stage: 'crew',
          severity: 'info',
          agentId: a1?.id,
          agentName: a1?.name || 'Lead Researcher',
          type: 'thought',
          title: `${a1?.name || 'Agent 1'} Executing Domain Analysis`,
          content: `Evaluating architectural patterns for "${topic}". Formulating tool search queries and extracting verifiable citations.`,
          meta: {
            model: a1?.model || 'gemini/gemini-3-flash-preview',
            keySlot: 'Free Pool Slot #1',
            tokens: 340,
            durationMs: 410
          }
        },
        {
          id: 'seed-3',
          timestamp: fmt(10),
          isoTimestamp: new Date(now.getTime() - 10000).toISOString(),
          traceId,
          spanId: 'sp-03',
          stage: 'crew',
          severity: 'info',
          agentId: a1?.id,
          agentName: a1?.name || 'Lead Researcher',
          type: 'tool_call',
          title: `Tool Execution: ${a1?.tools[0] || 'SerperDevTool'}`,
          content: `Executed structured retrieval for "${topic}". Extracted 12 benchmark specifications and handed off context to ${a2?.name || 'Synthesis Agent'}.`,
          meta: {
            toolName: a1?.tools[0] || 'SerperDevTool',
            tokens: 290,
            durationMs: 380
          }
        },
        {
          id: 'seed-4',
          timestamp: fmt(8),
          isoTimestamp: new Date(now.getTime() - 8000).toISOString(),
          traceId,
          spanId: 'sp-04',
          stage: 'crew',
          severity: 'success',
          agentId: a2?.id,
          agentName: a2?.name || 'Synthesis Editor',
          type: 'delegation',
          title: `${a2?.name || 'Agent 2'} Drafted Artifact & Handed Off to Jules VM`,
          content: `Synthesized standalone crew.py & test spec. Emitting artifact handoff to Google Jules Cloud VM for isolated verification.`,
          meta: {
            model: a2?.model || 'gemini/gemini-3-flash-preview',
            tokens: 510,
            durationMs: 620
          }
        },
        {
          id: 'seed-5',
          timestamp: fmt(5),
          isoTimestamp: new Date(now.getTime() - 5000).toISOString(),
          traceId,
          spanId: 'sp-05',
          stage: 'jules',
          severity: 'warn',
          agentName: 'Google Jules VM',
          type: 'jules_heal',
          title: '3. Jules Cloud VM — PyTest & Self-Healing Pass (1 Fault Auto-Repaired)',
          content: `Cloned ${selectedRepo}@${selectedBranch} in ephemeral VM. Intercepted Pydantic OutputSchema validation mismatch on pass #1; synthesized patch & re-ran pytest: 42/42 passed.`,
          meta: {
            toolName: 'pytest + mypy',
            coveragePct: 96.4,
            exitCode: 0,
            durationMs: 1420,
            repairedFault: 'Pydantic OutputSchema validation guard'
          }
        },
        {
          id: 'seed-6',
          timestamp: fmt(2),
          isoTimestamp: new Date(now.getTime() - 2000).toISOString(),
          traceId,
          spanId: 'sp-06',
          stage: 'github',
          severity: 'success',
          agentName: 'GitHub PR Gatekeeper',
          type: 'github_pr',
          title: '4. Verified GitHub PR #849 Opened & Reported to Orchestrator',
          content: `Pushed verified green commit to branch jules/auto-crew-849 and opened Pull Request #849 on ${selectedRepo}. Orchestrator @persist state marked COMPLETED.`,
          meta: {
            branch: 'jules/auto-crew-849',
            prNumber: 849,
            prUrl: `https://github.com/${selectedRepo}/pull/849`,
            coveragePct: 96.4,
            exitCode: 0,
            durationMs: 310
          }
        }
      ];
    },
    [selectedRepo, selectedBranch]
  );

  // Seed initial structured 4-stage audit trace once so the audit stream is immediately searchable
  const hasSeededInitialLogs = useRef(false);
  useEffect(() => {
    if (!hasSeededInitialLogs.current && logs.length === 0) {
      hasSeededInitialLogs.current = true;
      setLogs(buildSampleCycleLogs(crew, runInput));
    }
  }, [buildSampleCycleLogs, crew, logs.length, runInput]);

  // Initialize & sync heartbeat entries whenever crew.agents changes
  useEffect(() => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAgentHeartbeats((prev) => {
      const next: Record<string, AgentHeartbeatState> = {};
      crew.agents.forEach((agent, idx) => {
        const existing = prev[agent.id];
        const baseLat = 18 + ((idx * 7) % 19);
        next[agent.id] = existing || {
          agentId: agent.id,
          status: 'standby_pulse',
          latencyMs: baseLat,
          bpm: 30,
          lastPulse: nowStr,
          currentActivity: `Heartbeat 200 OK • Ready on ${agent.model.replace('gemini/', '')}`,
          pulseWave: [18, 22, 19, 25, 21, 20, 24, 19, 23, 21, 20, baseLat],
          uptimePct: '99.98%'
        };
      });
      return next;
    });
  }, [crew.agents]);

  // Eco CPU Mode (Default ON: pauses idle background intervals so PC CPU & RAM stay near 0% when idle)
  const [ecoCpuMode, setEcoCpuMode] = useState<boolean>(() => {
    return localStorage.getItem('crewai_eco_cpu_mode') !== 'false';
  });

  useEffect(() => {
    const handleEcoChange = (e: Event) => {
      const detail = (e as CustomEvent<{ ecoMode: boolean }>).detail;
      if (detail && typeof detail.ecoMode === 'boolean') {
        setEcoCpuMode(detail.ecoMode);
      }
    };
    const handleTrimMemory = () => {
      setLogs((prev) => prev.slice(-15));
      setExecutionHistory((prev) => prev.slice(0, 3));
    };
    window.addEventListener('crewai:eco-mode-changed', handleEcoChange);
    window.addEventListener('crewai:trim-memory', handleTrimMemory);
    return () => {
      window.removeEventListener('crewai:eco-mode-changed', handleEcoChange);
      window.removeEventListener('crewai:trim-memory', handleTrimMemory);
    };
  }, []);

  // Real-time heartbeat interval (only runs when Crew is actively executing, Watchdog is ON, or Eco Mode is OFF)
  useEffect(() => {
    if (ecoCpuMode && !isRunning && !autonomousDaemon) {
      return;
    }
    if (isHeartbeatMinimized && !isRunning) {
      return;
    }

    const baseIntervalMs = isRunning ? 1100 : 6000;
    const intervalMs = Math.round(baseIntervalMs * (isRunning ? 1 : globalTaskThrottler.getPollingMultiplier()));
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const t0 = Date.now();
      let measuredRtt = 16 + Math.floor(Math.random() * 14);
      if (!isRunning && Math.random() < 0.25) {
        try {
          const hbRes = await fetch('/api/agents/heartbeat');
          if (hbRes.ok) {
            const hbData = await hbRes.json();
            measuredRtt = Math.max(8, Date.now() - t0);
            if (hbData.activeKeySlot) setServerHeartbeatSlot(hbData.activeKeySlot);
          }
        } catch {
          // fallback local pulse measurement
        }
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHeartbeatTick((t) => t + 1);
      setAgentHeartbeats((prev) => {
        const next: Record<string, AgentHeartbeatState> = { ...prev };
        crew.agents.forEach((agent, idx) => {
          const cur = prev[agent.id];
          const isBusy = cur && (cur.status === 'reasoning' || cur.status === 'tool_exec' || cur.status === 'delegating');
          const jitter = Math.floor(Math.random() * 11) - 5;
          const nextLatency = isBusy
            ? Math.max(45, Math.min(190, (cur?.latencyMs || 85) + jitter * 3))
            : Math.max(11, Math.min(48, measuredRtt + idx * 3 + jitter));
          const prevWave = cur?.pulseWave || [20, 22, 19, 24, 21, 20, 23, 18, 22, 20, 21, 19];
          next[agent.id] = {
            agentId: agent.id,
            status: cur?.status || 'standby_pulse',
            latencyMs: nextLatency,
            bpm: isBusy ? 92 + (idx * 6) : autonomousDaemon ? 48 : 30,
            lastPulse: nowStr,
            currentActivity:
              cur && cur.status !== 'standby_pulse'
                ? cur.currentActivity
                : autonomousDaemon
                ? `24/7 Watchdog Active • Polling repo & task queue (${nextLatency}ms)`
                : `Heartbeat 200 OK • Ready on ${agent.model.replace('gemini/', '')}`,
            pulseWave: [...prevWave.slice(1), nextLatency],
            uptimePct: cur?.uptimePct || '99.98%'
          };
        });
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [crew.agents, isRunning, autonomousDaemon, ecoCpuMode, isHeartbeatMinimized]);

  const fetchGeminiQuotaStatus = useCallback(() => {
    fetch('/api/gemini/quota-status')
      .then(res => res.json())
      .then((data: GeminiQuotaStatus) => {
        setGeminiQuota(data);
      })
      .catch(() => {
        // Fallback local quota state
      });
  }, []);

  useEffect(() => {
    fetch('/api/config/status')
      .then(res => res.json())
      .then(async (data: ConfigStatus & { loadedKeyCount?: number; hasDotEnvFile?: boolean }) => {
        // Auto-restore .env from browser backup if container/workspace .env was deleted
        const savedEnvBackup = localStorage.getItem('crewai_saved_dotenv_backup');
        if (!data.hasDotEnvFile && savedEnvBackup) {
          try {
            const restoreRes = await fetch('/api/config/upload-env', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ envContent: savedEnvBackup })
            });
            if (restoreRes.ok) {
              const restoredData = await restoreRes.json();
              setProviderStatus(restoredData.providers);
              if (typeof restoredData.loadedKeyCount === 'number') {
                setLoadedKeyCount(restoredData.loadedKeyCount);
              }
              return;
            }
          } catch {
            // ignore restore error
          }
        }
        setProviderStatus(data.providers);
        if (typeof data.loadedKeyCount === 'number') {
          setLoadedKeyCount(data.loadedKeyCount);
        }
      })
      .catch(() => {
        // Fallback to minimal status if API fails
        setProviderStatus(null);
      });
    fetchGeminiQuotaStatus();
  }, [fetchGeminiQuotaStatus]);

  const handleReloadEnvFromDisk = async () => {
    try {
      const res = await fetch('/api/config/reload-env', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data.providers);
        setLoadedKeyCount(data.loadedKeyCount || 0);
        fetchGeminiQuotaStatus();
        if (data.hasDotEnvFile) {
          showNotification(
            'success',
            `Reloaded .env from workspace (${data.loadedKeyCount || 0} keys active)`
          );
        } else {
          showNotification(
            'success',
            `Synced runtime environment (${data.loadedKeyCount || 0} active keys). Click "Upload .env" to attach a local .env file.`
          );
        }
      }
    } catch {
      showNotification('error', 'Failed to reload .env configuration');
    }
  };

  const extractPatFromEnvText = (envText: string): string => {
    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]+$/.test(line)) {
        return line;
      }
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim().replace(/^export\s+/, '');
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '').trim();
        if (
          /^(GITHUB_TOKEN|GITHUB_PERSONAL_ACCESS_TOKEN|GITHUB_PAT|GH_TOKEN|PAT)$/i.test(key) &&
          val &&
          !/^(fake|dummy|your_)/i.test(val)
        ) {
          return val;
        }
        if (/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]+$/.test(val)) {
          return val;
        }
      }
    }
    return '';
  };

  const handlePushProjectViaPat = async (overrideToken?: string) => {
    setIsPushingPat(true);
    try {
      // First reload .env on server in case it was updated
      await fetch('/api/config/reload-env', { method: 'POST' }).catch(() => {});

      const storedBackupEnv = localStorage.getItem('crewai_saved_dotenv_backup') || '';
      const patFromBackup = extractPatFromEnvText(storedBackupEnv);
      const clientToken =
        overrideToken ||
        localStorage.getItem('crewai_github_token') ||
        patFromBackup ||
        '';

      const safeCrewSlug = (crew.name || 'custom_crew')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'custom_crew';

      const targetPath = `crews/${safeCrewSlug}/crew.jsonc`;
      const [owner, repo] = (selectedRepo || 'bingkltech/crewAI').split('/');

      const exportSpec = JSON.stringify(
        {
          name: crew.name,
          process: crew.process,
          focusTopic: runInput,
          agents: crew.agents,
          tasks: crew.tasks,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      );

      const res = await fetch('/api/github/push-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientToken ? { Authorization: `Bearer ${clientToken}` } : {})
        },
        body: JSON.stringify({
          token: clientToken || undefined,
          repo: `${owner || 'bingkltech'}/${repo || 'crewAI'}`,
          branch: selectedBranch || 'main',
          message: `feat(app): push full CrewAI Studio app & ${crew.name} configuration`,
          extraFiles: [
            {
              path: targetPath,
              content: exportSpec
            }
          ]
        })
      });

      const result = await res.json();
      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
          pendingPushAfterEnvRef.current = true;
          showNotification(
            'error',
            'Your previous .env file was deleted from disk. Please select your .env file in the file picker that just opened to auto-push with your PAT!'
          );
          envFileInputRef.current?.click();
          return;
        }
        throw new Error(result.error || `GitHub push failed (${res.status})`);
      }

      const commitSha = result.shortSha || result.commitSha?.substring(0, 7) || 'latest';
      const targetRepoName = result.repo || selectedRepo;
      const targetBranchName = result.branch || selectedBranch;
      showNotification(
        'success',
        `Pushed entire app (${result.filesPushed || 48} files + ${targetPath}) to ${targetRepoName}@${targetBranchName} via PAT! (Commit ${commitSha})`
      );
    } catch (err: any) {
      showNotification('error', `GitHub PAT Push: ${err.message || 'Could not push to repository'}`);
    } finally {
      setIsPushingPat(false);
    }
  };

  const handleUploadEnvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const text = await file.text();
    try {
      localStorage.setItem('crewai_saved_dotenv_backup', text);
      const detectedPat = extractPatFromEnvText(text);
      if (detectedPat) {
        localStorage.setItem('crewai_github_token', detectedPat);
        window.dispatchEvent(new Event('github-pat-updated'));
      }

      const res = await fetch('/api/config/upload-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envContent: text })
      });
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data.providers);
        setLoadedKeyCount(data.loadedKeyCount || 0);
        fetchGeminiQuotaStatus();
        showNotification(
          'success',
          `Loaded & persisted "${file.name}" (${data.loadedKeyCount || 0} keys active${detectedPat ? ' • GitHub PAT Ready' : ''})`
        );
        if (pendingPushAfterEnvRef.current) {
          pendingPushAfterEnvRef.current = false;
          await handlePushProjectViaPat(detectedPat || undefined);
        }
      } else {
        showNotification('error', 'Failed to save .env file');
      }
    } catch {
      showNotification('error', 'Error uploading .env file');
    }
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const endHeavyImport = globalTaskThrottler.beginHeavyOperation('import-project', 'Importing Local Project');
    try {
      // Resource Guard: Skip heavy directories (node_modules, .git, .venv, dist, build) & cap to 300 files so browser never freezes
      const IGNORED_PATH_REGEX = /(^|\/)(node_modules|\.git|\.venv|venv|dist|build|\.next|__pycache__|coverage|target)\//i;
      const fileList: File[] = [];
      for (let i = 0; i < files.length && fileList.length < 300; i++) {
        if (i > 0 && i % 75 === 0) {
          await globalTaskThrottler.yieldToMain();
        }
        const f = files[i];
        const rel = (f as any)?.webkitRelativePath || f.name || '';
        if (!IGNORED_PATH_REGEX.test(rel)) {
          fileList.push(f);
        }
      }
      e.target.value = '';

    if (fileList.length === 0) {
      showNotification('error', 'No source files found outside ignored build/dependency directories.');
      return;
    }

    // 1. Look for JSON / JSONC workflow or crew configuration files (under 512KB)
    const jsonCandidate = fileList.find(
      (f) =>
        f.size < 512 * 1024 &&
        (f.name === 'crew.json' ||
          f.name === 'crew.jsonc' ||
          f.name.endsWith('_workflow.json') ||
          (f.name.endsWith('.json') &&
            f.name !== 'package.json' &&
            f.name !== 'package-lock.json' &&
            f.name !== 'tsconfig.json'))
    );

    if (jsonCandidate) {
      try {
        const rawText = await jsonCandidate.text();
        const stripped = rawText.replace(/^\s*\/\/.*$/gm, '');
        const parsed = JSON.parse(stripped);
        const targetCrew = parsed.crew || parsed;
        if (Array.isArray(targetCrew.agents) && Array.isArray(targetCrew.tasks)) {
          setCrew({
            name: targetCrew.name || 'Imported Project Crew',
            process: targetCrew.process === 'hierarchical' ? 'hierarchical' : 'sequential',
            verbose: targetCrew.verbose !== false,
            memory: targetCrew.memory !== false,
            managerModel: targetCrew.managerModel,
            agents: targetCrew.agents,
            tasks: targetCrew.tasks
          });
          setActivePreset('custom');
          if (targetCrew.agents[0]?.id) setSelectedAgentId(targetCrew.agents[0].id);
          showNotification('success', `Imported project "${targetCrew.name || jsonCandidate.name}"! Follow Step 2 below.`);
          if (isGuideMode) handleSelectGuideStep(2);
          return;
        }
      } catch {
        // Fall through to folder structure inspection
      }
    }

    // 2. Validate general project folder (Python/YAML/TypeScript project) and synthesize a Crew focused on it
    const firstRelativePath = (fileList[0] as any)?.webkitRelativePath || fileList[0]?.name || 'ImportedProject';
    const folderName = firstRelativePath.split('/')[0] || 'Local Project';
    const hasValidProjectFiles = fileList.some((f) =>
      /\.(py|yaml|yml|json|jsonc|ts|tsx|md|toml)$/i.test(f.name)
    );

    if (!hasValidProjectFiles) {
      showNotification(
        'error',
        'Invalid project directory: No crew.json, Python (.py), YAML (.yaml), or code files found.'
      );
      return;
    }

    const sampleFiles = fileList
      .slice(0, 6)
      .map((f) => f.name)
      .join(', ');

    const synthesizedCrew: CrewConfig = {
      name: `${folderName} Autonomous Crew`,
      process: 'sequential',
      verbose: true,
      memory: true,
      agents: [
        {
          id: 'agent-proj-1',
          name: `${folderName} Lead Architect`,
          role: 'Repository & Architecture Analyst',
          goal: `Analyze ${folderName} files (${sampleFiles}) and plan autonomous improvements`,
          backstory: `Senior architect specialized in understanding and evolving the ${folderName} codebase.`,
          model: 'gemini/gemini-3-flash-preview',
          tools: ['FileReadTool', 'SerperDevTool'],
          verbose: true,
          memory: true,
          maxIter: 10,
          allowDelegation: true
        },
        {
          id: 'agent-proj-2',
          name: `${folderName} Autonomous Engineer`,
          role: 'Senior Software & Test Engineer',
          goal: `Implement features, fix bugs, and verify tests for ${folderName}`,
          backstory: 'Autonomous developer who writes clean patches and validates them in Google Jules VM.',
          model: 'gemini/gemini-3-flash-preview',
          tools: ['CodeInterpreterTool', 'FileWriteTool'],
          verbose: true,
          memory: true,
          maxIter: 12,
          allowDelegation: false
        }
      ],
      tasks: [
        {
          id: 'task-proj-1',
          name: `Audit ${folderName} Structure`,
          description: `Inspect imported project files (${sampleFiles}) and identify high-priority enhancements.`,
          expectedOutput: 'Architectural roadmap and actionable file-by-file checklist.',
          agentId: 'agent-proj-1',
          outputFormat: 'markdown'
        },
        {
          id: 'task-proj-2',
          name: `Implement & Test Changes`,
          description: `Execute the planned improvements for ${folderName} and run automated verification.`,
          expectedOutput: 'Verified code diff and passing test suite report.',
          agentId: 'agent-proj-2',
          outputFormat: 'markdown'
        }
      ]
    };

      setCrew(synthesizedCrew);
      setActivePreset('custom');
      setSelectedAgentId(synthesizedCrew.agents[0].id);
      setRunInput(`Autonomous enhancement and bug-fix pass for ${folderName} (${fileList.length} files loaded)`);
      showNotification(
        'success',
        `Loaded project folder "${folderName}" (${fileList.length} files)! Now follow Step 2 below.`
      );
      if (isGuideMode) handleSelectGuideStep(2);
    } finally {
      endHeavyImport();
    }
  };

  const handleStrategyChange = async (newStrategy: GeminiBudgetStrategy) => {
    setGeminiStrategy(newStrategy);
    localStorage.setItem('crewai_gemini_strategy', newStrategy);
    try {
      const res = await fetch('/api/gemini/smart-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedModel: currentAgent?.model || 'gemini/gemini-3.8-flash',
          agentRole: currentAgent?.role || 'Specialist',
          strategy: newStrategy,
          argonBudgetCapTokens: argonBudgetCap,
          estimatedTokens: 0
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.quotaStatus) setGeminiQuota(data.quotaStatus);
      }
    } catch {
      // ignore
    }
  };

  const handleSimulateSlotRotation = async () => {
    try {
      const res = await fetch('/api/gemini/smart-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedModel: currentAgent?.model || 'gemini/gemini-4-argon',
          agentRole: currentAgent?.role || 'Architect',
          strategy: geminiStrategy,
          argonBudgetCapTokens: argonBudgetCap,
          estimatedTokens: 1250
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.quotaStatus) setGeminiQuota(data.quotaStatus);
        if (data.decision) {
          showNotification('success', `${data.decision.reason}`);
        }
      }
    } catch {
      showNotification('error', 'Could not reach quota governor endpoint');
    }
  };

  const handleResetGeminiQuota = async () => {
    try {
      const res = await fetch('/api/gemini/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: geminiStrategy,
          argonBudgetCapTokens: argonBudgetCap
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeminiQuota(data);
        showNotification('success', 'Reset Gemini session RPM/TPM counters & Argon token budget');
      }
    } catch {
      // ignore
    }
  };

  // Close history modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryOpen]);

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setExecutionHistory([]);
    setSelectedHistoryRunId(null);
    showNotification('success', 'Cleared execution run history');
  };

  const handleDeleteRun = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExecutionHistory((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to update execution history in localStorage', err);
      }
      return updated;
    });
    if (selectedHistoryRunId === id) {
      setSelectedHistoryRunId(null);
    }
    showNotification('success', 'Removed execution run from history');
  };

  const handleLoadRunLogs = (run: ExecutionRunRecord) => {
    setLogs(run.logs);
    setRunInput(run.inputTopic);
    setIsHistoryOpen(false);
    showNotification('success', `Loaded ${run.logs.length} logs from run "${run.crewName}" into simulator`);
  };

  const handleExportHistory = () => {
    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalRuns: executionHistory.length,
        runs: executionHistory
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crewai_execution_history_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Exported ${executionHistory.length} run records to JSON`);
    } catch (e: any) {
      showNotification('error', `Failed to export execution history: ${e.message}`);
    }
  };

  const handleCopyRunLogs = (run: ExecutionRunRecord) => {
    try {
      const formatted = run.logs
        .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.title}\n${l.content}${l.meta ? `\nMeta: ${JSON.stringify(l.meta)}` : ''}`)
        .join('\n\n---\n\n');
      navigator.clipboard.writeText(formatted);
      setCopiedHistoryId(run.id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
      showNotification('success', 'Copied execution run logs to clipboard');
    } catch {
      showNotification('error', 'Failed to copy run logs');
    }
  };

  // Core Save to LocalStorage Function (Deduplicated so unchanged state never writes to disk or re-renders)
  const lastSavedSnapshotRef = useRef<string>('');
  const performSave = useCallback((force = false) => {
    try {
      const stateKey = JSON.stringify({ activePreset, crew, selectedAgentId, runInput });
      if (!force && stateKey === lastSavedSnapshotRef.current) {
        return;
      }
      lastSavedSnapshotRef.current = stateKey;
      const payload: SavedWorkflowState = {
        activePreset,
        crew,
        selectedAgentId,
        runInput,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(
        new CustomEvent('crewai:workflow-synced', {
          detail: { ...payload, source: 'crew_studio' }
        })
      );
      setLastSaved(new Date().toLocaleTimeString());
      setSaveStatus('saved');
    } catch (e) {
      console.error('Failed to auto-save workflow to localStorage', e);
      setSaveStatus('idle');
    }
  }, [activePreset, crew, selectedAgentId, runInput]);

  // Listen to external workflow sync events (e.g. from UnifiedGraphAlignmentBar or LangGraph)
  useEffect(() => {
    const handleExternalSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.source === 'crew_studio') return;
      if (detail.crew && Array.isArray(detail.crew.agents)) {
        setActivePreset(detail.activePreset || 'full_stack_app');
        setCrew(detail.crew);
        if (detail.selectedAgentId) setSelectedAgentId(detail.selectedAgentId);
        if (detail.runInput) setRunInput(detail.runInput);
      }
    };
    window.addEventListener('crewai:workflow-synced', handleExternalSync);
    return () => window.removeEventListener('crewai:workflow-synced', handleExternalSync);
  }, []);

  // Debounced Auto-Save on any workflow changes (1.2 seconds after last edit)
  useEffect(() => {
    const timer = setTimeout(() => {
      performSave(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [performSave]);

  // Immediate Save on Window/Tab Close or Refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const payload: SavedWorkflowState = {
          activePreset,
          crew,
          selectedAgentId,
          runInput,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activePreset, crew, selectedAgentId, runInput]);

  const handleSelectPreset = (key: string) => {
    setActivePreset(key);
    const preset = PRESET_CREWS[key];
    if (preset) {
      setCrew(preset);
      setSelectedAgentId(preset.agents[0]?.id || '');
      setLogs([]);
      const nextInput =
        key === 'full_stack_app'
          ? 'Build an Enterprise SaaS Operations & Telemetry Platform with Beautiful Bento Dashboard, RBAC Auth, PostgreSQL & CI/CD'
          : runInput;
      if (key === 'full_stack_app') {
        setRunInput(nextInput);
      }
      try {
        const payload: SavedWorkflowState = {
          activePreset: key,
          crew: preset,
          selectedAgentId: preset.agents[0]?.id || '',
          runInput: nextInput,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent('crewai:workflow-synced', {
            detail: { ...payload, source: 'crew_studio' }
          })
        );
        setLastSaved(new Date().toLocaleTimeString());
        setSaveStatus('saved');
      } catch {
        // ignore
      }
    }
  };

  const handleClearSavedWorkflow = () => {
    try {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
      const defaultPreset = PRESET_CREWS[activePreset] || PRESET_CREWS.full_stack_app;
      setCrew(defaultPreset);
      setSelectedAgentId(defaultPreset.agents[0]?.id || '');
      setLogs([]);
      setLastSaved(null);
      setSaveStatus('idle');
      setShowResetConfirm(false);
    } catch {
      // ignore
    }
  };

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Export current agent workflow state to a JSON file
  const handleExportJson = () => {
    try {
      const exportData = {
        version: '1.0',
        generator: 'CrewAI Studio',
        exportedAt: new Date().toISOString(),
        activePreset,
        crew,
        selectedAgentId,
        runInput
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (crew.name || 'crew_workflow').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      a.href = url;
      a.download = `${safeName}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification('success', `Exported "${crew.name}" to JSON file`);
    } catch (e: any) {
      console.error('Export error:', e);
      showNotification('error', `Failed to export workflow: ${e.message}`);
    }
  };

  // Download Self-Extracting Full-Stack Windows standalone.bat via Blob (works inside sandboxed iframes)
  const handleDownloadStandaloneBat = async () => {
    try {
      showNotification('success', 'Building self-extracting standalone.bat (Frontend + Backend + .env)...');
      const res = await fetch('/api/standalone/bat?includeEnv=1');
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const batText = await res.text();
      const blob = new Blob([batText], { type: 'application/x-bat;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'standalone.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(
        'success',
        'Downloaded standalone.bat! Double-click it in any folder on Windows to unpack & launch the full app on http://localhost:3000.'
      );
    } catch (err: any) {
      console.error('standalone.bat download error:', err);
      showNotification('error', `Failed to download standalone.bat: ${err.message || 'Unknown error'}`);
    }
  };

  // Trigger file input dialog
  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Import JSON file and replace current workflow state
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let importedCrew: CrewConfig | null = null;
        let importedPreset = 'custom';
        let importedRunInput = runInput;
        let importedSelectedAgentId = '';

        // Case A: Full Workflow State export ({ crew: { ... }, activePreset, runInput })
        if (parsed.crew && Array.isArray(parsed.crew.agents) && Array.isArray(parsed.crew.tasks)) {
          importedCrew = parsed.crew;
          if (parsed.activePreset) importedPreset = parsed.activePreset;
          if (parsed.runInput) importedRunInput = parsed.runInput;
          if (parsed.selectedAgentId) importedSelectedAgentId = parsed.selectedAgentId;
        }
        // Case B: Direct CrewConfig / JSONC specification ({ agents: [...], tasks: [...] })
        else if (parsed.agents && Array.isArray(parsed.agents) && parsed.tasks && Array.isArray(parsed.tasks)) {
          importedCrew = {
            name: parsed.name || 'Imported Crew',
            process: parsed.process === 'hierarchical' ? 'hierarchical' : 'sequential',
            verbose: parsed.verbose !== false,
            memory: parsed.memory !== false,
            managerModel: parsed.managerModel,
            agents: parsed.agents.map((a: any, idx: number) => ({
              id: a.id || `agent-${idx + 1}`,
              name: a.name || a.role || `Agent ${idx + 1}`,
              role: a.role || 'Autonomous Specialist',
              goal: a.goal || 'Complete assigned objectives',
              backstory: a.backstory || 'Experienced researcher and analyst.',
              model: a.model || 'gemini/gemini-2.5-flash',
              tools: Array.isArray(a.tools) ? a.tools : ['SerperDevTool'],
              verbose: a.settings?.verbose ?? a.verbose ?? true,
              memory: a.settings?.memory ?? a.memory ?? true,
              maxIter: a.settings?.max_iter ?? a.maxIter ?? 10,
              allowDelegation: a.allowDelegation ?? false
            })),
            tasks: parsed.tasks.map((t: any, idx: number) => ({
              id: t.id || `task-${idx + 1}`,
              name: t.name || `Task ${idx + 1}`,
              description: t.description || 'Perform autonomous analysis',
              expectedOutput: t.expected_output || t.expectedOutput || 'Structured report',
              agentId: t.agent || t.agentId || '',
              outputFormat: t.output_format || t.outputFormat || 'markdown'
            }))
          };
        }

        if (!importedCrew) {
          throw new Error('Invalid JSON format: missing valid agents and tasks definitions.');
        }

        const validCrew: CrewConfig = importedCrew;

        if (!validCrew.agents || validCrew.agents.length === 0) {
          throw new Error('Imported workflow must have at least one agent.');
        }

        // Validate task agent references
        const validAgentIds = new Set(validCrew.agents.map((a) => a.id));
        validCrew.tasks = validCrew.tasks.map((task) => {
          if (!validAgentIds.has(task.agentId)) {
            return { ...task, agentId: validCrew.agents[0].id };
          }
          return task;
        });

        // Apply imported state
        setCrew(validCrew);
        setActivePreset(importedPreset);
        setRunInput(importedRunInput);
        setSelectedAgentId(importedSelectedAgentId || validCrew.agents[0].id);
        setLogs([]);

        // Save immediately to localStorage
        const savePayload: SavedWorkflowState = {
          activePreset: importedPreset,
          crew: validCrew,
          selectedAgentId: importedSelectedAgentId || validCrew.agents[0].id,
          runInput: importedRunInput,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(savePayload));
        setLastSaved(new Date().toLocaleTimeString());
        setSaveStatus('saved');

        showNotification('success', `Imported "${validCrew.name}" (${validCrew.agents.length} agents, ${validCrew.tasks.length} tasks)`);
      } catch (err: any) {
        console.error('Import error:', err);
        showNotification('error', `Failed to import workflow: ${err.message || 'Malformed JSON file'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateAgent = (id: string, updates: Partial<AgentConfig>) => {
    setCrew((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.id === id ? { ...a, ...updates } : a))
    }));
  };

  const handleAddAgent = () => {
    const newId = `agent-${Date.now()}`;
    const newAgent: AgentConfig = {
      id: newId,
      name: `Agent ${crew.agents.length + 1}`,
      role: 'Autonomous Specialist',
      goal: 'Achieve assigned domain objectives with high accuracy',
      backstory: 'An expert with deep industry knowledge and analytical capability.',
      model: 'gemini/gemini-2.5-flash',
      tools: ['SerperDevTool'],
      verbose: true,
      memory: true,
      maxIter: 10,
      allowDelegation: false
    };
    setCrew((prev) => ({
      ...prev,
      agents: [...prev.agents, newAgent]
    }));
    setSelectedAgentId(newId);
  };

  const handleDeleteAgent = (id: string) => {
    if (crew.agents.length <= 1) return;
    setCrew((prev) => ({
      ...prev,
      agents: prev.agents.filter((a) => a.id !== id),
      tasks: prev.tasks.map((t) => (t.agentId === id ? { ...t, agentId: prev.agents[0].id } : t))
    }));
    if (selectedAgentId === id) {
      setSelectedAgentId(crew.agents.find((a) => a.id !== id)?.id || '');
    }
  };

  const handleAddTask = () => {
    const newId = `task-${Date.now()}`;
    const newTask: TaskConfig = {
      id: newId,
      name: `Task ${crew.tasks.length + 1}`,
      description: 'Describe what this agent needs to execute.',
      expectedOutput: 'Detailed, actionable deliverables.',
      agentId: crew.agents[0]?.id || '',
      outputFormat: 'markdown'
    };
    setCrew((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));
  };

  const handleDeleteTask = (id: string) => {
    if (crew.tasks.length <= 1) return;
    setCrew((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id)
    }));
  };

  const currentAgent = crew.agents.find((a) => a.id === selectedAgentId) || crew.agents[0];

  // Simulator Kickoff Run (Executes the 4-stage Orchestrator -> Crew -> Jules -> GitHub PR cycle)
  const handleKickoff = async () => {
    const endHeavyKickoff = globalTaskThrottler.beginHeavyOperation('crew-kickoff', 'Autonomous Crew Execution');
    const runStartTime = Date.now();
    setIsRunning(true);
    setActiveCycleStage('orchestrator');
    setLiveProgressPct(5);
    setExecElapsedMs(0);
    setLogs([]);
    const runLogsAccumulator: ExecutionLog[] = [];
    const runTraceId = `tr-${Math.random().toString(16).slice(2, 6)}`;
    let spanCounter = 1;

    // Initialize per-task live execution state
    const initialTasksMap: Record<string, LiveTaskExecutionItem> = {};
    crew.tasks.forEach((t, idx) => {
      const assignedAgent =
        crew.agents.find((a) => a.id === t.agentId) || crew.agents[idx % Math.max(1, crew.agents.length)];
      const ctrlAgent = t.controllerAgentId
        ? crew.agents.find((a) => a.id === t.controllerAgentId)
        : crew.agents.find((a) => a.category === 'task_controller');
      initialTasksMap[t.id] = {
        taskId: t.id,
        taskName: t.name,
        phase: t.phase,
        agentId: assignedAgent?.id || '',
        agentName: assignedAgent?.name || `Agent ${idx + 1}`,
        agentRole: assignedAgent?.role || 'Specialist',
        controllerAgentId: ctrlAgent?.id,
        controllerAgentName: ctrlAgent?.name,
        status: 'queued',
        progressPct: 0,
        durationMs: 0,
        tokensUsed: 0,
        activeTool: assignedAgent?.tools?.[0] || 'SerperDevTool'
      };
    });
    setTaskExecutions(initialTasksMap);
    setActiveExecTaskId(crew.tasks[0]?.id || null);
    setActiveExecAgentId(crew.agents[0]?.id || null);

    const syncProgressToServer = (
      progressPct: number,
      stage: AuditCycleStage | 'idle' | 'completed',
      currentTaskId: string | null,
      currentAgentId: string | null,
      tasksSnapshot: Record<string, LiveTaskExecutionItem>,
      running = true
    ) => {
      const elapsed = Date.now() - runStartTime;
      setLiveProgressPct(progressPct);
      setExecElapsedMs(elapsed);
      setActiveExecTaskId(currentTaskId);
      setActiveExecAgentId(currentAgentId);
      const taskArr = Object.values(tasksSnapshot);
      const completedCount = taskArr.filter((item) => item.status === 'completed').length;
      const curTask = taskArr.find((item) => item.taskId === currentTaskId);
      const curAgent = crew.agents.find((a) => a.id === currentAgentId);

      globalTaskThrottler
        .scheduleTask(
          `Sync Progress (${progressPct}%)`,
          async () => {
            await fetch('/api/crew/execution-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                runId: runTraceId,
                crewName: crew.name,
                isRunning: running,
                overallProgressPct: progressPct,
                stage,
                activeTaskId: currentTaskId,
                activeTaskName: curTask?.taskName || null,
                activeAgentId: currentAgentId,
                activeAgentName: curAgent?.name || null,
                completedTasksCount: completedCount,
                totalTasksCount: Math.max(1, taskArr.length),
                elapsedMs: elapsed,
                estimatedRemainingMs: running ? Math.max(200, 4200 - elapsed) : 0,
                tasks: taskArr
              })
            });
          },
          'high'
        )
        .catch(() => {});
    };

    const addLog = (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
      const spanId = `sp-${String(spanCounter++).padStart(2, '0')}`;
      const fullLog: ExecutionLog = {
        stage: 'crew',
        severity: 'info',
        traceId: runTraceId,
        spanId,
        isoTimestamp: new Date().toISOString(),
        ...log,
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      runLogsAccumulator.push(fullLog);
      // Cap in-memory logs to 60 items to prevent unbounded DOM/RAM growth
      setLogs((prev) => [...prev.slice(-59), fullLog]);
    };

    // Resolve model availability & smart Gemini Credit / Argon Quota routing before starting
    const effectiveCrew = { ...crew };
    const routeDecisions: Record<string, { selectedModel: string; keySlotUsed: string; reason: string; tierUsed: string }> = {};

    for (const agent of crew.agents) {
      try {
        const routeRes = await fetch('/api/gemini/smart-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestedModel: agent.model,
            agentRole: agent.role,
            isManager: false,
            strategy: geminiStrategy,
            argonBudgetCapTokens: argonBudgetCap,
            estimatedTokens: 720
          })
        });
        if (routeRes.ok) {
          const data = await routeRes.json();
          if (data.quotaStatus) setGeminiQuota(data.quotaStatus);
          if (data.decision) {
            routeDecisions[agent.id] = data.decision;
          }
        }
      } catch {
        const localDecision = resolveSmartGeminiRoute({
          requestedModel: agent.model,
          agentRole: agent.role,
          strategy: geminiStrategy,
          quotaStatus: geminiQuota,
          providers: providerStatus,
          estimatedTokens: 720
        });
        routeDecisions[agent.id] = localDecision;
      }
    }

    effectiveCrew.agents = crew.agents.map(a => ({
      ...a,
      model: routeDecisions[a.id]?.selectedModel || (providerStatus ? resolveAvailableModel(a.model, providerStatus) : a.model)
    }));

    if (effectiveCrew.managerModel) {
      const mgrDecision = resolveSmartGeminiRoute({
        requestedModel: effectiveCrew.managerModel,
        agentRole: 'Crew Manager',
        isManager: true,
        strategy: geminiStrategy,
        quotaStatus: geminiQuota,
        providers: providerStatus,
        estimatedTokens: 550
      });
      effectiveCrew.managerModel = mgrDecision.selectedModel;
    }

    const firstDecision = routeDecisions[crew.agents[0]?.id];

    // STAGE 1: ORCHESTRATOR
    addLog({
      stage: 'orchestrator',
      severity: 'info',
      agentName: 'Flow Orchestrator',
      type: 'system',
      title: 'Stage 1 [Orchestrator] — Durable Flow Initialized & Quota Routed',
      content: `Starting ${effectiveCrew.name} (${effectiveCrew.process} mode) for topic "${runInput}". ${
        firstDecision
          ? `${firstDecision.reason} | Slot: ${firstDecision.keySlotUsed}`
          : 'Zero-Halt multi-slot rotation active.'
      }`,
      meta: {
        model: effectiveCrew.agents[0]?.model,
        keySlot: firstDecision?.keySlotUsed || 'Primary Slot',
        durationMs: 22
      }
    });

    // Helper to update real-time agent heartbeat indicators
    const setAgentLiveState = (
      agentId: string | undefined,
      status: AgentLiveStatus,
      activity: string,
      latencyOverride?: number
    ) => {
      if (!agentId) return;
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setAgentHeartbeats((prev) => {
        const cur = prev[agentId];
        const lat = latencyOverride ?? (status === 'standby_pulse' ? 21 : 88);
        return {
          ...prev,
          [agentId]: {
            agentId,
            status,
            latencyMs: lat,
            bpm: status === 'standby_pulse' || status === 'completed' ? 32 : 96,
            lastPulse: nowStr,
            currentActivity: activity,
            pulseWave: [...(cur?.pulseWave || [20, 22, 21, 25, 22, 20, 24, 21, 23, 20, 22]).slice(-11), lat],
            uptimePct: '99.99%'
          }
        };
      });
    };

    // STAGE 2: CREW AGENTS & TASK PIPELINE (Synced with Background Process Throttler)
    setActiveCycleStage('crew');
    const totalTasks = Math.max(1, effectiveCrew.tasks.length);
    const stepDelayMs = Math.max(180, Math.round(900 / totalTasks));

    for (let tIdx = 0; tIdx < effectiveCrew.tasks.length; tIdx++) {
      const task = effectiveCrew.tasks[tIdx];
      const execAgent =
        effectiveCrew.agents.find((a) => a.id === task.agentId) ||
        effectiveCrew.agents[tIdx % effectiveCrew.agents.length];
      const ctrlAgent = task.controllerAgentId
        ? effectiveCrew.agents.find((a) => a.id === task.controllerAgentId)
        : effectiveCrew.agents.find((a) => a.category === 'task_controller');
      const decision = routeDecisions[execAgent?.id || ''];

      // Phase A: Reasoning (35% of task)
      const pctStart = Math.round(12 + (tIdx / totalTasks) * 58);
      initialTasksMap[task.id] = {
        ...initialTasksMap[task.id],
        status: 'reasoning',
        progressPct: 38
      };
      setTaskExecutions({ ...initialTasksMap });
      syncProgressToServer(pctStart, 'crew', task.id, execAgent?.id || null, initialTasksMap, true);

      setAgentLiveState(
        execAgent?.id,
        'reasoning',
        `Executing ${task.name} on ${execAgent?.model.replace('gemini/', '')}`,
        88 + (tIdx % 4) * 7
      );

      await globalTaskThrottler.yieldToMain();
      await new Promise((r) => setTimeout(r, stepDelayMs));

      if (tIdx === 0 || tIdx === effectiveCrew.tasks.length - 1 || effectiveCrew.tasks.length <= 3) {
        addLog({
          stage: 'crew',
          severity: 'info',
          agentId: execAgent?.id,
          agentName: execAgent?.name,
          type: 'thought',
          title: `Stage 2 [Crew Task ${tIdx + 1}/${totalTasks}] — ${execAgent?.name}: ${task.name}`,
          content: `Executing "${task.description.slice(0, 120)}..." for topic "${runInput}" with throttled concurrency pacing.`,
          meta: {
            model: execAgent?.model,
            keySlot: decision?.keySlotUsed || 'Primary Slot',
            tokens: 240 + tIdx * 35,
            durationMs: stepDelayMs
          }
        });
      }

      // Phase B: Tool Execution & Controller Gate (78% -> 100% of task)
      const activeToolName = execAgent?.tools[0] || 'SerperDevTool';
      initialTasksMap[task.id] = {
        ...initialTasksMap[task.id],
        status: ctrlAgent ? 'controller_gate' : 'tool_exec',
        progressPct: 82,
        activeTool: activeToolName
      };
      setTaskExecutions({ ...initialTasksMap });
      const pctMid = Math.round(12 + ((tIdx + 0.65) / totalTasks) * 58);
      syncProgressToServer(pctMid, 'crew', task.id, execAgent?.id || null, initialTasksMap, true);

      setAgentLiveState(
        execAgent?.id,
        'tool_exec',
        `Invoking ${activeToolName} • Controller Gate: ${ctrlAgent?.name || 'Auto QA'}`,
        114
      );

      await new Promise((r) => setTimeout(r, stepDelayMs));

      if (tIdx === 0 || tIdx === Math.floor(totalTasks / 2)) {
        addLog({
          stage: 'crew',
          severity: 'success',
          agentId: execAgent?.id,
          agentName: execAgent?.name,
          type: 'tool_call',
          title: `Tool Verified: ${activeToolName} → ${task.name}`,
          content: `Deliverable verified against acceptance criteria${
            ctrlAgent ? ` by ${ctrlAgent.name}` : ''
          }: "${task.expectedOutput.slice(0, 110)}..."`,
          meta: {
            toolName: activeToolName,
            model: execAgent?.model,
            durationMs: stepDelayMs * 2,
            tokens: 195 + tIdx * 25
          }
        });
      }

      // Mark task 100% completed
      initialTasksMap[task.id] = {
        ...initialTasksMap[task.id],
        status: 'completed',
        progressPct: 100,
        durationMs: stepDelayMs * 2,
        tokensUsed: 240 + tIdx * 40
      };
      setTaskExecutions({ ...initialTasksMap });
      setAgentLiveState(execAgent?.id, 'completed', `${task.name} verified • 200 OK`, 23);

      const pctAfterTask = Math.round(12 + ((tIdx + 1) / totalTasks) * 58);
      syncProgressToServer(pctAfterTask, 'crew', task.id, execAgent?.id || null, initialTasksMap, true);
    }

    // STAGE 3 & 4: GOOGLE JULES CLOUD VM + GITHUB PR GATEKEEPER (when fullCycleEnabled is active)
    let prNumberCreated = 850;
    let branchCreated = `jules/auto-${effectiveCrew.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    if (fullCycleEnabled) {
      setActiveCycleStage('jules');
      syncProgressToServer(80, 'jules', null, effectiveCrew.agents[0]?.id || null, initialTasksMap, true);
      effectiveCrew.agents.forEach((a) => {
        setAgentLiveState(
          a.id,
          'self_healing',
          `Jules Cloud VM running pytest + AST self-healing pass`,
          112
        );
      });

      await new Promise((r) => setTimeout(r, 750));
      addLog({
        stage: 'jules',
        severity: 'info',
        agentName: 'Google Jules VM',
        type: 'jules_vm',
        title: 'Stage 3 [Jules VM] — Ephemeral Cloud Sandbox Booted (Warm AST Index Hit)',
        content: `Mounted pre-fetched AST & vector index snapshot for ${selectedRepo} (${selectedBranch}) in 1.08s (saved 17.3s cold-start indexing wait). Started pytest + mypy AST verification on generated Crew artifact.`,
        meta: {
          toolName: 'jules-cloud-vm',
          branch: branchCreated,
          durationMs: 1080
        }
      });

      // Trigger real backend simulation for Jules Autonomy Strategy
      try {
        const simRes = await fetch('/api/jules/autonomy-strategy/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetModule: `crews/${effectiveCrew.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.py`,
            crewName: effectiveCrew.name
          })
        });
        if (simRes.ok) {
          const simData = await simRes.json();
          const latestPr = simData?.state?.coverage?.prTrajectory?.[0]?.pr;
          if (latestPr) {
            const parsedNum = Number(String(latestPr).replace(/\D+/g, ''));
            if (!Number.isNaN(parsedNum) && parsedNum > 0) prNumberCreated = parsedNum;
          }
        }
      } catch {
        // fallback local metrics
      }

      await new Promise((r) => setTimeout(r, 800));
      addLog({
        stage: 'jules',
        severity: 'warn',
        agentName: 'Google Jules VM',
        type: 'jules_heal',
        title: 'Stage 3 [Jules Self-Heal] — Auto-Repaired Edge-Case Assertion & Re-Verified',
        content: `Pass #1 detected a missing fallback guard on LLMMessage.content multimodal list. Jules patched the helper with message_content_text() and re-ran pytest: 44/44 passed (0 warnings).`,
        meta: {
          toolName: 'pytest + ruff + mypy',
          coveragePct: 96.8,
          exitCode: 0,
          durationMs: 1190,
          repairedFault: 'Multimodal content normalization guard'
        }
      });

      // STAGE 4: GITHUB PR GATEKEEPER & AUTONOMOUS PR REVIEW INTERCEPTION
      setActiveCycleStage('github');
      syncProgressToServer(92, 'github', null, effectiveCrew.agents[0]?.id || null, initialTasksMap, true);
      await new Promise((r) => setTimeout(r, 650));
      addLog({
        stage: 'github',
        severity: 'success',
        agentName: 'GitHub PR Gatekeeper',
        type: 'github_pr',
        title: `Stage 4 [GitHub PR] — Opened Verified PR #${prNumberCreated} on ${selectedRepo}`,
        content: `Committed green artifact & new unit tests to branch "${branchCreated}". Opened PR #${prNumberCreated} with 96.8% test coverage badge and notified Flow Orchestrator.`,
        meta: {
          branch: branchCreated,
          prNumber: prNumberCreated,
          prUrl: `https://github.com/${selectedRepo}/pull/${prNumberCreated}`,
          coveragePct: 96.8,
          exitCode: 0,
          durationMs: 340
        }
      });

      emitJulesPrNotification({
        eventType: 'pr_completed',
        prNumber: prNumberCreated,
        prTitle: `feat(crew): autonomous ${effectiveCrew.name} synthesis for "${runInput}"`,
        prUrl: `https://github.com/${selectedRepo}/pull/${prNumberCreated}`,
        repo: selectedRepo,
        branch: branchCreated,
        crewName: effectiveCrew.name,
        coveragePct: '96.8%',
        testsPassed: 44,
        vmTier: 'standard-4core'
      });

      // Automatically intercept the newly created Jules PR in the Autonomous PR Review Module
      try {
        await fetch('/api/jules/pr-reviews/intercept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prNumber: prNumberCreated,
            crewName: effectiveCrew.name,
            branch: branchCreated,
            repo: selectedRepo,
            topic: runInput,
            coveragePct: 96.8
          })
        });
        setLatestInterceptedPr(prNumberCreated);
      } catch {
        // non-blocking
      }

      addLog({
        stage: 'github',
        severity: 'warn',
        agentName: 'Sentinel-Sec & Quality Auditor',
        type: 'github_pr',
        title: `Autonomous PR Review — Intercepted PR #${prNumberCreated} for Secondary Compliance Audit`,
        content: `Secondary review agent audited PR #${prNumberCreated} for SAST security & AGENTS.md compliance. 2 automated revision diffs staged in the Autonomous PR Review module prior to human approval.`,
        meta: {
          branch: branchCreated,
          prNumber: prNumberCreated,
          coveragePct: 96.8,
          model: 'gemini/gemini-4-argon',
          durationMs: 280
        }
      });
    }

    effectiveCrew.agents.forEach((a) => {
      setAgentLiveState(a.id, 'completed', `Cycle verified • PR #${prNumberCreated} 200 OK`, 22);
    });

    addLog({
      stage: 'orchestrator',
      severity: 'success',
      agentName: 'Flow Orchestrator',
      type: 'task_complete',
      title: 'Closed-Loop Cycle Complete (Orchestrator → Crew → Jules → GitHub PR)',
      content: `### Autonomous Deliverable Verified: ${runInput}\n- **Crew Synthesis**: Completed by ${effectiveCrew.agents.length} agents in ${effectiveCrew.process} mode.\n- **Jules Cloud VM**: PyTest + AST suite green (96.8% coverage, 0 unhandled faults).\n- **GitHub Gatekeeper**: Branch \`${branchCreated}\` published via PR #${prNumberCreated}.`,
      meta: {
        tokens: 1420,
        durationMs: 4120,
        branch: branchCreated,
        prNumber: prNumberCreated,
        coveragePct: 96.8,
        exitCode: 0
      }
    });

    // Save completed run to execution history
    const completedRun: ExecutionRunRecord = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isoTime: new Date().toISOString(),
      crewName: crew.name,
      inputTopic: runInput,
      processMode: crew.process,
      agentsCount: crew.agents.length,
      tasksCount: crew.tasks.length,
      status: 'completed',
      durationMs: 4120,
      tokensUsed: 1420,
      logs: runLogsAccumulator.slice(-25),
      summary: `Completed 4-stage loop (${crew.process}): PR #${prNumberCreated} opened (${runLogsAccumulator.length} audit events)`
    };

    setExecutionHistory((prev) => {
      // Bound stored execution history to 10 runs to prevent localStorage bloat
      const updated = [completedRun, ...prev.slice(0, 9)];
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        // If quota exceeded, keep only the 3 most recent runs
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated.slice(0, 3)));
        } catch {
          // ignore
        }
      }
      return updated;
    });

    setIsRunning(false);
    endHeavyKickoff();
    setActiveCycleStage('completed');
    syncProgressToServer(100, 'completed', null, null, initialTasksMap, false);
    if (autonomousDaemon) {
      setDaemonCycles((c) => c + 1);
    }

    // Return agents to live standby pulse after brief completion highlight
    setTimeout(() => {
      effectiveCrew.agents.forEach((a) => {
        setAgentLiveState(
          a.id,
          'standby_pulse',
          `Heartbeat 200 OK • Ready on ${a.model.replace('gemini/', '')}`,
          19
        );
      });
    }, 2800);
  };

  // 24/7 Autonomous Daemon Loop Countdown
  useEffect(() => {
    if (!autonomousDaemon) {
      setDaemonCountdown(20);
      return;
    }
    const timer = setInterval(() => {
      if (isRunning) return;
      setDaemonCountdown((prev) => {
        if (prev <= 1) {
          handleKickoff();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autonomousDaemon, isRunning]);

  // Generate Python Code
  const generatePythonCode = () => {
    const governorNote = `
# --- Gemini Credit & Argon Quota Governor (${geminiStrategy}) ---
import os
from itertools import cycle
from crewai import LLM

GEMINI_KEY_POOL = [
    k for k in [
        os.getenv("GEMINI_API_KEY"),
        os.getenv("GEMINI_API_KEY_0"),
        os.getenv("GEMINI_API_KEY_1"),
        os.getenv("GEMINI_API_KEY_2"),
        os.getenv("GEMINI_API_KEY_3"),
    ] if k
]
_key_cycle = cycle(GEMINI_KEY_POOL or ["YOUR_GEMINI_KEY"])

def get_managed_llm(preferred_model="gemini/gemini-3.8-flash", role="specialist", strategy="${geminiStrategy}"):
    """Rotates Gemini API keys and balances Free-Tier Flash vs Paid gemini-4-argon so jobs never hit 429 limits."""
    next_key = next(_key_cycle)
    if strategy == "free_tier_guard":
        model = "gemini/gemini-3.8-flash" if preferred_model == "gemini/gemini-4-argon" else preferred_model
    elif strategy == "hybrid_auto":
        is_complex = any(w in role.lower() for w in ["architect", "audit", "security", "manager", "lead"])
        model = "gemini/gemini-4-argon" if is_complex else "gemini/gemini-3.8-flash"
    else:
        model = preferred_model
    return LLM(model=model, api_key=next_key, temperature=0.2)
`;

    return `from crewai import Agent, Task, Crew, Process
from crewai.utilities.agent_utils import message_content_text
from crewai_tools import ${Array.from(new Set(crew.agents.flatMap((a) => a.tools))).join(', ') || 'SerperDevTool'}
${governorNote}
# --- Agents Setup (Task Makers, Task Controllers & Domain Specialists) ---
${crew.agents
  .map((a) => {
    const dutiesComment =
      a.duties && a.duties.length > 0
        ? `\n    # Core Duties:\n${a.duties.map((d) => `    # - ${d}`).join('\n')}`
        : '';
    return `${a.id.replace(/-/g, '_')} = Agent(${dutiesComment}
    role="${a.role}",
    goal="${a.goal}",
    backstory="""${a.backstory}""",
    llm=get_managed_llm("${a.model}", "${a.role}"),
    tools=[${a.tools.map((t) => `${t}()`).join(', ')}],
    allow_delegation=${a.allowDelegation ? 'True' : 'False'},
    verbose=${a.verbose ? 'True' : 'False'},
    memory=${a.memory ? 'True' : 'False'},
    max_iter=${a.maxIter || 10}
)`;
  })
  .join('\n\n')}

# --- Tasks Setup (Controlled Pipeline, Dependency DAG & Acceptance Gates) ---
${crew.tasks
  .map((t, idx) => {
    const phaseNote = t.phase ? `    # ${t.phase}${t.controllerAgentId ? ` | Controlled by: ${t.controllerAgentId}` : ''}\n` : '';
    const validIds = new Set(crew.tasks.slice(0, idx).map((prev) => prev.id));
    const depVars = (t.dependsOnTaskIds || [])
      .filter((dId) => validIds.has(dId))
      .map((dId) => dId.replace(/-/g, '_'));
    const contextLine = depVars.length > 0 ? `,\n    context=[${depVars.join(', ')}]` : '';
    return `${t.id.replace(/-/g, '_')} = Task(\n${phaseNote}    description="""${t.description}""",
    expected_output="""${t.expectedOutput}""",
    agent=${t.agentId.replace(/-/g, '_')}${contextLine}
)`;
  })
  .join('\n\n')}

# --- Crew Orchestration ---
crew = Crew(
    agents=[${crew.agents.map((a) => a.id.replace(/-/g, '_')).join(', ')}],
    tasks=[${crew.tasks.map((t) => t.id.replace(/-/g, '_')).join(', ')}],
    process=Process.${crew.process},
    verbose=${crew.verbose ? 'True' : 'False'},
    memory=${crew.memory ? 'True' : 'False'}
)

if __name__ == "__main__":
    result = crew.kickoff(inputs={"topic": "${runInput}"})
    # AGENTS.md Compliance: Never str() LLMMessage.content directly; collapse via message_content_text
    print(message_content_text(result.raw))
`;
  };

  // Generate Modern JSONC
  const generateJsonc = () => {
    const data = {
      name: crew.name,
      process: crew.process,
      manager_model: crew.managerModel,
      agents: crew.agents.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category || 'general',
        role: a.role,
        goal: a.goal,
        backstory: a.backstory,
        duties: a.duties || [],
        tools: a.tools,
        settings: {
          verbose: a.verbose,
          memory: a.memory,
          max_iter: a.maxIter,
          allow_delegation: a.allowDelegation
        }
      })),
      tasks: crew.tasks.map((t, idx) => ({
        id: t.id,
        sequence_order: idx + 1,
        name: t.name,
        phase: t.phase,
        description: t.description,
        expected_output: t.expectedOutput,
        agent: t.agentId,
        controller_agent: t.controllerAgentId,
        depends_on: t.dependsOnTaskIds || (idx > 0 ? [crew.tasks[idx - 1].id] : []),
        output_format: t.outputFormat
      }))
    };
    return JSON.stringify(data, null, 2);
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const selectedHistoryRun = executionHistory.find((r) => r.id === selectedHistoryRunId) || null;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Crew Studio Playground
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Build, test, simulate, and export production-ready Multi-Agent Crews with live execution telemetry.
          </p>
        </div>

        {/* Preset Selector & Auto-save Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Interactive Target Repository Selector (Dictates Assigned Crew & Agents) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EB6658]/10 border border-[#EB6658]/30 text-xs font-mono">
            <GitBranch className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />
            <span className="text-slate-300 font-sans font-semibold text-[11px]">Target Repo:</span>
            <select
              aria-label="Select Target GitHub Repository"
              value={
                CURATED_TARGET_REPOS.some((r) => r.displayRepo === selectedRepo)
                  ? selectedRepo
                  : '__custom__'
              }
              onChange={(e) => {
                const nextRepo = e.target.value;
                if (nextRepo === '__custom__') {
                  if (onNavigateToGitHub) onNavigateToGitHub();
                  return;
                }
                if (onRepoChange) onRepoChange(nextRepo);
                const profile = resolveRepoWorkforceProfile(nextRepo);
                if (onBranchChange && profile.defaultBranch) {
                  onBranchChange(profile.defaultBranch);
                }
                if (autoSyncRepoCrew && PRESET_CREWS[profile.presetKey]) {
                  handleSelectPreset(profile.presetKey);
                  setRunInput(profile.recommendedTopic);
                  showNotification(
                    'success',
                    `Target Repo "${nextRepo}" selected → Assigned ${profile.crewName} (Task Maker: ${profile.taskMaker.name}, Controller: ${profile.taskController.name})`
                  );
                }
              }}
              className="bg-slate-950 text-[#EB6658] font-bold text-xs px-2 py-0.5 rounded border border-slate-800 outline-none focus:border-[#EB6658] cursor-pointer"
            >
              {CURATED_TARGET_REPOS.map((item) => (
                <option key={item.displayRepo} value={item.displayRepo} className="text-slate-200 font-mono">
                  {item.displayRepo} ({item.presetKey.replace(/_/g, ' ')})
                </option>
              ))}
              {!CURATED_TARGET_REPOS.some((r) => r.displayRepo === selectedRepo) && (
                <option value="__custom__" className="text-slate-200 font-mono">
                  {selectedRepo} (Custom)
                </option>
              )}
              <option value="__custom__" className="text-amber-300 font-sans">
                + Manage / Custom Repo in GitHub Hub...
              </option>
            </select>
            <span className="text-slate-500">@</span>
            <span className="text-slate-300">{selectedBranch}</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Auto-Save Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
            {saveStatus === 'saving' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400">Saving workflow...</span>
              </>
            ) : saveStatus === 'saved' && lastSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">
                  Auto-saved <span className="text-slate-500 font-sans text-[11px]">({lastSaved})</span>
                </span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400">Auto-save active</span>
              </>
            )}
          </div>

          {/* Quick Manual Save Button */}
          <button
            onClick={() => performSave(true)}
            title="Force immediate save to localStorage"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition"
          >
            <Save className="w-3.5 h-3.5 text-[#EB6658]" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Reset Saved State to Default (with non-blocking inline toggle) */}
          {showResetConfirm ? (
            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 p-1 rounded-xl text-xs">
              <span className="text-red-400 text-[11px] px-1 font-medium">Reset all edits?</span>
              <button
                onClick={handleClearSavedWorkflow}
                className="px-2 py-0.5 rounded bg-red-500 text-white font-bold hover:bg-red-600 transition"
              >
                Yes
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              title="Reset workflow to original preset"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition px-1"
            >
              Reset
            </button>
          )}

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Hidden File Input for Workflow Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {/* Hidden Folder/Project Input */}
          <input
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            // @ts-ignore
            directory="true"
            multiple
            onChange={handleImportProject}
            className="hidden"
            id="project-import-input"
          />

          {/* Import Project Directory Button */}
          <label
            htmlFor="project-import-input"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Import Project</span>
          </label>

          {/* Import JSON Button */}
          <button
            onClick={handleTriggerImport}
            title="Import workflow from a JSON file"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Import JSON</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={handleExportJson}
            title="Export workflow to a JSON file"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          {/* Download Self-Extracting Full-Stack Windows standalone.bat */}
          <button
            type="button"
            onClick={handleDownloadStandaloneBat}
            title="Download self-extracting standalone.bat containing the complete identical Frontend (src/**) + Backend (server.ts) + .env configuration"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">standalone.bat (Full App)</span>
          </button>

          {/* Execution History Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            title="View previous agent workflow runs and logs"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition shadow-sm"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-amber-400 font-mono font-bold">
              {executionHistory.length}
            </span>
          </button>

          {/* Live Gmail Tool Button */}
          <button
            onClick={() => setShowGmailPanel((prev) => !prev)}
            title="Open GmailToolkit to read inbox threads or send agent reports"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition shadow-sm ${
              showGmailPanel
                ? 'bg-red-500/20 border-red-500/50 text-red-200'
                : 'bg-slate-900 hover:bg-slate-800 text-red-300 hover:text-white border-red-500/30'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-red-400" />
            <span>Gmail Tool</span>
          </button>

          {/* Reload / Upload .env Button */}
          <input
            ref={envFileInputRef}
            type="file"
            accept=".env,.txt,text/plain"
            onChange={handleUploadEnvFile}
            className="hidden"
          />
          <button
            onClick={handleReloadEnvFromDisk}
            title="Reload .env from workspace disk into server runtime"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reload .env</span>
            {loadedKeyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-[10px] font-mono text-emerald-400">
                {loadedKeyCount}
              </span>
            )}
          </button>
          <button
            onClick={() => envFileInputRef.current?.click()}
            title="Upload & persist your local .env file into the workspace (.env is now persisted across container sleeps)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Upload .env</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Preset:</span>
            <select
              value={activePreset}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-slate-900 text-xs text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 outline-none focus:border-[#EB6658]"
            >
              <option value="tech_research">AI & Tech Research Crew</option>
              <option value="full_stack_app">Full Stack App Development</option>
              <option value="financial_audit">FinTech Risk & Audit Crew</option>
              <option value="devops_deployment">Autonomous DevOps & SRE Crew</option>
              <option value="content_strategy">Multi-Channel Content Synthesis</option>
              {!['tech_research', 'full_stack_app', 'financial_audit', 'devops_deployment', 'content_strategy'].includes(activePreset) && (
                <option value={activePreset}>{activePreset === 'custom' ? 'Custom / Imported Workflow' : activePreset}</option>
              )}
            </select>
          </div>

          {/* Global (- +) Minimize All / Expand All Cards Controls */}
          <CardMinMaxButtons
            isMinimized={areAllCardsMinimized}
            onMinimize={() => {
              setAreAllCardsMinimized(true);
              setIsQuotaGovernorMinimized(true);
              setIsHeartbeatMinimized(true);
              setIsAgentsCardMinimized(true);
              setIsTasksCardMinimized(true);
              setIsCodeExportMinimized(true);
              window.dispatchEvent(new CustomEvent('crewai:toggle-all-cards', { detail: { minimized: true } }));
            }}
            onExpand={() => {
              setAreAllCardsMinimized(false);
              setIsQuotaGovernorMinimized(false);
              setIsHeartbeatMinimized(false);
              setIsAgentsCardMinimized(false);
              setIsTasksCardMinimized(false);
              setIsCodeExportMinimized(false);
              window.dispatchEvent(new CustomEvent('crewai:toggle-all-cards', { detail: { minimized: false } }));
            }}
            title="All Studio Cards"
          />
        </div>
      </div>

      {/* Target Repository -> Dictated Workforce & Collaborator Mapping Strip */}
      <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
              <GitBranch className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white">
                  Target Repository Workforce Assignment:
                </span>
                <code className="text-[#EB6658] font-mono font-bold">
                  {selectedRepo}@{selectedBranch}
                </code>
                <span className="text-slate-500">→</span>
                <span className="text-emerald-400 font-semibold">
                  {repoWorkforce.crewName}
                </span>
              </div>
              {!isRepoWorkforceMinimized && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {repoWorkforce.summary}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={autoSyncRepoCrew}
                onChange={(e) => setAutoSyncRepoCrew(e.target.checked)}
                className="rounded border-slate-700 text-[#EB6658] focus:ring-[#EB6658]"
              />
              <span>Auto-sync Crew on Repo Change</span>
            </label>

            {activePreset !== repoWorkforce.presetKey && (
              <button
                type="button"
                onClick={() => {
                  handleSelectPreset(repoWorkforce.presetKey);
                  setRunInput(repoWorkforce.recommendedTopic);
                  showNotification(
                    'success',
                    `Synced Crew Studio to ${repoWorkforce.crewName} for ${selectedRepo}`
                  );
                }}
                className="px-2.5 py-1 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-[11px] font-bold transition cursor-pointer"
              >
                Load Dictated Crew ({repoWorkforce.presetKey.replace(/_/g, ' ')})
              </button>
            )}

            <CardMinMaxButtons
              isMinimized={isRepoWorkforceMinimized}
              onMinimize={() => setIsRepoWorkforceMinimized(true)}
              onExpand={() => setIsRepoWorkforceMinimized(false)}
              title="Target Repository Workforce Assignment"
            />
          </div>
        </div>

        {!isRepoWorkforceMinimized && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                1. Task Maker (Plans Repo Backlog)
              </div>
              <div className="font-bold text-white mt-0.5">{repoWorkforce.taskMaker.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{repoWorkforce.taskMaker.role}</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] font-mono uppercase text-purple-300 font-semibold">
                2. Task Controller (Enforces DoD Gate)
              </div>
              <div className="font-bold text-white mt-0.5">{repoWorkforce.taskController.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{repoWorkforce.taskController.role}</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                3. Domain Specialists ({repoWorkforce.specialists.length} Agents)
              </div>
              <div className="text-[11px] text-slate-200 mt-0.5 truncate">
                {repoWorkforce.specialists.map((s) => s.name).join(' · ')}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Roles: {repoWorkforce.specialists.map((s) => s.category).join(', ')}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] font-mono uppercase text-sky-400 font-semibold">
                4. Cloud VM & PR Gatekeepers
              </div>
              <div className="text-[11px] text-slate-200 mt-0.5 truncate">
                Google Jules VM · Sentinel-Sec Auditor
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Commits & opens verified PRs on {selectedRepo}@{selectedBranch}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Beginner Spoon-Feed Guide Bar & Step 1 Bubble */}
      <div id="guide-step-1" className="space-y-3">
        <SpoonFeedTopBar
          isActive={isGuideMode}
          currentStep={guideStep}
          onToggleActive={() => setIsGuideMode((prev) => !prev)}
          onSelectStep={handleSelectGuideStep}
          onStartFreshProject={handleStartFreshBeginnerProject}
          onOpenFolderPicker={() => document.getElementById('project-import-input')?.click()}
          onPushWithPat={() => handlePushProjectViaPat()}
          isPushingPat={isPushingPat}
          hasGithubPat={Boolean(providerStatus?.github_token || localStorage.getItem('crewai_github_token'))}
          onUploadEnvClick={() => envFileInputRef.current?.click()}
        />

        <ContextualGuideBubble
          step={1}
          currentStep={guideStep}
          isActive={isGuideMode}
          pointerDirection="up"
          onNext={() => handleSelectGuideStep(2)}
          onPrev={() => {}}
          onDismiss={() => setIsGuideMode(false)}
          customActions={
            <>
              <button
                type="button"
                onClick={handleStartFreshBeginnerProject}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Click Me: Start Fresh Blank Project</span>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('project-import-input')?.click()}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Click Me: Open Local Project Folder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectPreset('full_stack_app');
                  showNotification('success', 'Loaded "Full Stack App Development Crew" template! Moving to Step 2.');
                  handleSelectGuideStep(2);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Click Me: Load Full-Stack App Template</span>
              </button>
            </>
          }
        />
      </div>

      {/* Gemini Credit & Argon Quota Governor Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-950/90 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Gemini Credit & Paid Argon (`gemini-4-argon`) Quota Governor
              </h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                {geminiQuota?.activeKeyCount || 5} Active Key Slots • Zero-Halt Routing
              </span>
            </div>
            {!isQuotaGovernorMinimized && (
              <p className="text-xs text-slate-400">
                Automatically rotates across Free-Tier Gemini key slots (<code className="text-slate-300">GEMINI_API_KEY_0..3</code>) and balances <code className="text-[#EB6658] font-semibold">gemini-4-argon</code> (Paid Pro) with <code className="text-emerald-400 font-semibold">gemini-3.8-flash</code> / <code className="text-sky-400 font-semibold">3.1-flash-lite</code> so workflows never hit 429 limits.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Strategy Mode Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => handleStrategyChange('hybrid_auto')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  geminiStrategy === 'hybrid_auto'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Offloads routine agent steps to Free-Tier Flash and reserves Paid Argon for Manager/Architect tasks"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Hybrid (Free + Argon)</span>
              </button>
              <button
                type="button"
                onClick={() => handleStrategyChange('free_tier_guard')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  geminiStrategy === 'free_tier_guard'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Locks all execution to Free Tier models and rotates keys so Paid Argon credits are 100% preserved"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Free-Tier Guard ($0 Cost)</span>
              </button>
              <button
                type="button"
                onClick={() => handleStrategyChange('argon_priority')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  geminiStrategy === 'argon_priority'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Runs primary agents on Paid gemini-4-argon with automatic Free-Tier overflow if RPM or token cap is reached"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Argon Priority + Auto-Overflow</span>
              </button>
            </div>

            {/* Top-Right [-] Minimize / [+] Expand Buttons */}
            <CardMinMaxButtons
              isMinimized={isQuotaGovernorMinimized}
              onMinimize={() => setIsQuotaGovernorMinimized(true)}
              onExpand={() => setIsQuotaGovernorMinimized(false)}
              title="Gemini Credit & Paid Argon Quota Governor"
            />
          </div>
        </div>

        {/* Live Telemetry & Key Slot Rotation Strip */}
        {!isQuotaGovernorMinimized && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80 items-center">
            {/* Key Slots Grid */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(geminiQuota?.slots || [
                { slotId: 'slot-primary', label: 'Primary Key', maskedKey: 'AIzaSy•••', tier: 'paid_argon_capable', rpmUsed: 2, rpmLimit: 60, status: 'active' },
                { slotId: 'slot-0', label: 'Pool Slot #0', maskedKey: 'AIzaSy•••', tier: 'free_tier', rpmUsed: 1, rpmLimit: 15, status: 'standby' },
                { slotId: 'slot-1', label: 'Pool Slot #1', maskedKey: 'AIzaSy•••', tier: 'free_tier', rpmUsed: 1, rpmLimit: 15, status: 'standby' },
                { slotId: 'slot-2', label: 'Pool Slot #2', maskedKey: 'AIzaSy•••', tier: 'free_tier', rpmUsed: 0, rpmLimit: 15, status: 'standby' },
                { slotId: 'slot-3', label: 'Pool Slot #3', maskedKey: 'AIzaSy•••', tier: 'free_tier', rpmUsed: 0, rpmLimit: 15, status: 'standby' },
              ]).map((slot) => {
                const isSlotActive = slot.status === 'active';
                const pct = Math.min(100, Math.round((slot.rpmUsed / Math.max(1, slot.rpmLimit)) * 100));
                return (
                  <div
                    key={slot.slotId}
                    className={`p-2.5 rounded-xl border text-[11px] space-y-1 transition ${
                      isSlotActive
                        ? 'bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-200 truncate">
                        {slot.label.replace(/\s*\(.*\)/, '')}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSlotActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{slot.tier === 'paid_argon_capable' ? 'Argon+Free' : 'Free Pool'}</span>
                      <span className="text-emerald-400 font-semibold">{slot.rpmUsed}/{slot.rpmLimit} RPM</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Argon Budget Cap & Actions */}
            <div className="md:col-span-5 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Paid Argon Session Cap:</span>
                  <select
                    aria-label="Paid Argon session token budget cap"
                    value={argonBudgetCap}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setArgonBudgetCap(val);
                      localStorage.setItem('crewai_argon_budget_cap', String(val));
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-mono text-slate-200 outline-none focus:border-[#EB6658]"
                  >
                    <option value={10000}>10k tokens (Strict Cap)</option>
                    <option value={50000}>50k tokens (Balanced)</option>
                    <option value={200000}>200k tokens (Deep Work)</option>
                    <option value={1000000}>1M tokens (Max Argon)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-slate-300">
                    Argon Used: <strong className="text-[#EB6658]">{(geminiQuota?.argonTokensUsedSession ?? 2450).toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-300">
                    Saved via Free: <strong className="text-emerald-400">+{(geminiQuota?.freeTierTokensSaved ?? 14820).toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSimulateSlotRotation}
                  className="px-2.5 py-1.5 rounded-lg bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 text-[11px] font-semibold transition flex items-center gap-1"
                  title="Test intelligent key slot rotation and Free/Argon load balancing"
                >
                  <Zap className="w-3 h-3" />
                  <span>Rotate & Test</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetGeminiQuota}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  title="Reset session RPM & Argon budget counters"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all duration-200 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-black/20"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Gmail Workspace Panel inside Crew Studio */}
      {showGmailPanel && (
        <GmailWorkspacePanel
          compact
          onUseEmailAsCrewInput={(formattedTopic) => {
            setRunInput(formattedTopic);
            showNotification('success', 'Loaded Gmail thread into Crew Mission Input');
          }}
          defaultComposeSubject={`[${crew.name}] Autonomous Execution Report`}
          defaultComposeBody={
            logs.length > 0
              ? logs.map((l) => `[${l.type.toUpperCase()}] ${l.title}: ${l.content}`).join('\n\n')
              : executionHistory[0]?.summary || ''
          }
        />
      )}

      {/* Real-Time Agent & Task Execution Progress Bar (Synced with Background Process Throttler) */}
      <CrewExecutionProgressBar
        crew={crew}
        isRunning={isRunning}
        activeCycleStage={activeCycleStage}
        liveProgressPct={liveProgressPct}
        activeTaskId={activeExecTaskId}
        activeAgentId={activeExecAgentId}
        taskExecutions={taskExecutions}
        elapsedMs={execElapsedMs}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => setSelectedAgentId(id)}
        onKickoff={handleKickoff}
      />

      {/* Real-Time Agent Heartbeat Monitor & 24/7 Autonomous Watchdog */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Activity className={`w-5 h-5 ${isRunning ? 'text-[#EB6658] animate-bounce' : 'animate-pulse'}`} />
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                  isRunning ? 'bg-[#EB6658] animate-ping' : 'bg-emerald-400 animate-ping'
                }`}
              />
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                  isRunning ? 'bg-[#EB6658]' : 'bg-emerald-400'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Real-Time Agent Heartbeat & 24/7 Autonomous Watchdog
                </h2>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-bold flex items-center gap-1.5 ${
                    isRunning
                      ? 'bg-[#EB6658]/20 text-[#EB6658] border-[#EB6658]/40'
                      : autonomousDaemon
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning ? 'bg-[#EB6658] animate-ping' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  {isRunning
                    ? 'EXECUTING MISSION • HIGH-FREQUENCY PULSE'
                    : autonomousDaemon
                    ? `24/7 DAEMON ACTIVE • NEXT CYCLE IN ${daemonCountdown}S`
                    : `${crew.agents.length}/${crew.agents.length} AGENTS ONLINE • HEARTBEAT 200 OK`}
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  Tick #{heartbeatTick} • Slot: {serverHeartbeatSlot}
                </span>
              </div>
              {!isHeartbeatMinimized && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Live telemetry pulse across all configured agents with automatic stalled-task recovery, key rotation, and 24/7 zero-supervision loop controls.
                </p>
              )}
            </div>
          </div>

          {/* 24/7 Autonomous Daemon & Blueprint Controls */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button
              type="button"
              onClick={() => {
                setAutonomousDaemon((prev) => {
                  const next = !prev;
                  showNotification(
                    'success',
                    next
                      ? '24/7 Autonomous Zero-Supervision Daemon enabled (auto-cycling every 20s)'
                      : '24/7 Autonomous Daemon paused — manual kickoff mode'
                  );
                  return next;
                });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                autonomousDaemon
                  ? 'bg-indigo-600/25 border-indigo-400 text-indigo-200 shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
              title="Enable continuous 24/7 autonomous execution cycles with zero user supervision"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autonomousDaemon ? 'bg-indigo-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span>
                {autonomousDaemon
                  ? `24/7 Autonomous Loop: ON (${daemonCountdown}s • ${daemonCycles} cycles)`
                  : 'Enable 24/7 Zero-Supervision Daemon'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAutonomyBlueprint((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                showAutonomyBlueprint
                  ? 'bg-[#EB6658]/20 border-[#EB6658]/50 text-[#EB6658]'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>24/7 Autonomy Architecture (6/6 Active)</span>
            </button>

            {/* Top-Right [-] Minimize / [+] Expand Buttons */}
            <CardMinMaxButtons
              isMinimized={isHeartbeatMinimized}
              onMinimize={() => setIsHeartbeatMinimized(true)}
              onExpand={() => setIsHeartbeatMinimized(false)}
              title="Real-Time Agent Heartbeat & 24/7 Autonomous Watchdog"
            />
          </div>
        </div>

        {!isHeartbeatMinimized && (
          <>
        {/* Live Agent Heartbeat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
          {crew.agents.map((agent) => {
            const hb = agentHeartbeats[agent.id] || {
              agentId: agent.id,
              status: 'standby_pulse' as AgentLiveStatus,
              latencyMs: 21,
              bpm: 30,
              lastPulse: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              currentActivity: `Heartbeat 200 OK • Ready on ${agent.model.replace('gemini/', '')}`,
              pulseWave: [18, 22, 20, 24, 19, 21, 23, 20, 22, 19, 21, 20],
              uptimePct: '99.98%'
            };

            const isSelected = agent.id === selectedAgentId;
            const isAgentBusy = hb.status === 'reasoning' || hb.status === 'tool_exec' || hb.status === 'delegating';

            const statusBadgeConfig: Record<
              AgentLiveStatus,
              { label: string; dotClass: string; badgeClass: string; strokeColor: string }
            > = {
              standby_pulse: {
                label: autonomousDaemon ? 'WATCHDOG PULSE' : 'HEARTBEAT OK',
                dotClass: 'bg-emerald-400',
                badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                strokeColor: '#34d399'
              },
              reasoning: {
                label: 'REASONING',
                dotClass: 'bg-[#EB6658]',
                badgeClass: 'bg-[#EB6658]/20 text-[#EB6658] border-[#EB6658]/40',
                strokeColor: '#EB6658'
              },
              tool_exec: {
                label: 'TOOL EXEC',
                dotClass: 'bg-amber-400',
                badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                strokeColor: '#fbbf24'
              },
              delegating: {
                label: 'DELEGATING',
                dotClass: 'bg-sky-400',
                badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                strokeColor: '#38bdf8'
              },
              completed: {
                label: 'VERIFIED 200 OK',
                dotClass: 'bg-emerald-400',
                badgeClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50',
                strokeColor: '#10b981'
              },
              self_healing: {
                label: 'SELF-HEALING',
                dotClass: 'bg-purple-400',
                badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                strokeColor: '#c084fc'
              }
            };

            const cfg = statusBadgeConfig[hb.status];
            const wave = hb.pulseWave.length > 1 ? hb.pulseWave : [20, 24, 19, 22, 21, 25];
            const svgPoints = wave
              .map((val, idx) => {
                const x = Math.round((idx / (wave.length - 1)) * 120);
                const normalized = Math.max(4, Math.min(24, 26 - Math.round((val / 160) * 20)));
                return `${x},${normalized}`;
              })
              .join(' ');

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isAgentBusy
                    ? 'bg-slate-900/95 border-[#EB6658]/60 ring-1 ring-[#EB6658]/30 shadow-md'
                    : isSelected
                    ? 'bg-slate-900/90 border-slate-700 ring-1 ring-[#EB6658]/25'
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Animated Multi-Ring Heartbeat Indicator */}
                    <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dotClass} ${
                          isAgentBusy ? 'animate-ping' : 'animate-pulse'
                        }`}
                      />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dotClass}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{agent.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{agent.role}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.badgeClass}`}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Live ECG Sparkline + Metrics */}
                <div className="flex items-center justify-between gap-3 bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                  <svg className="w-28 h-7 overflow-visible shrink-0" viewBox="0 0 120 28">
                    <polyline
                      fill="none"
                      stroke={cfg.strokeColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={svgPoints}
                    />
                  </svg>
                  <div className="text-right font-mono text-[10px] leading-tight">
                    <div className="text-slate-200 font-semibold">
                      {hb.latencyMs}ms <span className="text-slate-500">•</span> {hb.bpm} BPM
                    </div>
                    <div className="text-slate-500 text-[9px]">Pulse {hb.lastPulse}</div>
                  </div>
                </div>

                {/* Live Activity Stream Footer */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                  <span className="truncate max-w-[75%]" title={hb.currentActivity}>
                    {hb.currentActivity}
                  </span>
                  <span className="text-emerald-400 font-semibold shrink-0">{hb.uptimePct}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible 24/7 Zero-Supervision Autonomous Architecture Blueprint */}
        {showAutonomyBlueprint && (
          <div className="pt-3 border-t border-slate-800/90 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>6 Pillars for 24/7 Zero-Supervision Autonomous Coding</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                All 6 Subsystems Wired in Studio
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center justify-between">
                  <span>1. Heartbeat & Stalled-Agent Watchdog</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pings every agent every 2s. If an LLM call hangs or exceeds max_iter, the watchdog auto-restarts the step without human input.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-[#EB6658] flex items-center justify-between">
                  <span>2. Zero-Halt Multi-Key & Model Failover</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rotates across <code className="text-slate-300">GEMINI_API_KEY_0..3</code>, balances Paid <code className="text-slate-300">gemini-4-argon</code> vs Free Flash, and falls back to local Ollama if rate-limited at 3 AM.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-sky-400 flex items-center justify-between">
                  <span>3. Self-Healing PyTest Sandbox (Jules)</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Runs generated code inside an ephemeral Linux VM with <code className="text-slate-300">pytest</code> and AST lint checks, feeding tracebacks back to the coder agent until tests pass.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-amber-400 flex items-center justify-between">
                  <span>4. Durable Flow Checkpointing (@persist)</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Persists workflow state after every task handoff so long-running 24/7 coding pipelines resume from exact checkpoints on restart.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-indigo-400 flex items-center justify-between">
                  <span>5. Continuous Daemon & Inbox Triggers</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Polls GitHub branches, scheduled cron queues, and Gmail inbox threads to ingest new coding tasks and dispatch status reports automatically.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-purple-400 flex items-center justify-between">
                  <span>6. Guardrailed Git Branch & PR Gatekeeper</span>
                  <span className="text-[10px] font-mono">ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pushes verified commits to isolated feature branches (<code className="text-slate-300">jules/feat-*</code>) and opens PRs with test coverage diffs—never breaking <code className="text-slate-300">main</code>.
                </p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Autonomy Strategy Dashboard: Jules Self-Healing, Code Coverage & Task Efficiency */}
      <AutonomyStrategyDashboard
        crewName={crew.name}
        agentsCount={crew.agents.length}
        tasksCount={crew.tasks.length}
        isCrewRunning={isRunning}
        onTriggerSelfHealingPulse={(repairSummary) => {
          showNotification('success', repairSummary);
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setAgentHeartbeats((prev) => {
            const next = { ...prev };
            crew.agents.forEach((a) => {
              const cur = prev[a.id];
              next[a.id] = {
                agentId: a.id,
                status: 'self_healing',
                latencyMs: 54,
                bpm: 88,
                lastPulse: nowStr,
                currentActivity: `Jules Self-Healing AST & PyTest Pass Verified`,
                pulseWave: [...(cur?.pulseWave || [20, 22, 19, 24, 21, 20, 23, 18, 22, 20, 21]).slice(-11), 54],
                uptimePct: '99.99%'
              };
            });
            return next;
          });
          setTimeout(() => {
            const doneStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setAgentHeartbeats((prev) => {
              const next = { ...prev };
              crew.agents.forEach((a) => {
                const cur = prev[a.id];
                next[a.id] = {
                  ...(cur || {
                    agentId: a.id,
                    latencyMs: 19,
                    bpm: 30,
                    pulseWave: [20, 21, 19, 22, 20, 19],
                    uptimePct: '99.99%'
                  }),
                  status: 'standby_pulse',
                  latencyMs: 19,
                  bpm: 30,
                  lastPulse: doneStr,
                  currentActivity: `Heartbeat 200 OK • Self-Healed & Coverage Verified`
                };
              });
              return next;
            });
          }, 2200);
        }}
        onOpenJulesSandbox={
          onOpenJules
            ? () =>
                onOpenJules({
                  targetType: 'crew',
                  targetName: crew.name,
                  suggestedPrompt: `Execute autonomous self-healing & coverage optimization pass for ${crew.name}. Target >= 95% PyTest coverage and zero AST/type errors.`,
                  codeSnippet: activeCodeTab === 'python' ? generatePythonCode() : generateJsonc()
                })
            : undefined
        }
      />

      {/* Autonomous PR Review Module: Intercepts Jules PRs, Runs Secondary Review Agent & Suggests Automated Revisions */}
      <AutonomousPRReviewModule
        crewName={crew.name}
        selectedRepo={selectedRepo}
        runInput={runInput}
        latestPrTrigger={latestInterceptedPr}
        onEmitAuditLog={(newLog) => {
          const fullLog: ExecutionLog = {
            stage: 'github',
            severity: 'info',
            traceId: 'tr-pr-review',
            spanId: `sp-${Math.floor(Math.random() * 90 + 10)}`,
            isoTimestamp: new Date().toISOString(),
            ...newLog,
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setLogs((prev) => [...prev, fullLog]);
        }}
        onNotify={showNotification}
      />

      {/* Predictive Insights Dashboard: Recharts Visualization of Historical Merge Patterns & Jules Indexing Triggers */}
      <PredictiveInsightsDashboard
        crewName={crew.name}
        selectedRepo={selectedRepo}
        latestPrTrigger={latestInterceptedPr}
        onEmitAuditLog={(newLog) => {
          const fullLog: ExecutionLog = {
            stage: 'orchestrator',
            severity: 'info',
            traceId: 'tr-pred-insights',
            spanId: `sp-${Math.floor(Math.random() * 90 + 10)}`,
            isoTimestamp: new Date().toISOString(),
            ...newLog,
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setLogs((prev) => [...prev, fullLog]);
        }}
        onNotify={showNotification}
      />
      <div className="mt-6">
        <RepositoryHealthWidget />
      </div>

      {/* Predictive Scheduler Module: Analyzes Historical PR Merge Patterns to Pre-Fetch Codebase Indexing */}
      <PredictiveSchedulerModule
        crewName={crew.name}
        selectedRepo={selectedRepo}
        latestPrTrigger={latestInterceptedPr}
        onEmitAuditLog={(newLog) => {
          const fullLog: ExecutionLog = {
            stage: 'jules',
            severity: 'info',
            traceId: 'tr-pred-sched',
            spanId: `sp-${Math.floor(Math.random() * 90 + 10)}`,
            isoTimestamp: new Date().toISOString(),
            ...newLog,
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setLogs((prev) => [...prev, fullLog]);
        }}
        onNotify={showNotification}
      />

      {/* Remote Control Module: Antigravity Agent Access */}
      <RemoteControlModule
        onNotify={showNotification}
      />
      <WebhookSettingsPanel onNotify={showNotification} />

      {/* Main Grid: Builder Left & Simulator/Code Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Agents & Tasks Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 2 Contextual Guide Bubble + Crew Configuration Bar */}
          <div id="guide-step-2" className="space-y-2">
            <ContextualGuideBubble
              step={2}
              currentStep={guideStep}
              isActive={isGuideMode}
              pointerDirection="down"
              onNext={() => handleSelectGuideStep(3)}
              onPrev={() => handleSelectGuideStep(1)}
              onDismiss={() => setIsGuideMode(false)}
              customActions={
                <button
                  type="button"
                  onClick={() => {
                    setCrew((c) => ({ ...c, process: 'sequential' }));
                    showNotification('success', 'Set teamwork mode to Sequential (Relay-Race Mode)! Moving to Step 3.');
                    handleSelectGuideStep(3);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Click Me: Use Beginner "Sequential" Mode & Go to Step 3</span>
                </button>
              }
            />

            <div
              className={`p-4 rounded-xl bg-slate-900/60 border flex flex-wrap items-center justify-between gap-4 transition ${
                isGuideMode && guideStep === 2
                  ? 'border-[#EB6658] ring-2 ring-[#EB6658]/40 shadow-lg shadow-[#EB6658]/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Project Name:</span>
                  <input
                    type="text"
                    value={crew.name}
                    onChange={(e) => setCrew((c) => ({ ...c, name: e.target.value }))}
                    placeholder="My Custom Project Crew"
                    className="bg-slate-950 border border-slate-700 focus:border-[#EB6658] rounded-lg px-2.5 py-1 text-xs text-white font-semibold outline-none w-48 sm:w-56"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Process Mode:</span>
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setCrew((c) => ({ ...c, process: 'sequential' }))}
                      className={`px-3 py-1 rounded font-medium transition ${
                        crew.process === 'sequential'
                          ? 'bg-[#EB6658] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sequential
                    </button>
                    <button
                      onClick={() => setCrew((c) => ({ ...c, process: 'hierarchical' }))}
                      className={`px-3 py-1 rounded font-medium transition ${
                        crew.process === 'hierarchical'
                          ? 'bg-[#EB6658] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Hierarchical
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                {crew.process === 'hierarchical' && (
                  <div className="flex items-center gap-2 pr-4 border-r border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Manager:</span>
                      {providerStatus && !providerStatus[MODEL_PROVIDER_MAP[crew.managerModel || ''] || ''] && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Fallback</span>
                        </span>
                      )}
                    </div>
                    <select
                      value={crew.managerModel || 'gemini/gemini-4-argon'}
                      onChange={(e) => setCrew((c) => ({ ...c, managerModel: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-[#EB6658]"
                    >
                      <option value="gemini/gemini-4-argon">Gemini 4 Argon (Paid Pro)</option>
                      <option value="gemini/gemini-3.8-flash">Gemini 3.8 Flash (Free Pool)</option>
                      <option value="gemini/gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Quota)</option>
                      <option value="gemini/gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="groq/llama-3.3-70b">Groq 70B</option>
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={crew.memory}
                    onChange={(e) => setCrew((c) => ({ ...c, memory: e.target.checked }))}
                    className="rounded border-slate-700 text-[#EB6658] focus:ring-[#EB6658]"
                  />
                  <span>Shared Memory</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={crew.verbose}
                    onChange={(e) => setCrew((c) => ({ ...c, verbose: e.target.checked }))}
                    className="rounded border-slate-700 text-[#EB6658] focus:ring-[#EB6658]"
                  />
                  <span>Verbose Logging</span>
                </label>
              </div>
            </div>
          </div>

          {/* Step 3 Contextual Guide Bubble + Agents List & Editor */}
          <div id="guide-step-3" className="space-y-2">
            <ContextualGuideBubble
              step={3}
              currentStep={guideStep}
              isActive={isGuideMode}
              pointerDirection="down"
              onNext={() => handleSelectGuideStep(4)}
              onPrev={() => handleSelectGuideStep(2)}
              onDismiss={() => setIsGuideMode(false)}
              customActions={
                <button
                  type="button"
                  onClick={() => {
                    if (currentAgent) {
                      handleUpdateAgent(currentAgent.id, {
                        name: 'Lead Full-Stack Builder',
                        role: 'Senior Autonomous Software Engineer',
                        goal: 'Design, write, and test clean code for the user project automatically',
                        backstory: 'Expert full-stack developer who builds features step-by-step and verifies every file.',
                        tools: ['SerperDevTool', 'CodeInterpreterTool', 'FileWriteTool']
                      });
                      showNotification('success', 'Auto-filled your AI Worker with a Beginner Full-Stack Builder setup!');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Click Me: Auto-Fill Beginner Builder Agent</span>
                </button>
              }
            />

          <div
            className={`p-5 rounded-2xl bg-slate-900/40 border space-y-4 transition ${
              isGuideMode && guideStep === 3
                ? 'border-[#EB6658] ring-2 ring-[#EB6658]/40 shadow-lg shadow-[#EB6658]/10'
                : 'border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Cpu className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">Configured Agents ({crew.agents.length})</h3>
                {activePreset === 'full_stack_app' ? (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    Full-Stack Org: Task Maker • Task Controller • Deep Dash Researcher • UI/UX • Frontend • Backend • DB • DevOps
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('full_stack_app')}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 font-bold transition cursor-pointer"
                  >
                    Load Full 8-Agent Full-Stack App Preset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleAddAgent}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#EB6658] bg-[#EB6658]/10 hover:bg-[#EB6658]/20 border border-[#EB6658]/30 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Agent</span>
                </button>
                <CardMinMaxButtons
                  isMinimized={isAgentsCardMinimized}
                  onMinimize={() => setIsAgentsCardMinimized(true)}
                  onExpand={() => setIsAgentsCardMinimized(false)}
                  title="Configured Agents"
                />
              </div>
            </div>

            {!isAgentsCardMinimized && (
              <>
            {/* Full-Stack Engineering Org Matrix: Roles, Duties, Task Makers, Task Controllers & PM Tools */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    Full-Stack Roles, Duties, Task Makers & Task Controllers Matrix
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Click any specialist card to inspect or customize their duties & tools
                  </span>
                </div>
                <CardMinMaxButtons
                  isMinimized={isOrgMatrixMinimized}
                  onMinimize={() => setIsOrgMatrixMinimized(true)}
                  onExpand={() => setIsOrgMatrixMinimized(false)}
                  title="Full-Stack Roles & Duties Matrix"
                />
              </div>

              {!isOrgMatrixMinimized && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {crew.agents.map((agent) => {
                    const isSelected = agent.id === selectedAgentId;
                    const categoryStyleMap: Record<string, { label: string; badge: string }> = {
                      task_maker: {
                        label: 'TASK MAKER & PM PLANNER',
                        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      },
                      task_controller: {
                        label: 'TASK CONTROLLER & QA GATE',
                        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      },
                      research: {
                        label: 'DEEP RESEARCH: BEAUTIFUL DASH',
                        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      },
                      design: {
                        label: 'UI/UX DESIGNER & TOKENS',
                        badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                      },
                      frontend: {
                        label: 'FRONTEND ARCHITECT',
                        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      },
                      backend: {
                        label: 'BACKEND & API ENGINEER',
                        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      },
                      database: {
                        label: 'DATABASE ARCHITECT',
                        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      },
                      devops: {
                        label: 'DEVOPS & CLOUD SRE',
                        badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                      },
                      pm: {
                        label: 'PROJECT MANAGEMENT',
                        badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      },
                      general: {
                        label: 'SPECIALIST AGENT',
                        badge: 'bg-slate-800 text-slate-300 border-slate-700'
                      }
                    };
                    const catMeta = categoryStyleMap[agent.category || 'general'] || categoryStyleMap.general;

                    return (
                      <div
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-slate-900 border-[#EB6658] ring-1 ring-[#EB6658]/40 shadow-md'
                            : 'bg-slate-900/50 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${catMeta.badge}`}>
                              {catMeta.label}
                            </span>
                            {agent.allowDelegation && (
                              <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Can Delegate
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-white">{agent.name}</div>
                          <div className="text-[11px] font-medium text-[#EB6658]">{agent.role}</div>
                        </div>

                        {agent.duties && agent.duties.length > 0 && (
                          <ul className="space-y-1 text-[10px] text-slate-300 border-t border-slate-800/80 pt-2">
                            {agent.duties.slice(0, 3).map((duty, dIdx) => (
                              <li key={dIdx} className="flex items-start gap-1.5 leading-snug">
                                <span className="text-emerald-400 font-bold shrink-0">•</span>
                                <span className="line-clamp-2">{duty}</span>
                              </li>
                            ))}
                            {agent.duties.length > 3 && (
                              <li className="text-[9px] font-mono text-slate-400">
                                +{agent.duties.length - 3} more duty in editor below
                              </li>
                            )}
                          </ul>
                        )}

                        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/60">
                          {agent.tools.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agent Selector Pills with Live Heartbeat Status */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {crew.agents.map((agent) => {
                const hb = agentHeartbeats[agent.id];
                const isBusy = hb && (hb.status === 'reasoning' || hb.status === 'tool_exec' || hb.status === 'delegating');
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-2 ${
                      agent.id === selectedAgentId
                        ? 'bg-[#EB6658] text-white shadow-sm'
                        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isBusy ? 'bg-amber-300' : 'bg-emerald-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isBusy ? 'bg-amber-300' : 'bg-emerald-400'
                        }`}
                      />
                    </span>
                    <span>{agent.name}</span>
                    {hb && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          agent.id === selectedAgentId
                            ? 'bg-black/25 text-white'
                            : 'bg-slate-900/90 text-emerald-400'
                        }`}
                      >
                        {isBusy ? hb.status.toUpperCase() : `${hb.latencyMs}ms`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Agent Details Form */}
            {currentAgent && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200">Editing: {currentAgent.name}</span>
                    {agentHeartbeats[currentAgent.id] && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                          Heartbeat {agentHeartbeats[currentAgent.id].latencyMs}ms • {agentHeartbeats[currentAgent.id].bpm} BPM
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                      <input
                        type="checkbox"
                        checked={Boolean(currentAgent.allowDelegation)}
                        onChange={(e) => handleUpdateAgent(currentAgent.id, { allowDelegation: e.target.checked })}
                        className="rounded border-slate-700 text-[#EB6658] focus:ring-[#EB6658]"
                      />
                      <span>Allow Task Delegation</span>
                    </label>
                    {crew.agents.length > 1 && (
                      <button
                        onClick={() => handleDeleteAgent(currentAgent.id)}
                        className="text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Agent Name</label>
                    <input
                      type="text"
                      value={currentAgent.name}
                      onChange={(e) => handleUpdateAgent(currentAgent.id, { name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Full-Stack Specialty</label>
                    <select
                      value={currentAgent.category || 'general'}
                      onChange={(e) =>
                        handleUpdateAgent(currentAgent.id, {
                          category: e.target.value as AgentConfig['category']
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none"
                    >
                      <option value="task_maker">Task Maker & PM Planner</option>
                      <option value="task_controller">Task Controller & QA Gatekeeper</option>
                      <option value="research">Deep Researcher (Beautiful Dashboards)</option>
                      <option value="design">UI/UX Designer & Design Systems</option>
                      <option value="frontend">Frontend Architect (React/TS)</option>
                      <option value="backend">Backend & API Engineer</option>
                      <option value="database">Database Architect (SQL/NoSQL/Vector)</option>
                      <option value="devops">DevOps, CI/CD & Cloud SRE</option>
                      <option value="pm">Project Management Specialist</option>
                      <option value="general">General Autonomous Agent</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400 font-medium">Model</label>
                        {providerStatus && !providerStatus[MODEL_PROVIDER_MAP[currentAgent.model] || ''] && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Fallback Active</span>
                          </span>
                        )}
                      </div>
                      {onOpenOllamaScanner && (
                        <button
                          type="button"
                          onClick={onOpenOllamaScanner}
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold transition"
                          title="Scan local PC for installed Ollama models"
                        >
                          <Laptop className="w-3 h-3" />
                          <span>Scan PC Ollama</span>
                        </button>
                      )}
                    </div>
                    <select
                      value={currentAgent.model}
                      onChange={(e) => handleUpdateAgent(currentAgent.id, { model: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none"
                    >
                      <optgroup label="Google Gemini Credit Governor (Free Pool + Paid Argon)">
                        <option value="gemini/gemini-4-argon">Google Gemini 4 Argon (Paid Pro • Deep Reasoning)</option>
                        <option value="gemini/gemini-3.8-flash">Google Gemini 3.8 Flash (Free Tier • Fast Workhorse)</option>
                        <option value="gemini/gemini-3.1-flash-lite">Google Gemini 3.1 Flash Lite (Free Tier • 30 RPM High Quota)</option>
                        <option value="gemini/gemini-3-flash-preview">Google Gemini 3 Flash Preview (Free Tier Pool)</option>
                        <option value="gemini/gemini-2.5-flash">Google Gemini 2.5 Flash (Free Tier Stable)</option>
                      </optgroup>
                      <optgroup label="External Cloud Providers (Auto-Fallback Enabled)">
                        <option value="groq/llama-3.3-70b">Groq Llama 3.3 70B</option>
                        <option value="deepseek/deepseek-chat">DeepSeek Chat</option>
                        <option value="gpt-4o">OpenAI GPT-4o</option>
                        <option value="anthropic/claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                      </optgroup>
                      <optgroup label="Local PC Hardware (Zero Cost)">
                        <option value="ollama/llama3.2:3b">ollama/llama3.2:3b (Local PC)</option>
                        <option value="ollama/deepseek-r1:8b">ollama/deepseek-r1:8b (Local PC)</option>
                        <option value="ollama-pool/llama3.2">Ollama Cloud (Failover Pool)</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Role (Job Title & Authority)</label>
                  <input
                    type="text"
                    value={currentAgent.role}
                    onChange={(e) => handleUpdateAgent(currentAgent.id, { role: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Primary Goal</label>
                  <input
                    type="text"
                    value={currentAgent.goal}
                    onChange={(e) => handleUpdateAgent(currentAgent.id, { goal: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Backstory & Domain Expertise</label>
                  <textarea
                    rows={2}
                    value={currentAgent.backstory}
                    onChange={(e) => handleUpdateAgent(currentAgent.id, { backstory: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-[#EB6658] outline-none resize-none"
                  />
                </div>

                {/* Agent Duties & Responsibilities Editor */}
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Specific Duties & Responsibilities ({(currentAgent.duties || []).length})</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDuties = [
                          ...(currentAgent.duties || []),
                          'Define and verify deliverable contract for this full-stack stage'
                        ];
                        handleUpdateAgent(currentAgent.id, { duties: nextDuties });
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition cursor-pointer"
                    >
                      + Add Duty
                    </button>
                  </div>
                  {(currentAgent.duties || []).length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No explicit duties listed yet. Click "+ Add Duty" to define concrete responsibilities for this agent.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(currentAgent.duties || []).map((duty, dutyIdx) => (
                        <div key={dutyIdx} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-emerald-400 font-bold w-4">
                            {dutyIdx + 1}.
                          </span>
                          <input
                            type="text"
                            value={duty}
                            onChange={(e) => {
                              const updated = [...(currentAgent.duties || [])];
                              updated[dutyIdx] = e.target.value;
                              handleUpdateAgent(currentAgent.id, { duties: updated });
                            }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 focus:border-[#EB6658] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (currentAgent.duties || []).filter((_, i) => i !== dutyIdx);
                              handleUpdateAgent(currentAgent.id, { duties: updated });
                            }}
                            className="text-slate-500 hover:text-red-400 p-1"
                            title="Remove duty"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assigned Tools (Full Catalog including Project Management, UI/UX, Database, DevOps & Deep Research) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-bold">
                      Equipped Specialist & Project Management Tools ({currentAgent.tools.length} active)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      Includes Linear/Jira PM, GitHub Projects, Figma Tokens, SQL/Vector & Docker/K8s
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TOOLS_CATALOG.map((tool) => {
                      const isEquipped = currentAgent.tools.includes(tool.name);
                      return (
                        <button
                          key={tool.name}
                          type="button"
                          title={`${tool.categoryLabel}: ${tool.description}`}
                          onClick={() => {
                            const newTools = isEquipped
                              ? currentAgent.tools.filter((t) => t !== tool.name)
                              : [...currentAgent.tools, tool.name];
                            handleUpdateAgent(currentAgent.id, { tools: newTools });
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition border flex items-center gap-1 cursor-pointer ${
                            isEquipped
                              ? 'bg-[#EB6658]/20 border-[#EB6658] text-[#EB6658] font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>{tool.name}</span>
                          <span className="text-[9px] font-mono opacity-70">({tool.categoryLabel})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
              </>
            )}
          </div>
          </div>

          {/* Step 4 Contextual Guide Bubble + Tasks Pipeline */}
          <div id="guide-step-4" className="space-y-2">
            <ContextualGuideBubble
              step={4}
              currentStep={guideStep}
              isActive={isGuideMode}
              pointerDirection="down"
              onNext={() => handleSelectGuideStep(5)}
              onPrev={() => handleSelectGuideStep(3)}
              onDismiss={() => setIsGuideMode(false)}
              customActions={
                <button
                  type="button"
                  onClick={() => {
                    setCrew((c) => ({
                      ...c,
                      tasks: c.tasks.map((t, idx) =>
                        idx === 0
                          ? {
                              ...t,
                              name: '1. Design & Spec Project',
                              description: 'Break down the project topic into clear UI components, routes, and data models.'
                            }
                          : {
                              ...t,
                              name: `${idx + 1}. Write Code & Run Tests`,
                              description: 'Implement the code, verify with automated tests in Jules VM, and prepare a GitHub PR.'
                            }
                      )
                    }));
                    showNotification('success', 'Auto-wrote clear beginner Tasks for your Crew!');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Click Me: Auto-Write Beginner Project Tasks</span>
                </button>
              }
            />

          {/* Interactive Task Dependency & Execution Sequence Graph Visualizer */}
          <TaskDependencyGraphVisualizer
            tasks={crew.tasks}
            agents={crew.agents}
            processMode={crew.process}
            isRunning={isRunning}
            activeTaskId={activeExecTaskId}
            taskExecutions={taskExecutions}
            onUpdateTasks={(updatedTasks) => {
              setCrew((c) => ({
                ...c,
                tasks: updatedTasks
              }));
            }}
            onNotify={showNotification}
          />

          <div
            className={`p-5 rounded-2xl bg-slate-900/40 border space-y-4 transition ${
              isGuideMode && guideStep === 4
                ? 'border-[#EB6658] ring-2 ring-[#EB6658]/40 shadow-lg shadow-[#EB6658]/10'
                : 'border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">
                  Tasks Pipeline & Task Controller Gates ({crew.tasks.length})
                </h3>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#EB6658] bg-[#EB6658]/10 hover:bg-[#EB6658]/20 border border-[#EB6658]/30 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
                <CardMinMaxButtons
                  isMinimized={isTasksCardMinimized}
                  onMinimize={() => setIsTasksCardMinimized(true)}
                  onExpand={() => setIsTasksCardMinimized(false)}
                  title="Tasks Pipeline"
                />
              </div>
            </div>

            {!isTasksCardMinimized && (
            <div className="space-y-3">
              {crew.tasks.map((task, idx) => {
                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <span className="w-5 h-5 rounded-full bg-[#EB6658]/20 text-[#EB6658] flex items-center justify-center font-bold text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={task.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrew((c) => ({
                              ...c,
                              tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, name: val } : t))
                            }));
                          }}
                          className="font-semibold text-slate-200 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-[#EB6658] outline-none w-full"
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {task.phase && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            {task.phase}
                          </span>
                        )}
                        <select
                          value={task.agentId}
                          title="Task Maker / Specialist Assigned to Execute this Task"
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrew((c) => ({
                              ...c,
                              tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, agentId: val } : t))
                            }));
                          }}
                          className="bg-slate-900 text-[11px] text-slate-200 px-2 py-1 rounded border border-slate-700 outline-none"
                        >
                          {crew.agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              Executor: {a.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={
                            task.controllerAgentId ||
                            crew.agents.find((a) => a.category === 'task_controller')?.id ||
                            crew.agents[0]?.id ||
                            ''
                          }
                          title="Task Controller / Gatekeeper Reviewing & Approving this Task"
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrew((c) => ({
                              ...c,
                              tasks: c.tasks.map((t) =>
                                t.id === task.id ? { ...t, controllerAgentId: val } : t
                              )
                            }));
                          }}
                          className="bg-purple-950/40 text-[11px] text-purple-200 px-2 py-1 rounded border border-purple-500/40 outline-none"
                        >
                          {crew.agents.map((a) => (
                            <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">
                              Controller Gate: {a.name}
                            </option>
                          ))}
                        </select>

                        {crew.tasks.length > 1 && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-mono text-slate-400">
                            Task Execution Instructions:
                          </span>
                          <button
                            type="button"
                            onClick={() => suggestImprovement(task)}
                            disabled={suggestingTaskId === task.id}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                          >
                            {suggestingTaskId === task.id ? 'Suggesting...' : 'AI-Suggested Improvement'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={task.description}
                          placeholder="Task description..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrew((c) => ({
                              ...c,
                              tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, description: val } : t))
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-[#EB6658]"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400/90 block mb-0.5">
                          Expected Deliverable & Controller Acceptance Criteria:
                        </span>
                        <input
                          type="text"
                          value={task.expectedOutput}
                          placeholder="Expected output & acceptance gate..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrew((c) => ({
                              ...c,
                              tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, expectedOutput: val } : t))
                            }));
                          }}
                          className="w-full bg-slate-900/70 border border-slate-800/90 rounded px-2.5 py-1 text-slate-300 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          </div>
        </div>

        {/* Right Column: Execution Telemetry & Code Export (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 5 Contextual Guide Bubble + Structured Audit Log Stream Panel */}
          <div id="guide-step-5" className="space-y-2">
            <ContextualGuideBubble
              step={5}
              currentStep={guideStep}
              isActive={isGuideMode}
              pointerDirection="down"
              onNext={() => handleSelectGuideStep(6)}
              onPrev={() => handleSelectGuideStep(4)}
              onDismiss={() => setIsGuideMode(false)}
              customActions={
                <div className="space-y-2 w-full">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Build a SaaS Dashboard with Auth & Billing',
                      'Audit repository for bugs & open verified PR',
                      'Create an AI Research & Daily Report Pipeline'
                    ].map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        onClick={() => {
                          setRunInput(idea);
                          showNotification('success', `Set project focus to: "${idea}"`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-200 border border-amber-500/30 text-[11px] font-medium transition cursor-pointer"
                      >
                        Click Idea: "{idea}"
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      handleKickoff();
                      handleSelectGuideStep(6);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Click Me Here: Launch My Crew Right Now!</span>
                  </button>
                </div>
              }
            />

            <div
              className={`rounded-2xl transition ${
                isGuideMode && guideStep === 5
                  ? 'ring-2 ring-[#EB6658] shadow-xl shadow-[#EB6658]/15'
                  : ''
              }`}
            >
              <AgentAuditLog
                agents={crew.agents}
                tasks={crew.tasks}
                logs={logs}
                taskExecutions={taskExecutions}
              />
              <StructuredAuditLogPanel
                logs={logs}
                agents={crew.agents}
                isRunning={isRunning}
                runInput={runInput}
                onRunInputChange={setRunInput}
                onKickoff={handleKickoff}
                fullCycleEnabled={fullCycleEnabled}
                onToggleFullCycle={setFullCycleEnabled}
                activeCycleStage={activeCycleStage}
                executionHistoryCount={executionHistory.length}
                onOpenHistory={() => setIsHistoryOpen(true)}
                onLoadSampleCycleTrace={() => setLogs(buildSampleCycleLogs(crew, runInput))}
                onClearLogs={() => setLogs([])}
              />
            </div>
          </div>

          {/* Step 6 Contextual Guide Bubble + Export Code Card */}
          <div id="guide-step-6" className="space-y-2">
            <ContextualGuideBubble
              step={6}
              currentStep={guideStep}
              isActive={isGuideMode}
              pointerDirection="down"
              onNext={() => setIsGuideMode(false)}
              onPrev={() => handleSelectGuideStep(5)}
              onDismiss={() => setIsGuideMode(false)}
              customActions={
                <>
                  <button
                    type="button"
                    onClick={() => handlePushProjectViaPat()}
                    disabled={isPushingPat}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>
                      {isPushingPat ? 'Pushing to GitHub...' : 'Click Me: Push Project to GitHub (via .env PAT)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pendingPushAfterEnvRef.current = true;
                      envFileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-300" />
                    <span>Upload .env & Auto-Push</span>
                  </button>
                </>
              }
            />

          <div
            className={`p-5 rounded-2xl bg-slate-900/40 border space-y-3 transition ${
              isGuideMode && guideStep === 6
                ? 'border-[#EB6658] ring-2 ring-[#EB6658]/40 shadow-lg shadow-[#EB6658]/10'
                : 'border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">Generated Code Export</h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <button
                  type="button"
                  onClick={() => handlePushProjectViaPat()}
                  disabled={isPushingPat}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg border border-emerald-500/40 transition shadow-sm cursor-pointer"
                  title="Directly push this Crew configuration to GitHub using the PAT from your .env file"
                >
                  <GitBranch className="w-3 h-3 text-emerald-400" />
                  <span>{isPushingPat ? 'Pushing...' : 'Push via .env PAT'}</span>
                </button>

                {onOpenJules && (
                  <button
                    onClick={() =>
                      onOpenJules({
                        targetType: 'crew',
                        targetName: crew.name,
                        suggestedPrompt: `Autonomous validation & test suite for ${crew.name}. Boot cloud VM, install dependencies, run pytest suite, and open verified GitHub PR.`,
                        codeSnippet: activeCodeTab === 'python' ? generatePythonCode() : generateJsonc()
                      })
                    }
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30 transition shadow-sm"
                    title="Run autonomous cloud VM tests and open a verified PR with Google Jules"
                  >
                    <Cpu className="w-3 h-3 text-blue-400" />
                    <span>Test & PR via Jules</span>
                  </button>
                )}

                {onNavigateToGitHub && (
                  <button
                    onClick={onNavigateToGitHub}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#EB6658] bg-[#EB6658]/10 hover:bg-[#EB6658]/20 px-2.5 py-1 rounded-lg border border-[#EB6658]/30 transition"
                  >
                    <span>GitHub Hub</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setActiveCodeTab('python')}
                    className={`px-2.5 py-0.5 rounded font-medium ${
                      activeCodeTab === 'python' ? 'bg-[#EB6658] text-white' : 'text-slate-400'
                    }`}
                  >
                    crew.py
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('jsonc')}
                    className={`px-2.5 py-0.5 rounded font-medium ${
                      activeCodeTab === 'jsonc' ? 'bg-[#EB6658] text-white' : 'text-slate-400'
                    }`}
                  >
                    crew.jsonc
                  </button>
                </div>

                <CardMinMaxButtons
                  isMinimized={isCodeExportMinimized}
                  onMinimize={() => setIsCodeExportMinimized(true)}
                  onExpand={() => setIsCodeExportMinimized(false)}
                  title="Generated Code Export"
                />
              </div>
            </div>

            {!isCodeExportMinimized && (
              <div className="relative rounded-xl border border-slate-800 bg-[#090D16] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-xs">
                  <span className="font-mono text-[11px] text-slate-400">
                    {activeCodeTab === 'python' ? 'Python Standalone Script' : 'Modern JSONC Spec'}
                  </span>
                  <button
                    onClick={() => copyCode(activeCodeTab === 'python' ? generatePythonCode() : generateJsonc())}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-slate-300 h-64 overflow-y-auto leading-relaxed">
                  <code>{activeCodeTab === 'python' ? generatePythonCode() : generateJsonc()}</code>
                </pre>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Execution History Modal & Telemetry Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-5xl bg-[#0B0F19] border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">Execution History</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold border border-slate-700">
                      {executionHistory.length} Runs Recorded
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Audit log of previous agent workflow executions, timestamps, latency, token consumption, and outputs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportHistory}
                  disabled={executionHistory.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition cursor-pointer"
                  title="Export history to JSON"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Export JSON</span>
                </button>
                <button
                  onClick={handleClearHistory}
                  disabled={executionHistory.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 disabled:opacity-40 text-xs font-medium transition cursor-pointer"
                  title="Clear all recorded execution runs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear History</span>
                </button>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Close modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Filter by crew name, topic, or log keyword..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">Status:</span>
                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  {(['all', 'completed', 'failed'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setHistoryFilterStatus(st)}
                      className={`px-2.5 py-1 rounded capitalize font-medium transition cursor-pointer ${
                        historyFilterStatus === st ? 'bg-amber-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Master-Detail Split Grid */}
            {(() => {
              const filteredHistory = executionHistory.filter((run) => {
                const matchesFilter = historyFilterStatus === 'all' || run.status === historyFilterStatus;
                const query = historySearchQuery.trim().toLowerCase();
                if (!query) return matchesFilter;
                const matchesQuery =
                  run.crewName.toLowerCase().includes(query) ||
                  run.inputTopic.toLowerCase().includes(query) ||
                  run.processMode.toLowerCase().includes(query) ||
                  run.logs.some((l) => l.content.toLowerCase().includes(query) || l.title.toLowerCase().includes(query));
                return matchesFilter && matchesQuery;
              });

              const activeRun =
                executionHistory.find((r) => r.id === selectedHistoryRunId) ||
                filteredHistory[0] ||
                executionHistory[0] ||
                null;

              return (
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                  {/* Left Column: List of Run Records (5 cols) */}
                  <div className="md:col-span-5 overflow-y-auto p-4 space-y-2.5 max-h-[55vh] md:max-h-none">
                    {filteredHistory.length === 0 ? (
                      <div className="text-center p-8 text-slate-500 space-y-2">
                        <History className="w-8 h-8 mx-auto text-slate-600" />
                        <p className="text-xs">No execution runs found matching filter.</p>
                      </div>
                    ) : (
                      filteredHistory.map((run) => {
                        const isSelected = activeRun?.id === run.id;
                        return (
                          <div
                            key={run.id}
                            onClick={() => setSelectedHistoryRunId(run.id)}
                            className={`p-3 rounded-2xl border transition cursor-pointer relative group ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-md'
                                : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-white truncate max-w-[170px]">{run.crewName}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400">{run.timestamp}</span>
                                <button
                                  onClick={(e) => handleDeleteRun(run.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                                  title="Delete run record"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-400 truncate mb-2">
                              Topic: <span className="text-slate-200">"{run.inputTopic}"</span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-800/60">
                              <span className="px-1.5 py-0.5 rounded bg-slate-950 capitalize border border-slate-800">
                                {run.processMode}
                              </span>
                              <span>{(run.durationMs / 1000).toFixed(1)}s</span>
                              <span>{run.tokensUsed.toLocaleString()} tokens</span>
                              <span className="text-emerald-400 font-bold">200 OK</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Right Column: Run Detail Inspector (7 cols) */}
                  <div className="md:col-span-7 flex flex-col overflow-hidden bg-[#080B14]">
                    {activeRun ? (
                      <div className="flex flex-col h-full overflow-hidden">
                        {/* Detail Header */}
                        <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">{activeRun.crewName}</h3>
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                                {activeRun.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {activeRun.timestamp} • Topic: "{activeRun.inputTopic}"
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleLoadRunLogs(activeRun)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#EB6658] to-[#C94C3C] text-white text-xs font-bold shadow-sm hover:shadow transition cursor-pointer"
                              title="Load this run's logs into the active Simulator view"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Load into Simulator</span>
                            </button>

                            <button
                              onClick={() => handleCopyRunLogs(activeRun)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                              title="Copy log transcript to clipboard"
                            >
                              {copiedHistoryId === activeRun.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Metrics Bar */}
                        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Process:</span>
                            <span className="text-slate-200 capitalize">{activeRun.processMode}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Agents / Tasks:</span>
                            <span className="text-slate-200">{activeRun.agentsCount} / {activeRun.tasksCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Latency:</span>
                            <span className="text-slate-200">{(activeRun.durationMs / 1000).toFixed(2)}s</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Tokens:</span>
                            <span className="text-amber-400">{activeRun.tokensUsed.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Logs Stream */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs">
                          {activeRun.logs.map((log) => (
                            <div
                              key={log.id}
                              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-[#EB6658] flex items-center gap-1.5">
                                  {log.type === 'tool_call' && <Wrench className="w-3 h-3" />}
                                  {log.type === 'thought' && <Cpu className="w-3 h-3" />}
                                  {log.type === 'task_complete' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                  <span>{log.title}</span>
                                </span>
                                <span className="text-slate-500">{log.timestamp}</span>
                              </div>

                              <div className="text-slate-300 text-[11px] font-sans leading-relaxed whitespace-pre-wrap">
                                {log.content}
                              </div>

                              {log.meta && (
                                <div className="flex gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                                  {log.meta.tokens && <span>Tokens: {log.meta.tokens}</span>}
                                  {log.meta.durationMs && <span>Latency: {log.meta.durationMs}ms</span>}
                                  {log.meta.toolName && <span>Tool: {log.meta.toolName}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-2">
                        <History className="w-10 h-10 text-slate-700" />
                        <p className="text-xs">Select a run from the history list to inspect its logs.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] text-slate-500">
                Persisted to localStorage: <code className="text-slate-400">crewai_studio_execution_history</code>
              </span>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
