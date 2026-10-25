export interface ConstitutionalArticle {
  id: string;
  code: string;
  title: string;
  category: 'Runtime Safety' | 'Documentation Integrity' | 'Git & Data Security' | 'Quota Governance' | 'Verification & Quality' | 'Graph Architecture';
  severity: 'CRITICAL' | 'HIGH';
  immutable: boolean;
  summary: string;
  rationale: string;
  requiredInvariant: string;
  forbiddenPatterns: string[];
  canonicalSnippet: string;
  sha256Fingerprint: string;
}

export interface ConstitutionalViolation {
  articleId: string;
  articleCode: string;
  articleTitle: string;
  category: ConstitutionalArticle['category'];
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  matchedTrigger: string;
  conflictExplanation: string;
  remediationDirective: string;
}

export interface ConstitutionalAuditReport {
  auditId: string;
  timestamp: string;
  actor: 'Jules Autonomous Agent' | 'Crew Studio Orchestrator' | 'Constitutional Auditor';
  proposedGoal: string;
  testCommand?: string;
  targetPath?: string;
  status: 'COMPLIANT' | 'BLOCKED' | 'WARNING';
  complianceScore: number;
  constitutionRootHash: string;
  violations: ConstitutionalViolation[];
  passedArticleIds: string[];
  remediatedGoal: string;
  remediatedTestCommand: string;
}

export interface CustomConstitutionalRule {
  id: string;
  code: string;
  title: string;
  forbiddenKeyword: string;
  requiredReplacement: string;
  rationale: string;
  createdAt: string;
}

