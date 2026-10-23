import { CrewConfig, AgentConfig, TaskConfig, AgentSpecialtyCategory } from '../types';

export type AgentDomainCategory =
  | AgentSpecialtyCategory
  | 'frontend_architecture'
  | 'ui_ux'
  | 'devops_qa'
  | 'deep_research'
  | 'project_management';

export const WORKFLOW_AUTOSAVE_KEY = 'crewai_studio_workflow_autosave';

export interface GraphifyAlignedModule {
  id: string;
  name: string;
  path: string;
  layer: 'entry' | 'ui' | 'data' | 'types' | 'config';
  layerLabel: string;
  domainCategory: AgentDomainCategory;
  type: 'component' | 'store' | 'types' | 'config' | 'root';
  loc: number;
  description: string;
  inbound: string[];
  outbound: string[];
  exports: string[];
  x: number;
  y: number;
  // Dynamic alignment fields populated from the active Crew / LangGraph / Flow DAG
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentRole?: string;
  langGraphNodeId?: string;
  alignedTaskId?: string;
  alignedTaskName?: string;
  alignedTaskPhase?: string;
  flowDecorator?: string;
}

export interface AlignedFlowStepDef {
  id: string;
  taskId?: string;
  agentId?: string;
  agentName?: string;
  agentRole?: string;
  controllerAgentName?: string;
  type: 'start' | 'listen' | 'router' | 'and_step';
  title: string;
  decorator: string;
  phase?: string;
  description: string;
  expectedOutput?: string;
  dependsOnStepIds: string[];
  nextNodes: string[];
  graphifyModuleIds: string[];
  langGraphNodeId: string;
  outputStateChange: Record<string, any>;
  x: number;
  y: number;
  isOptimized?: boolean;
  optimizationSuggestion?: string;
}

