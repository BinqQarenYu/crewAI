export type DocTab = 'docs' | 'studio' | 'graphs' | 'flows' | 'tools' | 'traces' | 'github';

export type LanguageCode = 'en' | 'ar' | 'ko' | 'pt-BR';
export type VersionCode = 'Edge' | 'v1.10.0';

export interface DocPage {
  id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  tags?: string[];
  content: string; // Markdown / structured content
  relatedPages?: string[];
  codeSnippets?: {
    language: string;
    title: string;
    code: string;
  }[];
}

export interface DocSection {
  title: string;
  icon?: string;
  pages: DocPage[];
}

export type AgentSpecialtyCategory =
  | 'task_maker'
  | 'task_controller'
  | 'research'
  | 'design'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'devops'
  | 'pm'
  | 'general';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  duties?: string[];
  category?: AgentSpecialtyCategory;
  model: string;
  tools: string[];
  verbose: boolean;
  memory: boolean;
  maxIter?: number;
  allowDelegation?: boolean;
}

export interface TaskConfig {
  id: string;
  name: string;
  description: string;
  expectedOutput: string;
  agentId: string;
  controllerAgentId?: string;
  phase?: string;
  asyncExecution?: boolean;
  humanReview?: boolean;
  outputFormat?: 'markdown' | 'json' | 'pydantic';
}

export interface CrewConfig {
  name: string;
  process: 'sequential' | 'hierarchical';
  managerModel?: string;
  verbose: boolean;
  memory: boolean;
  agents: AgentConfig[];
  tasks: TaskConfig[];
}

export type AuditCycleStage = 'orchestrator' | 'crew' | 'jules' | 'github';
export type AuditLogSeverity = 'info' | 'success' | 'warn' | 'error';

export interface ExecutionLog {
  id: string;
  timestamp: string;
  isoTimestamp?: string;
  traceId?: string;
  spanId?: string;
  stage?: AuditCycleStage;
  severity?: AuditLogSeverity;
  agentId?: string;
  agentName?: string;
  type:
    | 'thought'
    | 'tool_call'
    | 'tool_result'
    | 'delegation'
    | 'jules_vm'
    | 'jules_heal'
    | 'github_pr'
    | 'task_complete'
    | 'system';
  title: string;
  content: string;
  meta?: {
    toolName?: string;
    tokens?: number;
    durationMs?: number;
    model?: string;
    keySlot?: string;
    branch?: string;
    prNumber?: number;
    prUrl?: string;
    coveragePct?: number;
    exitCode?: number;
    repairedFault?: string;
    payload?: Record<string, unknown>;
  };
}

export interface FlowNode {
  id: string;
  name: string;
  type: 'start' | 'listen' | 'router' | 'crew_step' | 'end';
  description: string;
  dependencies?: string[];
  stateInput?: string;
  stateOutput?: string;
}

export interface FlowState {
  topic: string;
  researchSummary?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStepIndex: number;
  steps: {
    nodeId: string;
    status: 'pending' | 'running' | 'completed';
    output?: string;
    timestamp?: string;
  }[];
}

// --- Google Jules Autonomous DevOps & Coding Agent Types ---
export type JulesTaskType = 'test_and_pr' | 'generate_tests' | 'refactor_module' | 'custom_agent_task';
export type JulesVmTier = 'standard-4core' | 'highmem-8core' | 'gpu-t4';

export interface JulesLogEntry {
  timestamp: string;
  level: 'info' | 'vm' | 'test' | 'git' | 'success' | 'error';
  message: string;
}

export interface JulesTaskResult {
  taskId: string;
  taskType: JulesTaskType;
  status: 'completed' | 'failed';
  repo: string;
  branch: string;
  prUrl?: string;
  prNumber?: number;
  prTitle?: string;
  vmTier: string;
  durationMs: number;
  testsPassed: number;
  testsFailed: number;
  coverage?: string;
  diffSummary?: string;
  logs: JulesLogEntry[];
}

export interface JulesContext {
  targetType: 'crew' | 'module' | 'repo';
  targetName: string;
  targetPath?: string;
  codeSnippet?: string;
  suggestedPrompt?: string;
}