export const IMMUTABLE_CONSTITUTION_ARTICLES: ConstitutionalArticle[] = [
  {
    id: 'art-01',
    code: 'CONST-01',
    title: 'Multimodal LLMMessage.content Type-Safety Invariant',
    category: 'Runtime Safety',
    severity: 'CRITICAL',
    immutable: true,
    summary:
      'Never call str() on LLMMessage.content (str | list[dict[str, Any]] | None). Always collapse messages via message_content_text(msg).',
    rationale:
      'Calling str(msg.content) serializes multimodal content lists into raw Python repr strings (e.g. "[{\'type\': \'text\', \'text\': \'hi\'}]") that corrupt agent memory, context windows, and downstream prompts.',
    requiredInvariant:
      'Use from crewai.utilities.agent_utils import message_content_text; text = message_content_text(msg) which safely collapses None to "" and non-text multimodal parts to "[multimodal content]".',
    forbiddenPatterns: [
      'str(msg.content)',
      'str(message.content)',
      'str(llm_message.content)',
      'f"{msg.content}"',
      'str(content)'
    ],
    canonicalSnippet: `from crewai.utilities.agent_utils import message_content_text\n\ntext = message_content_text(msg)  # "" for None; joined text for multimodal parts`,
    sha256Fingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
  },
  {
    id: 'art-02',
    code: 'CONST-02',
    title: 'Frozen Documentation Snapshots & Image Asset Immutability',
    category: 'Documentation Integrity',
    severity: 'CRITICAL',
    immutable: true,
    summary:
      'Never modify frozen release snapshots under docs/v*/ or delete/rename files under docs/images/. Edit docs/edge/en/* and sync ar, ko, and pt-BR.',
    rationale:
      'Files under docs/v*/ are immutable historical release snapshots managed by devtools, and frozen snapshots reference paths in docs/images/. Altering or deleting them breaks historical documentation builds.',
    requiredInvariant:
      'Target documentation edits exclusively to docs/edge/en/*, register new pages in docs/docs.json, preserve all assets in docs/images/, and synchronize translations to ar, ko, and pt-BR.',
    forbiddenPatterns: [
      'docs/v0.',
      'docs/v1.',
      'docs/v2.',
      'rm docs/images',
      'delete docs/images',
      'rename docs/images',
      'git rm docs/images'
    ],
    canonicalSnippet: `# Edit English edge docs only & sync translations:\n# 1. Modify docs/edge/en/<page>.mdx\n# 2. Sync docs/edge/{ar,ko,pt-BR}/<page>.mdx\n# 3. Verify via: cd docs && mintlify broken-links`,
    sha256Fingerprint: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce'
  },
  {
    id: 'art-03',
    code: 'CONST-03',
    title: 'Zero-Destructive Git, SQLite ACID & Secret Isolation',
    category: 'Git & Data Security',
    severity: 'CRITICAL',
    immutable: true,
    summary:
      'Autonomous agents (Jules) must never force-push (git push --force), execute destructive filesystem wipes (rm -rf), drop SQLite/production tables, or exfiltrate .env / PAT secrets.',
    rationale:
      'Jules operates with autonomous repository and sandbox privileges. Destructive git history rewrites, unguarded table drops, or secret leakage violate workspace safety and auditability.',
    requiredInvariant:
      'Always push to feature or verified branches with signed commits, use parameterized read/upsert SQL queries on .crewai-fullstack.db, and keep API keys/PATs strictly isolated.',
    forbiddenPatterns: [
      'git push --force',
      'git push -f',
      'rm -rf /',
      'rm -rf .',
      'DROP TABLE',
      'TRUNCATE TABLE',
      'print(os.environ)',
      'curl .env',
      'exfiltrate'
    ],
    canonicalSnippet: `# Safe autonomous branch workflow:\ngit checkout -b jules/verified-fix\npytest tests/ -v\ngit commit -S -m "fix: verified behavioral update"`,
    sha256Fingerprint: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b'
  },
  {
    id: 'art-04',
    code: 'CONST-04',
    title: 'Patient Token-Bucket Quota & Zero-429 Failover Governance',
    category: 'Quota Governance',
    severity: 'HIGH',
    immutable: true,
    summary:
      'Never bypass the Patient Quota Governor or flood unthrottled parallel LLM loops. Always pace requests and fall back to the local/free Ollama pool when Gemini credits are conserved.',
    rationale:
      'Unbounded parallel LLM loops trigger HTTP 429 rate-limit lockouts and exhaust API credits. We have all the time in the world: pacing requests and failing over to Ollama guarantees 100% completion without hitting limits.',
    requiredInvariant:
      'Route all model calls through the Patient Token Bucket Governor (10 RPM pacing) with automatic failover to the verified Ollama multi-node pool.',
    forbiddenPatterns: [
      'bypass rate limit',
      'disable throttle',
      'disable quota governor',
      'ignore 429',
      'unthrottled loop',
      'while True: llm.call',
      'disable ollama fallback'
    ],
    canonicalSnippet: `// Patient Quota Governor invariant:\n// Pace requests at <=10 RPM, wait patiently when bucket is refilling,\n// and automatically fail over to Ollama pool if Gemini quota is exhausted.`,
    sha256Fingerprint: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35'
  },
  {
    id: 'art-05',
    code: 'CONST-05',
    title: 'Behavioral Unit Testing & Minimal Diff Discipline (DRY / YAGNI)',
    category: 'Verification & Quality',
    severity: 'HIGH',
    immutable: true,
    summary:
      'Never skip unit tests (--no-verify), hardcode fake pass assertions, or rewrite unrelated modules. Write behavioral unit tests and keep diffs minimal.',
    rationale:
      'Engineering quality in CrewAI OSS requires testing observable behavior rather than private implementation internals, adhering to DRY and YAGNI, and keeping diffs minimal and reviewable.',
    requiredInvariant:
      'Every autonomous task must run real behavioral unit tests (pytest / unittest) with exit code 0 and scope changes strictly to the target module.',
    forbiddenPatterns: [
      '--no-verify',
      'skip tests',
      'without running tests',
      'delete all tests',
      'pytest --collect-only',
      'rewrite entire codebase',
      'ignore unit tests'
    ],
    canonicalSnippet: `def test_agent_collapses_multimodal_message_behavior():\n    msg = {"role": "user", "content": [{"type": "text", "text": "hello"}]}\n    assert message_content_text(msg) == "hello"`,
    sha256Fingerprint: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d'
  },
  {
    id: 'art-06',
    code: 'CONST-06',
    title: '4-Graph DAG Acyclicity & ACID State Synchronization',
    category: 'Graph Architecture',
    severity: 'HIGH',
    immutable: true,
    summary:
      'Autonomous workflow mutations must never introduce cyclic task dependencies or desynchronize the 4 unified graphs (Task DAG, LangGraph, Flow DAG, Graphify AST).',
    rationale:
      'CrewAI Studio orchestrates multi-agent execution across four synchronized graph representations backed by SQLite. Introducing circular dependencies deadlocks the orchestrator.',
    requiredInvariant:
      'Verify topological sort acyclicity before dispatching any Crew or Flow mutation and persist updated state atomically to SQLite.',
    forbiddenPatterns: [
      'circular dependency',
      'infinite task loop',
      'cyclic dag',
      'self-dependency',
      'desync graph',
      'bypass dag validation'
    ],
    canonicalSnippet: `// Topological DAG verification:\n// Ensure inDegree === 0 entry nodes exist and visitedCount === tasks.length`,
    sha256Fingerprint: 'e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683'
  }
];

export const CONSTITUTION_ROOT_HASH =
  'sha256:8c4f9b2e1d7a6053c9e8b47f21a0d6e5f3b8c9a12e4d7f6b0c3a9e2d1f4b7a6c';

interface RuleDetector {
  articleCode: string;
  regex: RegExp;
  matchedLabel: string;
  explanation: string;
  remediationDirective: string;
  rewriteFn: (input: string) => string;
}