export const GRAPHIFY_BASE_MODULES: GraphifyAlignedModule[] = [
  // Column 1: Entry, Host & Server Config (x: 50 - 270)
  {
    id: 'index-html',
    name: 'index.html',
    path: '/index.html',
    layer: 'config',
    layerLabel: 'Host & HTML',
    domainCategory: 'frontend_architecture',
    type: 'config',
    loc: 28,
    description: 'HTML5 application shell defining viewport, typography, and root mount container.',
    inbound: [],
    outbound: ['main-tsx'],
    exports: ['<div id="root">'],
    x: 40,
    y: 120
  },
  {
    id: 'main-tsx',
    name: 'main.tsx',
    path: '/src/main.tsx',
    layer: 'entry',
    layerLabel: 'Bootstrap Entry',
    domainCategory: 'frontend_architecture',
    type: 'root',
    loc: 16,
    description: 'React 19 root bootstrap mounting App and global CSS.',
    inbound: ['index-html'],
    outbound: ['app-tsx'],
    exports: ['createRoot'],
    x: 260,
    y: 120
  },
  {
    id: 'server-ts',
    name: 'server.ts',
    path: '/server.ts',
    layer: 'config',
    layerLabel: 'Express Backend',
    domainCategory: 'backend',
    type: 'config',
    loc: 3490,
    description: 'Full-stack Express API server: Gemini Quota Governor, GitHub PAT Git Trees push, Jules Cloud VM, Crew Execution status, and standalone.bat generator.',
    inbound: ['standalone-bat'],
    outbound: ['types-ts'],
    exports: ['ExpressApp', 'buildSelfExtractingStandaloneBat'],
    x: 260,
    y: 320
  },
  {
    id: 'standalone-bat',
    name: 'standalone.bat',
    path: '/standalone.bat',
    layer: 'config',
    layerLabel: 'Windows Launcher',
    domainCategory: 'devops_qa',
    type: 'config',
    loc: 130,
    description: 'Self-extracting Windows full-stack launcher embedding all frontend & backend files as a GZip+Base64 archive with -EncodedCommand unpacker.',
    inbound: [],
    outbound: ['server-ts', 'package-json'],
    exports: ['standalone.bat', 'start.bat'],
    x: 40,
    y: 320
  },
  {
    id: 'package-json',
    name: 'package.json',
    path: '/package.json',
    layer: 'config',
    layerLabel: 'Build Manifest',
    domainCategory: 'devops_qa',
    type: 'config',
    loc: 42,
    description: 'Full-stack dependency manifest (React 19, Express, Vite 6, Tailwind CSS 4, @google/genai, Lucide).',
    inbound: ['standalone-bat'],
    outbound: [],
    exports: ['scripts.dev', 'scripts.build'],
    x: 40,
    y: 470
  },

  // Column 2: Root Orchestrator & Unified Graph Engine (x: 500)
  {
    id: 'app-tsx',
    name: 'App.tsx',
    path: '/src/App.tsx',
    layer: 'ui',
    layerLabel: 'Root Orchestrator',
    domainCategory: 'frontend_architecture',
    type: 'component',
    loc: 320,
    description: 'Master application shell coordinating Crew Studio, LangGraph, Flow & Graphify, GitHub Hub, Tools Catalog, Observability, and global modals.',
    inbound: ['main-tsx'],
    outbound: [
      'navbar-tsx',
      'unified-alignment-bar-tsx',
      'crewstudio-tsx',
      'langgraph-tsx',
      'flowvisualizer-tsx',
      'githubhub-tsx',
      'toolscatalog-tsx',
      'traceviewer-tsx',
      'task-throttler-ts',
      'unified-graph-engine-ts'
    ],
    exports: ['App'],
    x: 490,
    y: 180
  },
  {
    id: 'unified-graph-engine-ts',
    name: 'unifiedGraphEngine.ts',
    path: '/src/utils/unifiedGraphEngine.ts',
    layer: 'data',
    layerLabel: 'Unified Graph Core',
    domainCategory: 'frontend_architecture',
    type: 'store',
    loc: 480,
    description: 'Single Source of Truth synchronizing Crew Task DAG, LangGraph StateGraph, CrewAI Event Flow DAG, and Graphify Repository Knowledge Graph.',
    inbound: [
      'app-tsx',
      'unified-alignment-bar-tsx',
      'crewstudio-tsx',
      'langgraph-tsx',
      'flowvisualizer-tsx',
      'graphify-repo-tsx'
    ],
    outbound: ['types-ts', 'repo-workforce-ts'],
    exports: [
      'buildAlignedFlowStepsFromCrew',
      'buildAlignedGraphifyModules',
      'mapAgentToGraphifyModules',
      'broadcastWorkflowSync'
    ],
    x: 490,
    y: 360
  },
  {
    id: 'task-throttler-ts',
    name: 'taskThrottler.ts',
    path: '/src/utils/taskThrottler.ts',
    layer: 'data',
    layerLabel: 'CPU & Poll Throttler',
    domainCategory: 'backend',
    type: 'store',
    loc: 340,
    description: 'Global background task concurrency queue, fetch request coalescer, TTL response cache, and adaptive frame-lag backoff governor.',
    inbound: ['app-tsx', 'navbar-tsx', 'crewstudio-tsx', 'progress-bar-tsx'],
    outbound: [],
    exports: ['globalTaskThrottler', 'useTaskThrottlerMetrics'],
    x: 490,
    y: 520
  },

  // Column 3: Synchronized Graph & Studio Views (x: 780)
  {
    id: 'navbar-tsx',
    name: 'Navbar.tsx',
    path: '/src/components/Navbar.tsx',
    layer: 'ui',
    layerLabel: 'Workspace Header',
    domainCategory: 'ui_ux',
    type: 'component',
    loc: 620,
    description: 'Streamlined top navigation bar with primary workspace switcher, AI Runtime & Resource drawer, search, and 1-click GitHub push.',
    inbound: ['app-tsx'],
    outbound: ['types-ts', 'task-throttler-ts', 'notificationcenter-tsx'],
    exports: ['Navbar'],
    x: 780,
    y: 30
  },
  {
    id: 'unified-alignment-bar-tsx',
    name: 'UnifiedGraphAlignmentBar.tsx',
    path: '/src/components/UnifiedGraphAlignmentBar.tsx',
    layer: 'ui',
    layerLabel: '4-Graph Sync Bar',
    domainCategory: 'ui_ux',
    type: 'component',
    loc: 240,
    description: 'Live cross-graph alignment strip linking Crew Task DAG, LangGraph StateGraph, Event Flow DAG, and Graphify Repo Modules.',
    inbound: ['app-tsx', 'crewstudio-tsx', 'langgraph-tsx', 'flowvisualizer-tsx'],
    outbound: ['unified-graph-engine-ts', 'types-ts'],
    exports: ['UnifiedGraphAlignmentBar'],
    x: 780,
    y: 125
  },
  {
    id: 'crewstudio-tsx',
    name: 'CrewStudio.tsx',
    path: '/src/components/CrewStudio.tsx',
    layer: 'ui',
    layerLabel: 'Crew Studio Workbench',
    domainCategory: 'project_management',
    type: 'component',
    loc: 5220,
    description: 'Interactive multi-agent studio with 8-Agent Full-Stack preset, Task Makers & Controllers, real-time progress bar, and live kickoff simulator.',
    inbound: ['app-tsx'],
    outbound: [
      'task-dag-tsx',
      'progress-bar-tsx',
      'unified-graph-engine-ts',
      'repo-workforce-ts',
      'types-ts'
    ],
    exports: ['CrewStudio', 'PRESET_CREWS'],
    x: 780,
    y: 225
  },
  {
    id: 'task-dag-tsx',
    name: 'TaskDependencyGraphVisualizer.tsx',
    path: '/src/components/TaskDependencyGraphVisualizer.tsx',
    layer: 'ui',
    layerLabel: 'Task Dependency DAG',
    domainCategory: 'frontend_architecture',
    type: 'component',
    loc: 610,
    description: 'Interactive SVG Bezier dependency graph & sequence snake canvas allowing users to wire upstream/downstream task dependencies and controller gates.',
    inbound: ['crewstudio-tsx'],
    outbound: ['types-ts'],
    exports: ['TaskDependencyGraphVisualizer'],
    x: 780,
    y: 325
  },
  {
    id: 'langgraph-tsx',
    name: 'LangGraphView.tsx',
    path: '/src/components/LangGraphView.tsx',
    layer: 'ui',
    layerLabel: 'LangGraph StateGraph',
    domainCategory: 'backend',
    type: 'component',
    loc: 2940,
    description: 'Stateful multi-actor graph engine synced with Crew Task DAG & Graphify modules, supporting cyclic reflection, supervisor routing, and time-travel checkpoints.',
    inbound: ['app-tsx'],
    outbound: ['unified-graph-engine-ts', 'types-ts'],
    exports: ['LangGraphView'],
    x: 780,
    y: 425
  },
  {
    id: 'flowvisualizer-tsx',
    name: 'FlowVisualizer.tsx',
    path: '/src/components/FlowVisualizer.tsx',
    layer: 'ui',
    layerLabel: 'Event Flow DAG',
    domainCategory: 'project_management',
    type: 'component',
    loc: 840,
    description: 'Deterministic event-driven Flow DAG (@start, @listen, @router) dynamically compiled from the active Crew & Task Dependency DAG.',
    inbound: ['app-tsx'],
    outbound: ['graphify-repo-tsx', 'unified-graph-engine-ts', 'types-ts'],
    exports: ['FlowVisualizer'],
    x: 780,
    y: 525
  },
  {
    id: 'graphify-repo-tsx',
    name: 'GraphifyRepoVisualizer.tsx',
    path: '/src/components/GraphifyRepoVisualizer.tsx',
    layer: 'ui',
    layerLabel: 'Graphify Repo Graph',
    domainCategory: 'deep_research',
    type: 'component',
    loc: 1120,
    description: 'Whole-repository architecture graph mapping every codebase file to its assigned CrewAI Agent, LangGraph Actor node, and Task DAG step.',
    inbound: ['flowvisualizer-tsx'],
    outbound: ['unified-graph-engine-ts', 'types-ts'],
    exports: ['GraphifyRepoVisualizer'],
    x: 780,
    y: 625
  },
  {
    id: 'progress-bar-tsx',
    name: 'CrewExecutionProgressBar.tsx',
    path: '/src/components/CrewExecutionProgressBar.tsx',
    layer: 'ui',
    layerLabel: 'Real-Time Progress HUD',
    domainCategory: 'ui_ux',
    type: 'component',
    loc: 380,
    description: 'Live execution progress bar syncing active agents, task percentages, and background throttler telemetry.',
    inbound: ['crewstudio-tsx'],
    outbound: ['task-throttler-ts', 'types-ts'],
    exports: ['CrewExecutionProgressBar'],
    x: 780,
    y: 725
  },
  {
    id: 'githubhub-tsx',
    name: 'GitHubHub.tsx',
    path: '/src/components/GitHubHub.tsx',
    layer: 'ui',
    layerLabel: 'GitHub & Workforce Hub',
    domainCategory: 'devops_qa',
    type: 'component',
    loc: 1510,
    description: 'GitHub PAT connector, target repository workforce selector, full-app atomic Git Trees push, and standalone.bat downloader.',
    inbound: ['app-tsx'],
    outbound: ['repo-workforce-ts', 'types-ts'],
    exports: ['GitHubHub'],
    x: 780,
    y: 825
  },

  // Column 4: Domain Contracts, Workforce Mapping & Observability (x: 1110)
  {
    id: 'repo-workforce-ts',
    name: 'repoWorkforceMapping.ts',
    path: '/src/utils/repoWorkforceMapping.ts',
    layer: 'data',
    layerLabel: 'Repo Workforce Map',
    domainCategory: 'project_management',
    type: 'store',
    loc: 290,
    description: 'Maps target GitHub repositories to specialized Crew presets, Task Makers, Task Controllers, and domain specialists.',
    inbound: ['crewstudio-tsx', 'githubhub-tsx', 'unified-graph-engine-ts'],
    outbound: ['types-ts'],
    exports: ['resolveRepoWorkforceProfile', 'CURATED_TARGET_REPOS'],
    x: 1110,
    y: 140
  },
  {
    id: 'types-ts',
    name: 'types.ts',
    path: '/src/types.ts',
    layer: 'types',
    layerLabel: 'TypeScript Contracts',
    domainCategory: 'database',
    type: 'types',
    loc: 185,
    description: 'Shared TypeScript interfaces for AgentConfig, TaskConfig (dependsOnTaskIds, controllerAgentId), CrewConfig, LangGraph, and Flows.',
    inbound: [
      'app-tsx',
      'crewstudio-tsx',
      'task-dag-tsx',
      'langgraph-tsx',
      'flowvisualizer-tsx',
      'graphify-repo-tsx',
      'unified-graph-engine-ts'
    ],
    outbound: [],
    exports: ['CrewConfig', 'AgentConfig', 'TaskConfig', 'DocTab'],
    x: 1110,
    y: 280
  },
  {
    id: 'toolscatalog-ts',
    name: 'toolsCatalog.ts',
    path: '/src/data/toolsCatalog.ts',
    layer: 'data',
    layerLabel: '18+ Agent Tools',
    domainCategory: 'deep_research',
    type: 'store',
    loc: 240,
    description: 'Tool registry for SerperDevTool, GithubSearchTool, CodeInterpreterTool, PostgresDatabaseTool, PlaywrightBrowserTool, etc.',
    inbound: ['crewstudio-tsx', 'toolscatalog-tsx'],
    outbound: [],
    exports: ['TOOLS_CATALOG'],
    x: 1110,
    y: 420
  },
  {
    id: 'traceviewer-tsx',
    name: 'TraceViewer.tsx',
    path: '/src/components/TraceViewer.tsx',
    layer: 'ui',
    layerLabel: 'OpenTelemetry Traces',
    domainCategory: 'devops_qa',
    type: 'component',
    loc: 260,
    description: 'OpenTelemetry span waterfall, token audit telemetry, and latency inspector.',
    inbound: ['app-tsx'],
    outbound: ['types-ts'],
    exports: ['TraceViewer'],
    x: 1110,
    y: 560
  },
  {
    id: 'notificationcenter-tsx',
    name: 'NotificationCenter.tsx',
    path: '/src/components/NotificationCenter.tsx',
    layer: 'ui',
    layerLabel: 'PR & Alert Center',
    domainCategory: 'devops_qa',
    type: 'component',
    loc: 275,
    description: 'Real-time notification center for autonomous Jules PRs and workflow completions.',
    inbound: ['navbar-tsx'],
    outbound: ['types-ts'],
    exports: ['NotificationCenter'],
    x: 1110,
    y: 700
  }
];

