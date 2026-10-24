export interface RepoWorkforceProfile {
  repoPattern: string;
  displayRepo: string;
  label: string;
  presetKey: 'full_stack_app' | 'tech_research' | 'devops_deployment' | 'financial_audit' | 'content_strategy';
  crewName: string;
  processMode: 'sequential' | 'hierarchical';
  managerModel: string;
  taskMaker: {
    name: string;
    role: string;
  };
  taskController: {
    name: string;
    role: string;
  };
  specialists: {
    name: string;
    role: string;
    category: string;
  }[];
  pipelineCollaborators: {
    name: string;
    role: string;
    stage: string;
  }[];
  defaultBranch: string;
  recommendedTopic: string;
  summary: string;
}

export const CURATED_TARGET_REPOS: RepoWorkforceProfile[] = [
  {
    repoPattern: 'bingkltech/crewAI',
    displayRepo: 'bingkltech/crewAI',
    label: 'Full-Stack App & Studio Platform (Default)',
    presetKey: 'full_stack_app',
    crewName: 'Full Stack App Development Crew (Complete 8-Agent Org)',
    processMode: 'hierarchical',
    managerModel: 'gemini/gemini-4-argon',
    taskMaker: {
      name: 'Elena Vance',
      role: 'Lead Task Maker, PRD Architect & Sprint Decomposer'
    },
    taskController: {
      name: 'Marcus Sterling',
      role: 'Principal Task Controller, QA Gatekeeper & PM Orchestrator'
    },
    specialists: [
      { name: 'Dr. Aria Lin', role: 'Deep Researcher: Beautiful Dashboards', category: 'Research' },
      { name: 'Chloe Laurent', role: 'Principal UI/UX Designer', category: 'UI/UX' },
      { name: 'Liam Vance', role: 'Principal Frontend Architect (React/TS)', category: 'Frontend' },
      { name: 'Noah Patel', role: 'Senior Backend & API Lead', category: 'Backend' },
      { name: 'Sofia Rostova', role: 'Principal Database Architect (SQL/Vector)', category: 'Database' },
      { name: 'Kai Nakamura', role: 'Principal DevOps & Cloud SRE', category: 'DevOps' }
    ],
    pipelineCollaborators: [
      { name: 'Flow Orchestrator', role: 'Stage 1: Quota & Key Slot Router', stage: 'Orchestrator' },
      { name: 'Google Jules Cloud VM', role: 'Stage 3: Ephemeral Sandbox (PyTest + AST Self-Heal)', stage: 'Jules VM' },
      { name: 'Sentinel-Sec PR Auditor', role: 'Stage 4: Secondary SAST & AGENTS.md Gatekeeper', stage: 'GitHub PR' }
    ],
    defaultBranch: 'main',
    recommendedTopic:
      'Build an Enterprise SaaS Operations & Telemetry Platform with Beautiful Bento Dashboard, RBAC Auth, PostgreSQL & CI/CD',
    summary:
      'Assigns the complete 8-agent Full-Stack Engineering Organization (Task Maker, Task Controller, Dashboard Researcher, UI/UX, Frontend, Backend, Database, and DevOps) plus Google Jules VM and Sentinel-Sec PR Auditor.'
  },
  {
    repoPattern: 'crewAIInc/crewAI',
    displayRepo: 'crewAIInc/crewAI',
    label: 'Core Python Agent Framework & Research',
    presetKey: 'tech_research',
    crewName: 'AI & Tech Research Crew',
    processMode: 'sequential',
    managerModel: 'gemini/gemini-3-flash-preview',
    taskMaker: {
      name: 'Dr. Evelyn Vance',
      role: 'Senior Emerging Tech & Distributed Agent Researcher'
    },
    taskController: {
      name: 'Marcus Sterling',
      role: 'Lead Technical Journalist & Synthesis Gatekeeper'
    },
    specialists: [
      { name: 'Dr. Evelyn Vance', role: 'Agent Architecture & Memory Researcher', category: 'Research' },
      { name: 'Marcus Sterling', role: 'Technical Spec & Executive Synthesis Editor', category: 'Synthesis' }
    ],
    pipelineCollaborators: [
      { name: 'Flow Orchestrator', role: 'Stage 1: Sequential Research Dispatcher', stage: 'Orchestrator' },
      { name: 'Google Jules Cloud VM', role: 'Stage 3: Python message_content_text() & PyTest Verifier', stage: 'Jules VM' },
      { name: 'Sentinel-Sec PR Auditor', role: 'Stage 4: AGENTS.md & Docs Translation Sync Gate', stage: 'GitHub PR' }
    ],
    defaultBranch: 'main',
    recommendedTopic:
      'Analyze multi-agent state persistence benchmarks and verify multimodal message_content_text() safety across core modules',
    summary:
      'Assigns the AI & Tech Research Crew focused on Python agent internals, multimodal LLMMessage safety, and benchmark synthesis.'
  },
  {
    repoPattern: 'bingkltech/cloud-infra-sre',
    displayRepo: 'bingkltech/cloud-infra-sre',
    label: 'Cloud Infrastructure, Docker & Kubernetes SRE',
    presetKey: 'devops_deployment',
    crewName: 'Autonomous DevOps & SRE Crew',
    processMode: 'sequential',
    managerModel: 'gemini/gemini-3-flash-preview',
    taskMaker: {
      name: 'Aegis',
      role: 'DevSecOps Pre-Flight Vulnerability Planner'
    },
    taskController: {
      name: 'Nexus-7',
      role: 'Site Reliability & Canary Rollout Controller'
    },
    specialists: [
      { name: 'Aegis', role: 'Container & Dependency Security Specialist', category: 'DevSecOps' },
      { name: 'Nexus-7', role: 'Kubernetes Canary & Zero-Downtime SRE', category: 'SRE' }
    ],
    pipelineCollaborators: [
      { name: 'Flow Orchestrator', role: 'Stage 1: Infra & Telemetry Router', stage: 'Orchestrator' },
      { name: 'Google Jules Cloud VM', role: 'Stage 3: Container Build & K8s Manifest Sandbox', stage: 'Jules VM' },
      { name: 'GitHub PR Gatekeeper', role: 'Stage 4: Zero-Leak Secret Guard & Canary PR Merger', stage: 'GitHub PR' }
    ],
    defaultBranch: 'main',
    recommendedTopic:
      'Scan container images for CVEs, enforce CPU/RAM resource limits, and stage a 5% canary Kubernetes deployment',
    summary:
      'Assigns the Autonomous DevOps & SRE Crew (Aegis + Nexus-7) to audit secrets, container health, and zero-downtime rollouts.'
  },
  {
    repoPattern: 'bingkltech/fintech-risk-engine',
    displayRepo: 'bingkltech/fintech-risk-engine',
    label: 'FinTech Quantitative Audit & Regulatory Compliance',
    presetKey: 'financial_audit',
    crewName: 'FinTech Risk & Audit Crew',
    processMode: 'hierarchical',
    managerModel: 'gpt-4o',
    taskMaker: {
      name: 'Sarah Chen, CFA',
      role: 'Quantitative Financial Analyst & Ratio Decomposer'
    },
    taskController: {
      name: 'Jonathan Reynolds',
      role: 'Chief Compliance & Regulatory Risk Controller'
    },
    specialists: [
      { name: 'Sarah Chen, CFA', role: 'Quantitative Financial & GAAP Analyst', category: 'Quant' },
      { name: 'Jonathan Reynolds', role: 'SEC Compliance & Covenant Risk Officer', category: 'Compliance' }
    ],
    pipelineCollaborators: [
      { name: 'Flow Orchestrator', role: 'Stage 1: Hierarchical Audit Coordinator', stage: 'Orchestrator' },
      { name: 'Google Jules Cloud VM', role: 'Stage 3: Deterministic Ratio & Stress-Test Verifier', stage: 'Jules VM' },
      { name: 'Sentinel-Sec PR Auditor', role: 'Stage 4: Audit Trail & Regulatory Sign-Off Gate', stage: 'GitHub PR' }
    ],
    defaultBranch: 'main',
    recommendedTopic:
      'Extract Q4 SaaS operating margins, compute Rule of 40, and generate a regulatory compliance risk scorecard',
    summary:
      'Assigns the FinTech Risk & Audit Crew (Sarah Chen, CFA + Jonathan Reynolds) under a hierarchical compliance manager.'
  },
  {
    repoPattern: 'bingkltech/docs-content-hub',
    displayRepo: 'bingkltech/docs-content-hub',
    label: 'Technical Documentation, MDX & Multi-Language Hub',
    presetKey: 'content_strategy',
    crewName: 'Multi-Channel Content Synthesis Crew',
    processMode: 'sequential',
    managerModel: 'claude-3-5-sonnet',
    taskMaker: {
      name: 'Aria Pen',
      role: 'Lead Technical Author & MDX Architect'
    },
    taskController: {
      name: 'Growth Hacker',
      role: 'Distribution & Localization Sync Controller'
    },
    specialists: [
      { name: 'Aria Pen', role: 'Creative Technical Storyteller & MDX Writer', category: 'Docs/Content' },
      { name: 'Growth Hacker', role: 'Multi-Channel Distribution & Localization Strategist', category: 'Distribution' }
    ],
    pipelineCollaborators: [
      { name: 'Flow Orchestrator', role: 'Stage 1: Editorial Pipeline Router', stage: 'Orchestrator' },
      { name: 'Google Jules Cloud VM', role: 'Stage 3: Mintlify Broken-Links & i18n (ar/ko/pt-BR) Verifier', stage: 'Jules VM' },
      { name: 'GitHub PR Gatekeeper', role: 'Stage 4: Frozen Snapshot Guard (docs/v*) & Docs PR Publisher', stage: 'GitHub PR' }
    ],
    defaultBranch: 'main',
    recommendedTopic:
      'Draft an architectural guide on CrewAI Flows under docs/edge/en/ and sync translations across ar, ko, and pt-BR',
    summary:
      'Assigns the Content & Docs Crew with automated checks for Mintlify links and multi-language translation synchronization.'
  }
];