const RULE_DETECTORS: RuleDetector[] = [
  {
    articleCode: 'CONST-01',
    regex: /\bstr\s*\(\s*(?:msg|message|llm_message|item)?\.?content\s*\)|str\(\s*LLMMessage\.content\s*\)|cast\s+LLMMessage\.content\s+with\s+str\(\)/i,
    matchedLabel: 'str(LLMMessage.content) direct stringification',
    explanation:
      'Directly calling str() on LLMMessage.content leaks Python list/dict repr strings ("[{\'type\': \'text\', ...}]") into model prompts and memory when multimodal content parts are present.',
    remediationDirective:
      'Replace str(msg.content) with message_content_text(msg) from crewai.utilities.agent_utils.',
    rewriteFn: (input: string) =>
      input
        .replace(
          /\bstr\s*\(\s*(?:msg|message|llm_message|item)?\.?content\s*\)/gi,
          'message_content_text(msg)'
        )
        .replace(/str\(\s*LLMMessage\.content\s*\)/gi, 'message_content_text(msg)')
        .replace(/use\s+str\(\)\s+on\s+LLMMessage\.content/gi, 'use message_content_text(msg) from crewai.utilities.agent_utils')
  },
  {
    articleCode: 'CONST-02',
    regex: /\bdocs\/v\d+(?:\.\d+)*\b|\b(?:delete|remove|rename|rm)\b[^.;\n]*\bdocs\/images\b|\bdocs\/images\b[^.;\n]*\b(?:delete|remove|rename|rm)\b/i,
    matchedLabel: 'Modification of frozen docs/v* snapshot or deletion/rename of docs/images/',
    explanation:
      'Files under docs/v*/ are immutable release snapshots managed by devtools, and assets in docs/images/ are referenced by historical snapshots. Modifying or deleting them violates documentation integrity.',
    remediationDirective:
      'Modify MDX files only under docs/edge/en/*, preserve all files in docs/images/, and synchronize translations to ar, ko, and pt-BR.',
    rewriteFn: (input: string) =>
      input
        .replace(/\bdocs\/v\d+(?:\.\d+)*(?:\/[A-Za-z0-9_.-]+)*/gi, 'docs/edge/en')
        .replace(
          /\b(?:delete|remove|rename|rm)\b([^.;\n]*)\bdocs\/images\/?[A-Za-z0-9_.-]*/gi,
          'preserve all existing assets in docs/images/ and update docs/edge/en (syncing ar, ko, and pt-BR)'
        )
  },
  {
    articleCode: 'CONST-03',
    regex: /\bgit\s+push\s+(?:--force|-f)\b|\brm\s+-rf\b|\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b|\b(?:exfiltrate|leak|dump|upload)\b[^.;\n]*\b(?:\.env|GITHUB_TOKEN|GEMINI_API_KEY|secret|PAT)\b/i,
    matchedLabel: 'Destructive Git force-push, table drop, rm -rf, or secret exfiltration',
    explanation:
      'Autonomous agents are strictly prohibited from force-pushing git branches, dropping database tables, wiping directories with rm -rf, or exposing .env/PAT credentials.',
    remediationDirective:
      'Use non-destructive signed commits on a dedicated branch, read/upsert SQL queries, and keep all .env secrets isolated on the server.',
    rewriteFn: (input: string) =>
      input
        .replace(/\bgit\s+push\s+(?:--force|-f)\b/gi, 'git push origin jules/verified-branch')
        .replace(/\brm\s+-rf\s+[^\s;]+/gi, 'clean temporary artifacts safely')
        .replace(/\b(?:DROP|TRUNCATE)\s+TABLE\s+[A-Za-z0-9_]+/gi, 'SELECT * FROM crews LIMIT 10')
        .replace(
          /\b(?:exfiltrate|leak|dump|upload)\b([^.;\n]*)\b(?:\.env|GITHUB_TOKEN|GEMINI_API_KEY|secret|PAT)\b/gi,
          'verify server-side credential isolation without exposing secrets'
        )
  },
  {
    articleCode: 'CONST-04',
    regex: /\b(?:bypass|disable|ignore|remove)\b[^.;\n]*\b(?:rate\s*limit|quota|throttl\w*|governor|429|ollama\s+fallback|patient)\b|\bunthrottled\s+(?:parallel\s+)?loop\b/i,
    matchedLabel: 'Bypassing Patient Quota Governor or disabling Ollama fallback',
    explanation:
      'Disabling rate-limit pacing or Ollama fallback risks immediate HTTP 429 exhaustion. Autonomous tasks must respect the Patient Token-Bucket Governor.',
    remediationDirective:
      'Keep the Patient Quota Governor enabled (<=10 RPM pacing) with automatic failover to the local/free Ollama pool.',
    rewriteFn: (input: string) =>
      input
        .replace(
          /\b(?:bypass|disable|ignore|remove)\b([^.;\n]*)\b(?:rate\s*limit|quota|throttl\w*|governor|429|ollama\s+fallback|patient)\b/gi,
          'enforce Patient Token-Bucket Quota pacing with automatic Ollama fallback'
        )
        .replace(/\bunthrottled\s+(?:parallel\s+)?loop\b/gi, 'throttled sequential execution with patient backoff')
  },
  {
    articleCode: 'CONST-05',
    regex: /--no-verify|\b(?:skip|ignore|delete|disable|bypass)\s+(?:all\s+)?(?:unit\s+)?tests?\b|\bwithout\s+(?:running\s+)?tests?\b|\brewrite\s+entire\s+codebase\b/i,
    matchedLabel: 'Skipping behavioral unit tests (--no-verify) or unbounded non-minimal rewrite',
    explanation:
      'Every autonomous change by Jules must be validated by behavioral unit tests (exit code 0) and maintain minimal, targeted diffs (DRY & YAGNI).',
    remediationDirective:
      'Run pytest behavioral unit tests on the targeted module and keep diffs minimal.',
    rewriteFn: (input: string) =>
      input
        .replace(/--no-verify/gi, '-v')
        .replace(
          /\b(?:skip|ignore|delete|disable|bypass)\s+(?:all\s+)?(?:unit\s+)?tests?\b/gi,
          'write and execute behavioral pytest unit tests'
        )
        .replace(/\bwithout\s+(?:running\s+)?tests?\b/gi, 'with full behavioral unit test verification')
        .replace(/\brewrite\s+entire\s+codebase\b/gi, 'apply minimal, targeted diff following DRY and YAGNI')
  },
  {
    articleCode: 'CONST-06',
    regex: /\b(?:circular\s+dependency|cyclic\s+dag|infinite\s+task\s+loop|self-dependency|bypass\s+dag\s+validation|desync\s+graph)\b/i,
    matchedLabel: 'Cyclic DAG dependency or 4-Graph state desynchronization',
    explanation:
      'Introducing circular dependencies or bypassing topological DAG validation breaks synchronization across Task DAG, LangGraph, Flow DAG, and Graphify AST.',
    remediationDirective:
      'Preserve strict DAG acyclicity and synchronize state across all 4 graph engines.',
    rewriteFn: (input: string) =>
      input.replace(
        /\b(?:circular\s+dependency|cyclic\s+dag|infinite\s+task\s+loop|self-dependency|bypass\s+dag\s+validation|desync\s+graph)\b/gi,
        'acyclic topological DAG synchronized across all 4 graph engines'
      )
  }
];