/**
 * Infers an AgentDomainCategory from an AgentConfig's explicit category, role, or name.
 */
export function inferAgentDomainCategory(agent?: AgentConfig): AgentDomainCategory {
  if (!agent) return 'general';
  if (agent.category) {
    switch (agent.category) {
      case 'design':
        return 'ui_ux';
      case 'frontend':
        return 'frontend_architecture';
      case 'backend':
        return 'backend';
      case 'database':
        return 'database';
      case 'devops':
      case 'task_controller':
        return 'devops_qa';
      case 'research':
        return 'deep_research';
      case 'pm':
      case 'task_maker':
        return 'project_management';
      default:
        break;
    }
  }
  const text = `${agent.name} ${agent.role} ${agent.goal}`.toLowerCase();
  if (text.includes('ui') || text.includes('ux') || text.includes('design')) return 'ui_ux';
  if (text.includes('front') || text.includes('react') || text.includes('component') || text.includes('dag')) {
    return 'frontend_architecture';
  }
  if (text.includes('database') || text.includes('data') || text.includes('schema') || text.includes('sql')) {
    return 'database';
  }
  if (text.includes('back') || text.includes('api') || text.includes('server') || text.includes('orchestrat')) {
    return 'backend';
  }
  if (text.includes('devops') || text.includes('security') || text.includes('qa') || text.includes('audit') || text.includes('test')) {
    return 'devops_qa';
  }
  if (text.includes('research') || text.includes('benchmark') || text.includes('analyst')) {
    return 'deep_research';
  }
  if (text.includes('product') || text.includes('manager') || text.includes('maker') || text.includes('scrum') || text.includes('lead')) {
    return 'project_management';
  }
  return 'general';
}