/**
 * Resolves which Crew preset, Task Maker, Task Controller, Specialists, and Cloud VM
 * collaborators are dictated by the selected Target Repository.
 */
export function resolveRepoWorkforceProfile(repoName: string): RepoWorkforceProfile {
  const clean = (repoName || 'bingkltech/crewAI').trim();
  const exact = CURATED_TARGET_REPOS.find(
    (item) => item.displayRepo.toLowerCase() === clean.toLowerCase()
  );
  if (exact) return exact;

  const lower = clean.toLowerCase();
  if (lower.includes('infra') || lower.includes('devops') || lower.includes('sre') || lower.includes('k8s') || lower.includes('docker')) {
    return {
      ...CURATED_TARGET_REPOS[2],
      displayRepo: clean,
      label: 'Detected Infrastructure / DevOps Repository'
    };
  }
  if (lower.includes('fin') || lower.includes('audit') || lower.includes('risk') || lower.includes('ledger') || lower.includes('pay')) {
    return {
      ...CURATED_TARGET_REPOS[3],
      displayRepo: clean,
      label: 'Detected FinTech / Compliance Repository'
    };
  }
  if (lower.includes('doc') || lower.includes('content') || lower.includes('blog') || lower.includes('mdx')) {
    return {
      ...CURATED_TARGET_REPOS[4],
      displayRepo: clean,
      label: 'Detected Documentation / Content Repository'
    };
  }
  if (lower.includes('research') || lower.includes('benchmark') || lower === 'crewaiinc/crewai') {
    return {
      ...CURATED_TARGET_REPOS[1],
      displayRepo: clean,
      label: 'Detected AI Research & Framework Repository'
    };
  }

  return {
    ...CURATED_TARGET_REPOS[0],
    displayRepo: clean,
    label: clean === 'bingkltech/crewAI' ? CURATED_TARGET_REPOS[0].label : 'Full-Stack Application Repository'
  };
}