export function validateAutonomousGoal(
  proposedGoal: string,
  options?: {
    testCommand?: string;
    targetPath?: string;
    actor?: ConstitutionalAuditReport['actor'];
    customRules?: CustomConstitutionalRule[];
  }
): ConstitutionalAuditReport {
  const goalText = String(proposedGoal || '').trim();
  const testCmd = String(options?.testCommand || 'pytest tests/ -v').trim();
  const targetPath = String(options?.targetPath || '').trim();
  const actor = options?.actor || 'Jules Autonomous Agent';
  const customRules = options?.customRules || [];

  const combinedInput = `${goalText}\n${testCmd}\n${targetPath}`;
  const violations: ConstitutionalViolation[] = [];
  let remediatedGoal = goalText;
  let remediatedTestCommand = testCmd;

  for (const detector of RULE_DETECTORS) {
    if (detector.regex.test(combinedInput)) {
      const article = IMMUTABLE_CONSTITUTION_ARTICLES.find((a) => a.code === detector.articleCode)!;
      violations.push({
        articleId: article.id,
        articleCode: article.code,
        articleTitle: article.title,
        category: article.category,
        severity: article.severity,
        matchedTrigger: detector.matchedLabel,
        conflictExplanation: detector.explanation,
        remediationDirective: detector.remediationDirective
      });
      remediatedGoal = detector.rewriteFn(remediatedGoal);
      remediatedTestCommand = detector.rewriteFn(remediatedTestCommand);
    }
  }

  // Also check if targetPath directly points to frozen docs/v* or deleting docs/images
  if (/^docs\/v\d+/i.test(targetPath) && !violations.some((v) => v.articleCode === 'CONST-02')) {
    const article = IMMUTABLE_CONSTITUTION_ARTICLES.find((a) => a.code === 'CONST-02')!;
    violations.push({
      articleId: article.id,
      articleCode: article.code,
      articleTitle: article.title,
      category: article.category,
      severity: 'CRITICAL',
      matchedTrigger: `Target path "${targetPath}" is inside frozen release snapshot docs/v*/`,
      conflictExplanation: article.rationale,
      remediationDirective: 'Redirect target path to docs/edge/en/* and sync translations to ar, ko, and pt-BR.'
    });
  }

  // Check supplementary custom constitutional rules
  for (const custom of customRules) {
    if (!custom.forbiddenKeyword.trim()) continue;
    const escaped = custom.forbiddenKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customRegex = new RegExp(escaped, 'i');
    if (customRegex.test(combinedInput)) {
      violations.push({
        articleId: custom.id,
        articleCode: custom.code,
        articleTitle: custom.title,
        category: 'Verification & Quality',
        severity: 'HIGH',
        matchedTrigger: `Matched custom guardrail keyword: "${custom.forbiddenKeyword}"`,
        conflictExplanation: custom.rationale,
        remediationDirective: `Replace "${custom.forbiddenKeyword}" with "${custom.requiredReplacement}".`
      });
      remediatedGoal = remediatedGoal.replace(customRegex, custom.requiredReplacement);
    }
  }

  // If remediatedGoal ended up identical to goalText despite a violation, append explicit safe guardrails
  if (violations.length > 0 && remediatedGoal.trim() === goalText.trim()) {
    const directives = violations.map((v) => v.remediationDirective).join(' ');
    remediatedGoal = `${goalText} [Constitutional Remediation: ${directives}]`;
  }

  const violatedCodes = new Set(violations.map((v) => v.articleCode));
  const passedArticleIds = IMMUTABLE_CONSTITUTION_ARTICLES.filter(
    (a) => !violatedCodes.has(a.code)
  ).map((a) => a.code);

  const penalty = violations.reduce(
    (acc, v) => acc + (v.severity === 'CRITICAL' ? 40 : 25),
    0
  );
  const complianceScore = Math.max(0, 100 - penalty);
  const status: ConstitutionalAuditReport['status'] =
    violations.length > 0 ? 'BLOCKED' : 'COMPLIANT';

  return {
    auditId: `caudit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    proposedGoal: goalText,
    testCommand: testCmd,
    targetPath: targetPath || undefined,
    status,
    complianceScore,
    constitutionRootHash: CONSTITUTION_ROOT_HASH,
    violations,
    passedArticleIds,
    remediatedGoal,
    remediatedTestCommand
  };
}

export const PRESET_CONSTITUTIONAL_TEST_CASES: Array<{
  id: string;
  label: string;
  badge: 'CONFLICT' | 'COMPLIANT';
  actor: ConstitutionalAuditReport['actor'];
  goal: string;
  testCommand: string;
  targetPath: string;
}> = [
  {
    id: 'conflict-msg-str',
    label: 'Conflict: str(msg.content) & Frozen Docs Edit',
    badge: 'CONFLICT',
    actor: 'Jules Autonomous Agent',
    goal: 'Refactor agent memory logger to cast LLMMessage.content using str(msg.content), update docs/v1.0/agents.mdx, and delete docs/images/legacy_diagram.png.',
    testCommand: 'pytest tests/ --no-verify',
    targetPath: 'lib/crewai/src/crewai/utilities/agent_utils.py'
  },
  {
    id: 'conflict-git-quota',
    label: 'Conflict: Force Push & Bypass Rate Governor',
    badge: 'CONFLICT',
    actor: 'Jules Autonomous Agent',
    goal: 'Bypass rate limit governor to run an unthrottled loop across 50 agents, DROP TABLE execution_runs to reset state, and git push --force to main without running tests.',
    testCommand: 'pytest --collect-only',
    targetPath: 'server/fullstackEngine.ts'
  },
  {
    id: 'compliant-crewai',
    label: 'Compliant: Safe Multimodal Helper & Edge Docs Sync',
    badge: 'COMPLIANT',
    actor: 'Jules Autonomous Agent',
    goal: 'Use message_content_text(msg) from crewai.utilities.agent_utils to collapse multimodal LLMMessage.content safely, write behavioral pytest unit tests, and update docs/edge/en/agents.mdx with ar, ko, and pt-BR translations.',
    testCommand: 'pytest tests/utilities/test_agent_utils.py -v',
    targetPath: 'lib/crewai/src/crewai/utilities/agent_utils.py'
  }
];

export interface ConstitutionalRiskAssessment {
  riskScore: number; // 0 (Zero Risk) to 100 (Critical Constitutional Conflict)
  riskTier: 'ZERO RISK' | 'LOW RISK' | 'MODERATE RISK' | 'CRITICAL CONFLICT';
  riskSummary: string;
  operationalModifiers: string[];
  auditReport: ConstitutionalAuditReport;
}

export function evaluateConstitutionalRisk(
  proposedGoal: string,
  options?: {
    branchPolicy?: 'jules_autonomous_branch' | 'direct_main';
    cooldownSeconds?: number;
    targetRepo?: string;
    customRules?: CustomConstitutionalRule[];
  }
): ConstitutionalRiskAssessment {
  const auditReport = validateAutonomousGoal(proposedGoal, {
    testCommand: 'pytest tests/ -v',
    targetPath: options?.targetRepo || '',
    actor: 'Jules Autonomous Agent',
    customRules: options?.customRules
  });

  // Base risk is inverse of constitutional compliance score (0 when 100% compliant)
  let riskScore = Math.max(0, 100 - auditReport.complianceScore);
  const operationalModifiers: string[] = [];

  if (options?.branchPolicy === 'direct_main') {
    riskScore = Math.min(100, riskScore + 12);
    operationalModifiers.push('Direct-to-main branch policy (+12 risk vs isolated jules/autonomous-* branch)');
  }

  if (typeof options?.cooldownSeconds === 'number' && options.cooldownSeconds < 15) {
    riskScore = Math.min(100, riskScore + 8);
    operationalModifiers.push(`Aggressive ${options.cooldownSeconds}s cooldown (+8 quota pacing risk)`);
  }

  let riskTier: ConstitutionalRiskAssessment['riskTier'] = 'ZERO RISK';
  if (auditReport.violations.length > 0 || riskScore >= 40) {
    riskTier = 'CRITICAL CONFLICT';
  } else if (riskScore >= 20) {
    riskTier = 'MODERATE RISK';
  } else if (riskScore > 0) {
    riskTier = 'LOW RISK';
  }

  const riskSummary =
    auditReport.violations.length > 0
      ? `Flagged ${auditReport.violations.length} constitutional violation(s) (${auditReport.violations
          .map((v) => v.articleCode)
          .join(', ')}). Auto-remediation required before launching 24h job.`
      : operationalModifiers.length > 0
      ? `All 6 core constitutional articles passed; ${operationalModifiers.join(' · ')}.`
      : '0/100 Constitutional Risk — 100% compliant across all 6 immutable core principles (CONST-01..06).';

  return {
    riskScore,
    riskTier,
    riskSummary,
    operationalModifiers,
    auditReport
  };
}

export interface ConstitutionalPrincipleImpact {
  articleCode: string;
  articleTitle: string;
  category: ConstitutionalArticle['category'];
  baselineIntegrityPct: number;
  projectedIntegrityPct: number;
  driftPct: number;
  driftLevel: 'ZERO_DRIFT' | 'LATENT_DRIFT' | 'CRITICAL_DRIFT';
  impactVector: string;
  driftAnalysis: string;
  mitigationGuardrail: string;
}

export interface ConstitutionalImpactSimulationResult {
  simulationId: string;
  simulatedAt: string;
  proposedTaskTitle: string;
  proposedTaskDirective: string;
  targetModule: string;
  assignedAgent: string;
  overallDriftPct: number;
  projectedConstitutionHealthPct: number;
  queueVerdict: 'SAFE_TO_QUEUE' | 'LATENT_DRIFT_WARNING' | 'BLOCKED_CRITICAL_DRIFT';
  principleImpacts: ConstitutionalPrincipleImpact[];
  driftingPrinciplesCount: number;
  criticalDriftCount: number;
  latentDriftCount: number;
  neutralizedTaskDirective: string;
}

const IMPACT_VECTORS_BY_CODE: Record<string, string> = {
  'CONST-01': 'LLMMessage.content Multimodal Serialization & Agent Memory',
  'CONST-02': 'Docs Snapshot Immutability (docs/v*) & Translation Parity (ar, ko, pt-BR)',
  'CONST-03': 'Git Branch Protection, ACID SQLite Tables & Secret Isolation',
  'CONST-04': 'Patient Token-Bucket Governor (<=10 RPM) & Ollama Failover',
  'CONST-05': 'Behavioral PyTest Verification & Minimal Diff Scope (DRY/YAGNI)',
  'CONST-06': '4-Graph Topological Acyclicity (Task DAG ↔ LangGraph ↔ Flow ↔ AST)'
};

export function simulateConstitutionalImpact(params: {
  taskTitle?: string;
  taskDirective: string;
  targetModule?: string;
  assignedAgent?: string;
}): ConstitutionalImpactSimulationResult {
  const directive = String(params.taskDirective || '').trim();
  const taskTitle = String(params.taskTitle || 'Proposed Autonomous Workforce Task').trim();
  const targetModule = String(params.targetModule || 'lib/crewai/src/crewai/utilities/agent_utils.py').trim();
  const assignedAgent = String(params.assignedAgent || 'Google Jules VM').trim();

  const baseAudit = validateAutonomousGoal(directive, {
    testCommand: 'pytest tests/ -v',
    targetPath: targetModule,
    actor: 'Jules Autonomous Agent'
  });

  const combined = `${taskTitle}\n${directive}\n${targetModule}`;
  const latentAdditions: string[] = [];

  const principleImpacts: ConstitutionalPrincipleImpact[] = IMMUTABLE_CONSTITUTION_ARTICLES.map(
    (art) => {
      const hardViolation = baseAudit.violations.find((v) => v.articleCode === art.code);
      if (hardViolation) {
        const driftPct = art.severity === 'CRITICAL' ? 85 : 68;
        return {
          articleCode: art.code,
          articleTitle: art.title,
          category: art.category,
          baselineIntegrityPct: 100,
          projectedIntegrityPct: 100 - driftPct,
          driftPct,
          driftLevel: 'CRITICAL_DRIFT',
          impactVector: IMPACT_VECTORS_BY_CODE[art.code] || art.category,
          driftAnalysis: `Direct conflict detected: ${hardViolation.matchedTrigger}. ${hardViolation.conflictExplanation}`,
          mitigationGuardrail: hardViolation.remediationDirective
        };
      }

      // Check for Latent / Indirect Drift patterns before the task is queued
      let latentDriftPct = 0;
      let latentReason = '';
      let latentMitigation = '';

      if (
        art.code === 'CONST-01' &&
        /\b(?:LLMMessage|message\.content|msg\.content|multimodal|agent_utils)\b/i.test(combined) &&
        !/\bmessage_content_text\b/i.test(combined)
      ) {
        latentDriftPct = 32;
        latentReason =
          'Task touches LLMMessage/content handling without explicitly enforcing message_content_text(msg), risking accidental str() repr serialization.';
        latentMitigation =
          'Explicitly require message_content_text(msg) from crewai.utilities.agent_utils.';
        latentAdditions.push('collapse LLMMessage.content exclusively via message_content_text(msg)');
      } else if (
        art.code === 'CONST-02' &&
        /\bdocs\/(?:edge\/en|[A-Za-z0-9_-]+\.mdx)\b/i.test(combined) &&
        !(/\bar\b/i.test(combined) && /\bko\b/i.test(combined) && /\bpt-BR\b/i.test(combined))
      ) {
        latentDriftPct = 38;
        latentReason =
          'Task modifies English documentation without scheduling translation synchronization to ar, ko, and pt-BR or broken-link verification.';
        latentMitigation =
          'Sync documentation edits to docs/edge/{ar,ko,pt-BR} and run mintlify broken-links.';
        latentAdditions.push('sync docs changes across ar, ko, and pt-BR translations');
      } else if (
        art.code === 'CONST-03' &&
        /\b(?:git\s+push|main\s+branch|direct\s+commit|sql\s+migration|database\s+reset)\b/i.test(combined) &&
        !/\b(?:jules\/|verified-branch|signed|parameterized)\b/i.test(combined)
      ) {
        latentDriftPct = 28;
        latentReason =
          'Task references repository push or database mutation without specifying an isolated jules/* branch and non-destructive SQLite upsert guardrails.';
        latentMitigation =
          'Isolate commits on a jules/autonomous-* branch and enforce non-destructive SQLite queries.';
        latentAdditions.push('commit to an isolated jules/autonomous-* branch');
      } else if (
        art.code === 'CONST-04' &&
        /\b(?:parallel|concurrent|batch|50\s+agents|20\s+agents|benchmark\s+throughput|high-frequency|loop)\b/i.test(
          combined
        ) &&
        !/\b(?:patient|cooldown|token-bucket|ollama|throttl)/i.test(combined)
      ) {
        latentDriftPct = 36;
        latentReason =
          'High-concurrency or loop execution proposed without binding to the Patient Token-Bucket Governor (<=10 RPM) and Ollama fallback.';
        latentMitigation =
          'Bind task execution to Patient Quota Pacing (15s–20s cooldown) with automatic Ollama fallback.';
        latentAdditions.push('pace LLM calls via the Patient Quota Governor with Ollama fallback');
      } else if (
        art.code === 'CONST-05' &&
        !/\b(?:pytest|unittest|unit\s+test|behavioral\s+test|test_)\b/i.test(combined)
      ) {
        latentDriftPct = 24;
        latentReason =
          'Proposed task does not specify a behavioral unit test verification target (pytest), creating potential verification drift.';
        latentMitigation =
          'Add behavioral pytest assertions focusing on observable input/output behavior and minimal diffs.';
        latentAdditions.push('verify behavior with pytest unit assertions and minimal diffs');
      } else if (
        art.code === 'CONST-06' &&
        /\b(?:dag|graph|langgraph|flow|dependency|edge|node)\b/i.test(combined) &&
        !/\b(?:acyclic|topological|4-graph|sync)\b/i.test(combined)
      ) {
        latentDriftPct = 30;
        latentReason =
          'Task mutates workflow graph nodes/edges without enforcing topological DAG acyclicity across all 4 graph engines.';
        latentMitigation =
          'Enforce topological DAG acyclicity and 4-Graph state synchronization.';
        latentAdditions.push('verify topological DAG acyclicity across all 4 graphs');
      }

      if (latentDriftPct > 0) {
        return {
          articleCode: art.code,
          articleTitle: art.title,
          category: art.category,
          baselineIntegrityPct: 100,
          projectedIntegrityPct: 100 - latentDriftPct,
          driftPct: latentDriftPct,
          driftLevel: 'LATENT_DRIFT',
          impactVector: IMPACT_VECTORS_BY_CODE[art.code] || art.category,
          driftAnalysis: latentReason,
          mitigationGuardrail: latentMitigation
        };
      }

      return {
        articleCode: art.code,
        articleTitle: art.title,
        category: art.category,
        baselineIntegrityPct: 100,
        projectedIntegrityPct: 100,
        driftPct: 0,
        driftLevel: 'ZERO_DRIFT',
        impactVector: IMPACT_VECTORS_BY_CODE[art.code] || art.category,
        driftAnalysis: 'Zero constitutional drift projected. Task aligns with core invariant.',
        mitigationGuardrail: art.requiredInvariant
      };
    }
  );

  const criticalDriftCount = principleImpacts.filter((p) => p.driftLevel === 'CRITICAL_DRIFT').length;
  const latentDriftCount = principleImpacts.filter((p) => p.driftLevel === 'LATENT_DRIFT').length;
  const driftingPrinciplesCount = criticalDriftCount + latentDriftCount;

  const avgDrift = Math.round(
    principleImpacts.reduce((sum, p) => sum + p.driftPct, 0) / principleImpacts.length
  );
  const maxDrift = Math.max(...principleImpacts.map((p) => p.driftPct), 0);
  const overallDriftPct =
    criticalDriftCount > 0
      ? Math.min(100, Math.round(maxDrift * 0.7 + avgDrift * 0.3))
      : latentDriftCount > 0
      ? Math.min(100, Math.round(maxDrift * 0.65 + avgDrift * 0.35))
      : 0;

  const projectedConstitutionHealthPct = Math.max(0, 100 - overallDriftPct);

  let queueVerdict: ConstitutionalImpactSimulationResult['queueVerdict'] = 'SAFE_TO_QUEUE';
  if (criticalDriftCount > 0) {
    queueVerdict = 'BLOCKED_CRITICAL_DRIFT';
  } else if (latentDriftCount > 0) {
    queueVerdict = 'LATENT_DRIFT_WARNING';
  }

  let neutralizedTaskDirective = baseAudit.remediatedGoal || directive;
  if (latentAdditions.length > 0) {
    const cleanBase = neutralizedTaskDirective.replace(/\.\s*$/, '');
    neutralizedTaskDirective = `${cleanBase}; ${latentAdditions.join(', ')}.`;
  }

  return {
    simulationId: `csim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    simulatedAt: new Date().toLocaleTimeString(),
    proposedTaskTitle: taskTitle,
    proposedTaskDirective: directive,
    targetModule,
    assignedAgent,
    overallDriftPct,
    projectedConstitutionHealthPct,
    queueVerdict,
    principleImpacts,
    driftingPrinciplesCount,
    criticalDriftCount,
    latentDriftCount,
    neutralizedTaskDirective
  };
}