/**
 * Maps an Agent (and optional Task) to the exact Graphify Repository Module IDs it owns, reads, or mutates.
 */
export function mapAgentToGraphifyModules(agent?: AgentConfig, task?: TaskConfig): string[] {
  const cat = inferAgentDomainCategory(agent);
  const taskText = `${task?.name || ''} ${task?.description || ''} ${task?.phase || ''}`.toLowerCase();

  const matched = new Set<string>();

  for (const mod of GRAPHIFY_BASE_MODULES) {
    if (mod.domainCategory === cat) {
      matched.add(mod.id);
    }
  }

  // Task-specific keyword enrichment
  if (taskText.includes('graph') || taskText.includes('dag') || taskText.includes('topology')) {
    matched.add('task-dag-tsx');
    matched.add('langgraph-tsx');
    matched.add('flowvisualizer-tsx');
    matched.add('graphify-repo-tsx');
    matched.add('unified-graph-engine-ts');
  }
  if (taskText.includes('ui') || taskText.includes('ux') || taskText.includes('design') || taskText.includes('navbar')) {
    matched.add('navbar-tsx');
    matched.add('unified-alignment-bar-tsx');
    matched.add('progress-bar-tsx');
  }
  if (taskText.includes('api') || taskText.includes('server') || taskText.includes('backend') || taskText.includes('endpoint')) {
    matched.add('server-ts');
    matched.add('task-throttler-ts');
  }
  if (taskText.includes('schema') || taskText.includes('type') || taskText.includes('database') || taskText.includes('state')) {
    matched.add('types-ts');
    matched.add('unified-graph-engine-ts');
  }
  if (taskText.includes('deploy') || taskText.includes('ci/cd') || taskText.includes('release') || taskText.includes('github') || taskText.includes('bat')) {
    matched.add('githubhub-tsx');
    matched.add('standalone-bat');
    matched.add('traceviewer-tsx');
  }

  if (matched.size === 0) {
    matched.add('crewstudio-tsx');
    matched.add('unified-graph-engine-ts');
  }

  return Array.from(matched);
}

/**
 * Enriches the 22 Graphify Repository Modules with live ownership from the active CrewConfig,
 * linking every file in the repository to its Assigned CrewAI Agent, LangGraph Actor Node, and Workflow DAG Task.
 */
export function buildAlignedGraphifyModules(crew: CrewConfig): GraphifyAlignedModule[] {
  const agents = crew.agents || [];
  const tasks = crew.tasks || [];

  return GRAPHIFY_BASE_MODULES.map((mod) => {
    // Find best matching agent for this module's domainCategory
    let matchedAgent = agents.find((a) => inferAgentDomainCategory(a) === mod.domainCategory);
    if (!matchedAgent) {
      // Fallback deterministic assignment across available agents
      const idx = GRAPHIFY_BASE_MODULES.indexOf(mod) % Math.max(1, agents.length);
      matchedAgent = agents[idx];
    }

    // Find task assigned to this agent (or matching module domain)
    const matchedTaskIdx = tasks.findIndex((t) => t.agentId === matchedAgent?.id);
    const matchedTask = matchedTaskIdx >= 0 ? tasks[matchedTaskIdx] : tasks[0];
    const isRootTask =
      matchedTaskIdx === 0 ||
      !(matchedTask?.dependsOnTaskIds && matchedTask.dependsOnTaskIds.length > 0);
    const hasController = Boolean(matchedTask?.controllerAgentId);

    const fnSlug = toPythonIdentifier(matchedTask?.name || mod.name, matchedTaskIdx >= 0 ? matchedTaskIdx : 0);
    const decorator = isRootTask
      ? '@start()'
      : hasController
      ? `@router(${fnSlug}_gate)`
      : `@listen(upstream_${matchedTaskIdx})`;

    return {
      ...mod,
      assignedAgentId: matchedAgent?.id,
      assignedAgentName: matchedAgent?.name || 'Autonomous Specialist',
      assignedAgentRole: matchedAgent?.role || 'Core Architect',
      langGraphNodeId: matchedAgent ? `actor_${matchedAgent.id}` : '__start__',
      alignedTaskId: matchedTask?.id,
      alignedTaskName: matchedTask?.name || 'Module Synthesis',
      alignedTaskPhase: matchedTask?.phase || `Step ${(matchedTaskIdx >= 0 ? matchedTaskIdx : 0) + 1}`,
      flowDecorator: decorator
    };
  });
}