export const IMPACT_SIMULATION_PRESETS: Array<{
  id: string;
  label: string;
  mode: 'CRITICAL_DRIFT' | 'LATENT_DRIFT' | 'ZERO_DRIFT';
  taskTitle: string;
  taskDirective: string;
  targetModule: string;
  assignedAgent: string;
}> = [
  {
    id: 'sim-latent-drift',
    label: 'Latent Drift: Unsynced Edge Docs & Parallel Loop',
    mode: 'LATENT_DRIFT',
    taskTitle: 'Benchmark Parallel Agent Memory & Update Docs',
    taskDirective:
      'Update LLMMessage handling in agent_utils, edit docs/edge/en/agents.mdx with new examples, and run a concurrent 20 agents benchmark loop across graph nodes.',
    targetModule: 'lib/crewai/src/crewai/utilities/agent_utils.py',
    assignedAgent: 'Elena Vance · Task Architect'
  },
  {
    id: 'sim-critical-drift',
    label: 'Critical Drift: str(msg.content) & Frozen Docs Edit',
    mode: 'CRITICAL_DRIFT',
    taskTitle: 'Direct Content String Cast & Legacy Snapshot Patch',
    taskDirective:
      'Cast LLMMessage.content using str(msg.content) in memory logger, patch docs/v1.0/agents.mdx, and git push --force without running tests.',
    targetModule: 'docs/v1.0/agents.mdx',
    assignedAgent: 'Google Jules VM'
  },
  {
    id: 'sim-zero-drift',
    label: 'Zero Drift: Fully Aligned Constitutional Task',
    mode: 'ZERO_DRIFT',
    taskTitle: 'Safe Multimodal Collapse & Synchronized Edge Docs',
    taskDirective:
      'Use message_content_text(msg) from crewai.utilities.agent_utils to collapse multimodal LLMMessage.content safely, verify behavior with pytest unit tests, commit to jules/autonomous-branch, pace LLM calls via the Patient Quota Governor with Ollama fallback, verify acyclic 4-Graph sync, and sync docs/edge/en/agents.mdx to ar, ko, and pt-BR.',
    targetModule: 'lib/crewai/src/crewai/utilities/agent_utils.py',
    assignedAgent: 'Google Jules VM'
  }
];