export function toPythonIdentifier(raw: string, fallbackIndex = 0): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/phase\s*\d+\s*[:\-]?\s*/gi, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned || /^\d/.test(cleaned)) {
    return `step_${fallbackIndex + 1}_${cleaned || 'task'}`;
  }
  return cleaned.slice(0, 34);
}

/**
 * Deterministically compiles the active CrewConfig (its Agents, Tasks, `dependsOnTaskIds` DAG, and `controllerAgentId` gates)
 * into an Aligned Event-Driven Flow DAG (`@start()`, `@listen()`, `@router()`) with Graphify module bindings.
 */
export function buildAlignedFlowStepsFromCrew(
  crew: CrewConfig,
  selectedRepo = 'bingkltech/crewAI'
): AlignedFlowStepDef[] {
  const tasks = crew.tasks || [];
  const agents = crew.agents || [];
  if (tasks.length === 0) return [];

  // Compute topological depth for each task based on `dependsOnTaskIds`
  const taskById = new Map<string, TaskConfig>();
  tasks.forEach((t) => taskById.set(t.id, t));

  const depthMap = new Map<string, number>();
  const visiting = new Set<string>();

  const getDepth = (taskId: string, idx: number): number => {
    if (depthMap.has(taskId)) return depthMap.get(taskId)!;
    if (visiting.has(taskId)) return idx;
    visiting.add(taskId);
    const t = taskById.get(taskId);
    const validDeps = (t?.dependsOnTaskIds || []).filter((d) => taskById.has(d) && d !== taskId);
    let d = 0;
    if (validDeps.length > 0) {
      d = Math.max(...validDeps.map((depId) => getDepth(depId, idx) + 1));
    } else if (idx > 0 && !tasks.some((item) => (item.dependsOnTaskIds || []).length > 0)) {
      // If crew has no explicit dependsOnTaskIds, use sequential index
      d = idx;
    }
    visiting.delete(taskId);
    depthMap.set(taskId, d);
    return d;
  };

  tasks.forEach((t, idx) => getDepth(t.id, idx));

  // Group tasks by topological layer for clean 2D DAG coordinates
  const layers = new Map<number, TaskConfig[]>();
  tasks.forEach((t) => {
    const l = depthMap.get(t.id) ?? 0;
    const list = layers.get(l) || [];
    list.push(t);
    layers.set(l, list);
  });

  const stepIdByTaskId = new Map<string, string>();
  const fnNameByTaskId = new Map<string, string>();
  tasks.forEach((t, idx) => {
    stepIdByTaskId.set(t.id, `flow_${t.id}`);
    fnNameByTaskId.set(t.id, toPythonIdentifier(t.name, idx));
  });

  // Count how many downstream tasks depend on each task
  const downstreamMap = new Map<string, string[]>();
  tasks.forEach((t) => downstreamMap.set(t.id, []));
  tasks.forEach((t, idx) => {
    const explicitDeps = (t.dependsOnTaskIds || []).filter((d) => taskById.has(d) && d !== t.id);
    if (explicitDeps.length > 0) {
      explicitDeps.forEach((depId) => {
        downstreamMap.get(depId)?.push(t.id);
      });
    } else if (idx > 0) {
      const prevTask = tasks[idx - 1];
      downstreamMap.get(prevTask.id)?.push(t.id);
    }
  });

  const steps: AlignedFlowStepDef[] = [];

  tasks.forEach((task, idx) => {
    const agent = agents.find((a) => a.id === task.agentId) || agents[idx % Math.max(1, agents.length)];
    const controller = task.controllerAgentId
      ? agents.find((a) => a.id === task.controllerAgentId)
      : undefined;

    const explicitDeps = (task.dependsOnTaskIds || []).filter((d) => taskById.has(d) && d !== task.id);
    const effectiveDepTaskIds =
      explicitDeps.length > 0 ? explicitDeps : idx > 0 ? [tasks[idx - 1].id] : [];

    const depFnNames = effectiveDepTaskIds.map((dId) => fnNameByTaskId.get(dId) || 'start_flow');
    const downstreamTaskIds = downstreamMap.get(task.id) || [];
    const fnName = fnNameByTaskId.get(task.id) || `step_${idx + 1}`;

    let stepType: AlignedFlowStepDef['type'] = 'listen';
    let decorator = `@listen(${depFnNames[0] || 'init'})`;

    if (effectiveDepTaskIds.length === 0) {
      stepType = 'start';
      decorator = '@start()';
    } else if (effectiveDepTaskIds.length > 1) {
      stepType = 'and_step';
      decorator = `@listen(and_(${depFnNames.join(', ')}))`;
    } else if (controller || downstreamTaskIds.length > 1) {
      stepType = 'router';
      decorator = `@router(${depFnNames[0]})`;
    }

    const layerIdx = depthMap.get(task.id) ?? idx;
    const layerTasks = layers.get(layerIdx) || [task];
    const posInLayer = layerTasks.findIndex((item) => item.id === task.id);

    // Arrange in a readable multi-column / multi-row grid
    const col = layerIdx % 3;
    const rowBand = Math.floor(layerIdx / 3);
    const x = 45 + col * 355;
    const y = 45 + rowBand * 220 + posInLayer * 165;

    const graphifyMods = mapAgentToGraphifyModules(agent, task);
    const nextStepIds = downstreamTaskIds.map((dId) => stepIdByTaskId.get(dId)!).filter(Boolean);

    steps.push({
      id: stepIdByTaskId.get(task.id)!,
      taskId: task.id,
      agentId: agent?.id,
      agentName: agent?.name || 'Specialist',
      agentRole: agent?.role || 'Agent',
      controllerAgentName: controller?.name,
      type: stepType,
      title: `${fnName}()`,
      decorator,
      phase: task.phase || `Stage ${idx + 1}`,
      description: `${agent?.name || 'Agent'} (${agent?.role || 'Specialist'}): ${task.description}`,
      expectedOutput: task.expectedOutput,
      dependsOnStepIds: effectiveDepTaskIds.map((dId) => stepIdByTaskId.get(dId)!).filter(Boolean),
      nextNodes: nextStepIds.length > 0 ? nextStepIds : ['flow_sync_graphify'],
      graphifyModuleIds: graphifyMods,
      langGraphNodeId: agent ? `actor_${agent.id}` : '__start__',
      isOptimized: idx % 3 === 0,
      optimizationSuggestion: idx % 3 === 0 ? `Jules recommends refactoring this agent step into two asynchronous tasks to reduce latency by ~25% and improve test coverage.` : undefined,
      outputStateChange: {
        [`${fnName}_status`]: 'verified',
        active_agent: `${agent?.name} (${agent?.role})`,
        ...(controller ? { controller_gate_passed: `${controller.name} [APPROVED]` } : {}),
        graphify_modules_updated: graphifyMods,
        deliverable_format: task.outputFormat || 'markdown'
      },
      x,
      y
    });
  });

  // Terminal step: Graphify Whole-Repo Knowledge Sync & GitHub Release
  const maxY = steps.reduce((acc, s) => Math.max(acc, s.y), 45);
  const terminalTasks = steps.filter((s) => s.nextNodes.includes('flow_sync_graphify'));
  const terminalFnNames = terminalTasks.map((s) => s.title.replace(/\(\)$/, '')).slice(0, 3);
  const syncDecorator =
    terminalFnNames.length > 1
      ? `@listen(and_(${terminalFnNames.join(', ')}))`
      : `@listen(${terminalFnNames[0] || 'final_task'})`;

  steps.push({
    id: 'flow_sync_graphify',
    type: 'listen',
    title: 'sync_graphify_and_release()',
    decorator: syncDecorator,
    phase: 'Graphify & Release Gate',
    agentName: 'Graphify & GitHub Gatekeeper',
    agentRole: 'Whole-Repo Architecture Synchronizer',
    description: `Synchronizes all ${GRAPHIFY_BASE_MODULES.length} repository modules in Graphify, updates LangGraph MemorySaver checkpoint state, and publishes verified branch to ${selectedRepo}.`,
    dependsOnStepIds: terminalTasks.map((t) => t.id),
    nextNodes: [],
    graphifyModuleIds: ['unified-graph-engine-ts', 'graphify-repo-tsx', 'githubhub-tsx', 'standalone-bat'],
    langGraphNodeId: '__end__',
    outputStateChange: {
      graphify_sync_status: 'synced',
      knowledge_graph_nodes: GRAPHIFY_BASE_MODULES.length,
      langgraph_checkpoint_committed: true,
      target_repository: selectedRepo,
      standalone_bat_bundle: 'up_to_date'
    },
    x: 400,
    y: Math.min(760, maxY + 185)
  });

  return steps;
}

/**
 * Generates runnable Python code for CrewAI Flow (`@start`, `@listen`, `@router`) that is 100% aligned
 * with the active Crew's tasks, `dependsOnTaskIds` dependencies, and Graphify modules.
 */
export function generateAlignedFlowPythonCode(
  crew: CrewConfig,
  steps: AlignedFlowStepDef[],
  selectedRepo = 'bingkltech/crewAI'
): string {
  const repoSlug = selectedRepo.split('/')[1] || 'crewai_app';
  const classSlug =
    (crew.name || 'AlignedCrew')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('') + 'Flow';

  const methodBlocks = steps
    .map((step) => {
      const fnName = step.title.replace(/\(\)$/, '');
      const modsComment =
        step.graphifyModuleIds.length > 0
          ? `\n        # Graphify Modules Touched: ${step.graphifyModuleIds.join(', ')}`
          : '';
      const ctrlComment = step.controllerAgentName
        ? `\n        # Controller Gate: Verified by ${step.controllerAgentName}`
        : '';
      return `    ${step.decorator}
    def ${fnName}(self):
        """${step.phase || 'Flow Step'} — ${step.agentName || 'System'} (${step.agentRole || 'Actor'})"""${modsComment}${ctrlComment}
        self.state.completed_steps.append("${fnName}")
        self.state.graphify_touched_modules.extend(${JSON.stringify(step.graphifyModuleIds)})
        return "${fnName}_verified"`;
    })
    .join('\n\n');

  return `from crewai.flow.flow import Flow, start, listen, router, and_
from pydantic import BaseModel, Field

class AlignedFlowState(BaseModel):
    project_name: str = "${repoSlug}"
    crew_name: str = "${crew.name}"
    process_mode: str = "${crew.process}"
    completed_steps: list[str] = Field(default_factory=list)
    graphify_touched_modules: list[str] = Field(default_factory=list)
    langgraph_thread_synced: bool = True

class ${classSlug}(Flow[AlignedFlowState]):
    """
    Auto-aligned CrewAI Event Flow generated from:
    - Crew Studio Task Dependency DAG (${crew.tasks.length} tasks, ${crew.agents.length} agents)
    - LangGraph StateGraph Topology
    - Graphify Whole-Repository Knowledge Graph (${GRAPHIFY_BASE_MODULES.length} modules)
    """

${methodBlocks}

if __name__ == "__main__":
    flow = ${classSlug}()
    flow.kickoff()`;
}

/**
 * Broadcasts workflow changes across Crew Studio, LangGraph, FlowVisualizer, and GraphifyRepoVisualizer
 * so all 4 graph engines stay in real-time lockstep.
 */
export function broadcastWorkflowSync(payload: {
  activePreset: string;
  crew: CrewConfig;
  selectedAgentId?: string;
  runInput?: string;
}) {
  try {
    const existingRaw = localStorage.getItem(WORKFLOW_AUTOSAVE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = {
      ...existing,
      activePreset: payload.activePreset,
      crew: payload.crew,
      selectedAgentId: payload.selectedAgentId || payload.crew.agents[0]?.id || '',
      runInput: payload.runInput ?? existing.runInput ?? 'Build an Enterprise SaaS Multi-Agent Control Plane',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(WORKFLOW_AUTOSAVE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('crewai:workflow-synced', { detail: merged }));
  } catch {
    // ignore storage errors
  }
}
