import { DocSection, DocPage } from '../types';

export const DOC_SECTIONS: DocSection[] = [
  {
    title: 'Get Started',
    icon: 'rocket',
    pages: [
      {
        id: 'introduction',
        title: 'Introduction',
        description: 'Overview of CrewAI concepts, architecture, and what you can build with agents, crews, and flows.',
        category: 'Get Started',
        icon: 'sparkles',
        tags: ['core', 'overview', 'architecture'],
        content: `
# CrewAI Framework Overview

CrewAI is an open-source Python framework with high-level abstractions and low-level APIs for building production-ready multi-agent workflows.

It gives developers autonomous agent collaboration through **Crews** and precise, event-driven control through **Flows**.

---

### Core Primitives

- **Agents**: Autonomous AI workers with specific roles, goals, backstories, memory, and specialized toolsets.
- **Tasks**: Units of work assigned to agents, defining expected outputs, dependencies, human review requirements, and output schemas.
- **Crews**: Orchestration units combining multiple agents and tasks into sequential or hierarchical pipelines.
- **Flows**: Event-driven state machines that chain single LLM calls, crews, and custom Python functions using decorators like \`@start\`, \`@listen\`, and \`@router\`.

---

### Quick Comparison: Crews vs Flows

| Feature | CrewAI Crews | CrewAI Flows |
| :--- | :--- | :--- |
| **Primary Strength** | Autonomous multi-agent collaboration & delegation | Deterministic, event-driven orchestration & state |
| **Execution Pattern** | Role-based tasks (Sequential or Hierarchical) | Graph-like transitions (\`@start\`, \`@listen\`, \`@router\`) |
| **State Management** | Task outputs passed as context | Typed Pydantic state persisted across checkpoints |
| **Best For** | Complex research, drafting, coding, creative debate | Production business logic, branching pipelines, human-in-the-loop |
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Simple Agent and Crew',
            code: `from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool

# 1. Define Agent
researcher = Agent(
    role="Senior Market Analyst",
    goal="Discover disruptive trends in quantum computing",
    backstory="You are a veteran technology scout with deep technical expertise.",
    tools=[SerperDevTool()],
    verbose=True
)

# 2. Define Task
research_task = Task(
    description="Research 3 recent breakthroughs in quantum software and write a summary.",
    expected_output="A bulleted summary highlighting practical software implications.",
    agent=researcher
)

# 3. Create Crew & Kickoff
crew = Crew(
    agents=[researcher],
    tasks=[research_task],
    process=Process.sequential
)

result = crew.kickoff()
print(result)`
          }
        ]
      },
      {
        id: 'quickstart',
        title: 'Quickstart',
        description: 'Build your first CrewAI Flow in minutes — orchestration, state, and an agent crew that produces a real report.',
        category: 'Get Started',
        icon: 'zap',
        tags: ['quickstart', 'flow', 'first-crew'],
        content: `
# Quickstart: Build your first Flow

In this guide you will create a **Flow** that sets a research topic, runs a **Crew with one agent** (a researcher using web search), and produces a structured report.

Flows are the recommended way to structure production applications: they own **state** and **execution order**, while **agents** do the heavy lifting inside crew steps.

---

### Prerequisites
1. Python >= 3.10 and < 3.14
2. CrewAI CLI installed (\`uv tool install crewai\` or \`pip install crewai\`)
3. LLM API Key (OpenAI, Anthropic, Gemini, Groq, or Ollama) in your \`.env\`
        `,
        codeSnippets: [
          {
            language: 'shell',
            title: 'Scaffold Flow Project',
            code: `# Create a new flow project
crewai create flow latest-ai-flow
cd latest_ai_flow

# Install project dependencies
crewai install

# Run the flow
crewai run`
          },
          {
            language: 'python',
            title: 'Flow Definition (main.py)',
            code: `from crewai.flow.flow import Flow, start, listen
from pydantic import BaseModel

class ResearchState(BaseModel):
    topic: str = "Multi-Agent AI Systems"
    report: str = ""

class ResearchFlow(Flow[ResearchState]):

    @start()
    def initialize_state(self):
        print(f"Starting research on {self.state.topic}")
        return self.state.topic

    @listen(initialize_state)
    def run_crew_step(self, topic):
        # Kick off autonomous researcher crew
        from crews.content_crew.content_crew import kickoff_content_crew
        from crewai.utilities.agent_utils import message_content_text

        crew_output = kickoff_content_crew(inputs={"topic": topic})
        # Never call str() on LLMMessage.content; collapse via message_content_text
        self.state.report = message_content_text(crew_output.raw)
        return self.state.report

flow = ResearchFlow()
flow.kickoff()`
          }
        ]
      },
      {
        id: 'installation',
        title: 'Installation',
        description: 'Install via uv or pip, configure API keys, and set up the CrewAI CLI for local development.',
        category: 'Get Started',
        icon: 'download',
        tags: ['install', 'cli', 'uv'],
        content: `
# Installation Guide

We recommend using **uv** for lightning-fast installation and modern Python environment management.

### Recommended: Install via uv
\`\`\`bash
# 1. Install Astral uv if you haven't yet
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install CrewAI CLI globally as a standalone tool
uv tool install crewai

# 3. Verify installation
crewai --version
\`\`\`

### Alternative: Install via pip
\`\`\`bash
pip install crewai crewai-tools
\`\`\`

### Optional Extensions
To enable specialized toolsets and integrations:
\`\`\`bash
pip install 'crewai[tools]'
\`\`\`
        `
      },
      {
        id: 'skills',
        title: 'Coding Agent Skills',
        description: 'Supercharge Claude Code, Cursor, Windsurf, and Codex with the official CrewAI skills.',
        category: 'Get Started',
        icon: 'terminal',
        tags: ['skills', 'mcp', 'claude-code', 'cursor'],
        content: `
# CrewAI Coding-Agent Skills

Teach your AI coding assistants (Claude Code, Cursor, Windsurf, Codex) how to design, scaffold, and optimize CrewAI apps with official skills.

### Installation

For Cursor, Codex, Windsurf, and other standard agents:
\`\`\`bash
npx skills add crewaiinc/skills
\`\`\`

For Claude Code:
\`\`\`bash
/plugin marketplace add crewAIInc/skills
/plugin install crewai-skills@crewai-plugins
/reload-plugins
\`\`\`

### Included Skills
- **getting-started**: Scaffolding new projects, wiring \`crew.jsonc\` and \`main.py\`.
- **design-agent**: Configuring agents (role, goal, backstory, tools, LLMs, memory, guardrails).
- **design-task**: Writing task descriptions, dependencies, structured output (\`output_pydantic\`, \`output_json\`), human review.
- **ask-docs**: Querying the live CrewAI docs MCP server for up-to-date API details.
        `
      }
    ]
  },
  {
    title: 'Core Concepts',
    icon: 'box',
    pages: [
      {
        id: 'concepts-agents',
        title: 'Agents',
        description: 'Compose autonomous agents with roles, goals, backstories, memory, tools, and guardrails.',
        category: 'Core Concepts',
        icon: 'user-check',
        tags: ['agent', 'role', 'tools', 'memory'],
        content: `
# Agents

An **Agent** is an autonomous unit powered by an LLM that can perform tasks, make decisions, communicate with other agents, and use external tools.

### Core Agent Attributes
- **role**: Defines what the agent is best at (e.g. \`"Senior Research Analyst"\`).
- **goal**: What the agent aims to accomplish (e.g. \`"Uncover top 5 security vulnerabilities"\`).
- **backstory**: Gives context and personality to guide tone and decision making.
- **tools**: Array of tools the agent can invoke (e.g. \`[SerperDevTool(), ScrapeWebsiteTool()]\`).
- **memory**: Enables short-term and long-term retention of thoughts and observations.
- **verbose**: Prints detailed execution thoughts to the console.
- **allow_delegation**: Controls whether this agent can delegate sub-tasks to other agents in the crew.
- **max_iter**: Maximum reasoning loops before forcing a conclusion (default: 25).
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Agent Definition in Python',
            code: `from crewai import Agent
from crewai_tools import SerperDevTool, ScrapeWebsiteTool

analyst = Agent(
    role="Lead Financial Forecaster",
    goal="Analyze quarterly earnings and forecast annual guidance",
    backstory="You have 15 years experience in equity research on Wall Street.",
    tools=[SerperDevTool(), ScrapeWebsiteTool()],
    verbose=True,
    memory=True,
    max_iter=15,
    allow_delegation=True
)`
          },
          {
            language: 'jsonc',
            title: 'Agent Definition in JSONC (Modern Spec)',
            code: `// agents/analyst.jsonc
{
  "role": "Lead Financial Forecaster",
  "goal": "Analyze quarterly earnings and forecast annual guidance for {ticker}",
  "backstory": "You have 15 years experience in equity research on Wall Street.",
  "tools": ["SerperDevTool", "ScrapeWebsiteTool"],
  "settings": {
    "verbose": true,
    "memory": true,
    "max_iter": 15
  }
}`
          }
        ]
      },
      {
        id: 'concepts-crews',
        title: 'Crews',
        description: 'Orchestrate teams of agents, manage task order (sequential or hierarchical), and control execution.',
        category: 'Core Concepts',
        icon: 'users',
        tags: ['crew', 'orchestration', 'sequential', 'hierarchical'],
        content: `
# Crews

A **Crew** represents a collaborative group of agents working together to accomplish a set of tasks.

### Process Types

1. **Sequential**: Tasks are executed in the order they are defined in the \`tasks\` array. The output of one task is passed as context to subsequent tasks.
2. **Hierarchical**: A **Manager Agent** (or custom \`manager_llm\`) orchestrates the crew. The manager receives the high-level objectives, decides which agent should work on which task, reviews their work, and coordinates final assembly.

---

### Crew Memory & Cache
Crews support short-term memory (shared during the run), long-term memory (persisted SQLite database across runs), and entity memory (storing known facts about people, places, and concepts).
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Hierarchical Crew with Manager LLM',
            code: `from crewai import Crew, Process

# Manager agent automatically orchestrates task distribution
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, write_task, review_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o", # or custom manager Agent
    memory=True,
    verbose=True
)

result = crew.kickoff(inputs={"topic": "Quantum Machine Learning"})`
          }
        ]
      },
      {
        id: 'concepts-tasks',
        title: 'Tasks',
        description: 'Define units of work with clear instructions, expected outputs, schemas, and human reviews.',
        category: 'Core Concepts',
        icon: 'check-square',
        tags: ['task', 'pydantic', 'human-in-the-loop'],
        content: `
# Tasks

A **Task** is a specific assignment given to an Agent.

### Key Task Options
- **description**: Detailed prompt of what needs to be done.
- **expected_output**: Clear statement of the desired deliverable format.
- **agent**: The agent responsible for this task.
- **async_execution**: When \`True\`, runs concurrently with other independent tasks.
- **human_input**: Prompts a human reviewer in the terminal or UI before concluding.
- **output_pydantic**: Validates and serializes the task output into a typed Pydantic class.
- **output_json**: Serializes output into valid JSON.
- **output_file**: Automatically writes final task result to a file on disk.
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Structured Output with Pydantic',
            code: `from pydantic import BaseModel, Field
from typing import List
from crewai import Task

class CompetitorAnalysis(BaseModel):
    company_name: str
    strengths: List[str] = Field(description="Top 3 key differentiators")
    pricing_model: str
    risk_level: str

task = Task(
    description="Analyze competitor {target_company} and extract structured attributes.",
    expected_output="Valid CompetitorAnalysis pydantic schema",
    output_pydantic=CompetitorAnalysis,
    agent=analyst
)`
          }
        ]
      },
      {
        id: 'concepts-flows',
        title: 'Flows',
        description: 'Event-driven automations connecting LLM calls, Crews, and custom code with durable state.',
        category: 'Core Concepts',
        icon: 'git-merge',
        tags: ['flow', 'event-driven', 'state', 'router'],
        content: `
# Flows

**Flows** bring structured control flow to multi-agent architectures.

### Key Decorators
- \`@start()\`: Marks the entry point(s) of the Flow. Multiple start methods can run concurrently.
- \`@listen(method_name)\`: Executes when the referenced step finishes.
- \`@router(method_name)\`: Returns the name of the next method to invoke dynamically based on state or logic.
- \`@and_(*methods)\`: Triggers only after ALL specified methods finish.
- \`@or_(*methods)\`: Triggers as soon as ANY of the specified methods finishes.

---

### Flow State
Flow state is typed using Pydantic \`BaseModel\` and automatically serialized. You can pause, checkpoint, inspect, and resume flows seamlessly.
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Branching Flow with Router',
            code: `from crewai.flow.flow import Flow, start, listen, router
from pydantic import BaseModel

class SupportState(BaseModel):
    ticket_text: str = ""
    urgency: str = "normal"
    resolution: str = ""

class SupportFlow(Flow[SupportState]):

    @start()
    def triage_ticket(self):
        # Determine classification
        if "DOWN" in self.state.ticket_text or "CRITICAL" in self.state.ticket_text:
            self.state.urgency = "high"
        return self.state.urgency

    @router(triage_ticket)
    def route_by_urgency(self):
        if self.state.urgency == "high":
            return "escalate_to_engineer"
        return "standard_support_crew"

    @listen("escalate_to_engineer")
    def handle_critical(self):
        self.state.resolution = "Paging on-call engineering team immediately."
        return self.state.resolution

    @listen("standard_support_crew")
    def handle_standard(self):
        self.state.resolution = "Drafting helpful documentation response."
        return self.state.resolution`
          }
        ]
      },
      {
        id: 'concepts-llms',
        title: 'LLMs & Providers',
        description: 'Connect agents and flows to OpenAI, Anthropic, Gemini, Groq, Ollama, Bedrock, and Azure.',
        category: 'Core Concepts',
        icon: 'cpu',
        tags: ['llm', 'gemini', 'openai', 'anthropic', 'ollama'],
        content: `
# LLM Providers & Configuration

CrewAI features native LLM integration supporting over 100+ language models with uniform configuration.

### Native Provider Formats
- **Google Gemini (Paid & Free Tier Governor)**: \`gemini/gemini-4-argon\` (Paid Frontier), \`gemini/gemini-3.8-flash\` (Free Tier Pool), \`gemini/gemini-3.1-flash-lite\` (Free High-Throughput)
- **OpenAI**: \`gpt-4o\`, \`gpt-4o-mini\`, \`o1\`, \`o3-mini\`
- **Anthropic**: \`anthropic/claude-3-7-sonnet-20250219\`
- **Groq**: \`groq/llama-3.3-70b-versatile\`
- **Ollama**: \`ollama/llama3.2\`

### Multimodal Message Content (\`message_content_text\`)
\`LLMMessage.content\` is \`str | list[dict[str, Any]] | None\`. Never call \`str(msg.content)\` directly — that puts a Python repr (\`[{'type': 'text', 'text': 'hi'}]\`) in front of the model and into memory. Always collapse with \`message_content_text\`:
\`\`\`python
from crewai.utilities.agent_utils import message_content_text

text = message_content_text(msg)  # "" for None; joined text for a parts list
\`\`\`

### Setting Custom Parameters
\`\`\`python
from crewai import LLM

custom_llm = LLM(
    model="gemini/gemini-3.8-flash",
    temperature=0.3,
    max_tokens=4096,
    timeout=60
)

agent = Agent(
    role="Research Specialist",
    goal="Investigate market dynamics",
    llm=custom_llm
)
\`\`\`
        `
      },
      {
        id: 'concepts-ollama-pool',
        title: 'Ollama Cloud & Free Tier Pool',
        description: 'Implement continuous credit flow and automatic failover across multiple free Ollama and cloud endpoints.',
        category: 'Core Concepts',
        icon: 'cpu',
        tags: ['ollama', 'cloud', 'free-tier', 'failover', 'pool', 'rotation'],
        content: `
# Ollama Cloud & Free Tier Failover Pool

### Can we leverage free Ollama Cloud endpoints with continuous credit flow?

**Yes!** By implementing an **Automatic Fallback & Failover Pool**, you can chain multiple free Ollama instances or free-tier endpoints. When one endpoint exhausts its free quota or hits a rate limit (\`429\` or \`402\`), requests are automatically routed to the next healthy instance with zero interruption to your Crew.

---

### How the Multi-Node Pool Works

1. **Endpoint Health Checks**: The router tracks active nodes (e.g. Node A, Node B, Node C).
2. **Quota Exhaustion Interception**: When Node A returns a rate limit (\`429\`) or quota exhausted error, the failover wrapper marks it as *cooling down* or *depleted*.
3. **Instant Failover**: The current agent request is retried on Node B within milliseconds.
4. **Cooldown & Re-entry**: Once the quota reset window expires (e.g., hourly or daily free replenishment), the node is restored to the active pool.

---

### Architecture Overview

\`\`\`
[CrewAI Agent] 
       │
       ▼
[Rotating Ollama Pool Router]
       │
   ┌───┴────────────────────────┬────────────────────────┐
   ▼                            ▼                        ▼
[Ollama Free Instance 1]    [Ollama Free Instance 2]   [Ollama Cloud Node 3]
  (Status: Quota Consumed) ──> (Status: ACTIVE)         (Status: Standby)
\`\`\`

---

### Complete Python Failover Implementation
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Rotating Ollama Cloud Pool Manager',
            code: `import time
from typing import List, Dict, Any, Optional
from crewai import Agent, Crew, Task
from crewai.llms import LLM

class OllamaCloudPool:
    """Manages a pool of free Ollama Cloud endpoints with automatic failover."""
    
    def __init__(self, endpoints: List[Dict[str, str]], model_name: str = "llama3.2"):
        self.endpoints = endpoints  # list of {"url": "...", "api_key": "..."}
        self.model_name = model_name
        self.current_idx = 0
        self.exhausted_nodes: Dict[int, float] = {}  # index -> cooldown timestamp
        self.cooldown_seconds = 3600  # 1 hour cooldown for free quotas

    def get_healthy_endpoint(self) -> Dict[str, str]:
        now = time.time()
        for i in range(len(self.endpoints)):
            idx = (self.current_idx + i) % len(self.endpoints)
            # Check if cooldown has passed
            if idx in self.exhausted_nodes:
                if now - self.exhausted_nodes[idx] > self.cooldown_seconds:
                    del self.exhausted_nodes[idx]
                else:
                    continue
            self.current_idx = idx
            return self.endpoints[idx]
        
        raise RuntimeError("All free Ollama cloud endpoints have exhausted their credits.")

    def mark_exhausted(self, idx: int):
        print(f"[OllamaPool] Node {idx} ({self.endpoints[idx]['url']}) quota consumed. Failing over...")
        self.exhausted_nodes[idx] = time.time()
        self.current_idx = (self.current_idx + 1) % len(self.endpoints)

    def get_llm(self) -> LLM:
        endpoint = self.get_healthy_endpoint()
        return LLM(
            model=f"ollama/{self.model_name}",
            base_url=endpoint["url"],
            api_key=endpoint.get("api_key", "ollama-key")
        )

# Example setup with 3 free instances:
pool = OllamaCloudPool(
    endpoints=[
        {"url": "https://ollama-free-1.onrender.com", "api_key": "free-key-1"},
        {"url": "https://ollama-free-2.hf.space", "api_key": "free-key-2"},
        {"url": "https://ollama-free-3.fly.dev", "api_key": "free-key-3"}
    ],
    model_name="llama3.2"
)

# Equip Agent with the rotating LLM:
agent = Agent(
    role="Continuous Autonomous Researcher",
    goal="Extract market trends without stopping for rate limits",
    backstory="You leverage a continuous pool of cloud inference nodes.",
    llm=pool.get_llm(),
    verbose=True
)`
          },
          {
            language: 'python',
            title: 'Scan Local PC Ollama Models & Auto-Assign to Crew',
            code: `import requests
from crewai import Agent, Crew, Task
from crewai.llms import LLM

def get_installed_ollama_models(host="http://localhost:11434"):
    """Scans the local PC host to discover all installed Ollama models."""
    try:
        response = requests.get(f"{host}/api/tags", timeout=3)
        if response.status_code == 200:
            models = [m["name"] for m in response.json().get("models", [])]
            print(f"[Ollama] Discovered {len(models)} local models: {models}")
            return models
    except Exception as e:
        print(f"[Ollama] Could not connect to local Ollama on {host}: {e}")
    return ["llama3.2"]

# 1. Discover what is installed on this PC
available_models = get_installed_ollama_models()

# 2. Pick the primary local model (e.g. 'deepseek-r1:8b', 'llama3.2', 'qwen2.5')
selected_model = available_models[0]
print(f"Assigning {selected_model} to CrewAI Agent...")

# 3. Instantiate local LLM (Runs 100% on your local GPU with 0 credit costs)
local_llm = LLM(
    model=f"ollama/{selected_model}",
    base_url="http://localhost:11434",
    temperature=0.3
)

# 4. Create Agent using local hardware
researcher = Agent(
    role="Local Machine Analyst",
    goal="Process confidential company documents privately without cloud APIs",
    backstory="You execute strictly on local GPU hardware with zero token costs.",
    llm=local_llm,
    verbose=True
)`
          }
        ]
      },
      {
        id: 'concepts-memory',
        title: 'Memory & Knowledge',
        description: 'Equip agents with short-term, long-term, and entity memory, plus RAG knowledge sources.',
        category: 'Core Concepts',
        icon: 'database',
        tags: ['memory', 'knowledge', 'rag', 'embeddings'],
        content: `
# Memory & Knowledge

### Memory Layers
- **Short-Term Memory**: Ephemeral shared context within the active execution run.
- **Long-Term Memory**: Persisted SQLite database storing knowledge across multiple executions.
- **Entity Memory**: Identifies entities (people, products, organizations) and tracks their attributes.
- **User Memory**: Retains user preferences and historical feedback.

---

### Knowledge Sources
Feed unstructured enterprise data directly into agents:
- \`StringKnowledgeSource\`
- \`TextFileKnowledgeSource\`
- \`PDFKnowledgeSource\`
- \`CSVKnowledgeSource\`
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Configuring Knowledge Sources',
            code: `from crewai.knowledge.source.string_knowledge_source import StringKnowledgeSource
from crewai.knowledge.source.pdf_knowledge_source import PDFKnowledgeSource

string_source = StringKnowledgeSource(
    content="Company policy: Travel allowances are capped at $250/day without VP approval."
)

pdf_source = PDFKnowledgeSource(
    file_path="handbook.pdf"
)

agent = Agent(
    role="HR Support Officer",
    goal="Answer employee policy questions accurately",
    knowledge_sources=[string_source, pdf_source]
)`
          }
        ]
      },
      {
        id: 'concepts-observability',
        title: 'Observability & Tracing',
        description: 'Track agent reasoning, token consumption, latency, and tool calls with OpenTelemetry, Langfuse, and Braintrust.',
        category: 'Core Concepts',
        icon: 'activity',
        tags: ['observability', 'traces', 'telemetry', 'langfuse'],
        content: `
# Observability & Tracing

CrewAI has built-in OpenTelemetry instrumentation and out-of-the-box telemetry hooks for leading observability vendors:

- **Arize Phoenix**
- **Braintrust**
- **Datadog LLM Observability**
- **Galileo**
- **Langfuse**
- **Langtrace**
- **Maxim**
- **OpenLIT**
- **Opik**
- **Weave**

---

### Enabling Native Tracing
Set the following environment variables:
\`\`\`bash
export CREWAI_TRACING_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
\`\`\`
        `
      }
    ]
  },
  {
    title: 'API Reference',
    icon: 'code',
    pages: [
      {
        id: 'api-kickoff',
        title: 'kickoff() & Execution',
        description: 'Complete API reference for synchronous and asynchronous kickoff methods.',
        category: 'API Reference',
        icon: 'play',
        tags: ['api', 'kickoff', 'async'],
        content: `
# API Reference: \`crew.kickoff()\`

Initiates crew execution. Returns a \`CrewOutput\` object containing raw string, token counts, task outputs, and serialized schemas.

### Signature
\`\`\`python
crew.kickoff(inputs: Optional[Dict[str, Any]] = None) -> CrewOutput
crew.kickoff_async(inputs: Optional[Dict[str, Any]] = None) -> Future[CrewOutput]
crew.kickoff_for_each(inputs: List[Dict[str, Any]]) -> List[CrewOutput]
\`\`\`

### Return Object: \`CrewOutput\`
- \`output.raw\`: Final text output string.
- \`output.pydantic\`: Populated Pydantic object (if task requested \`output_pydantic\`).
- \`output.json\`: Formatted JSON string or dict.
- \`output.tasks_output\`: List of individual \`TaskOutput\` items.
- \`output.token_usage\`: Dictionary with \`total_tokens\`, \`prompt_tokens\`, \`completion_tokens\`.
        `
      },
      {
        id: 'api-inputs',
        title: 'Inputs & State Serialization',
        description: 'Format inputs, pass parameters into task templates, and handle typed state.',
        category: 'API Reference',
        icon: 'file-text',
        tags: ['api', 'inputs', 'state'],
        content: `
# API Reference: Inputs & State

When calling \`crew.kickoff(inputs={...})\`, values in the dictionary interpolate into \`{variable}\` placeholders in agent goals, task descriptions, and backstories.

\`\`\`python
inputs = {
    "company": "Anthropic",
    "year": 2026,
    "focus": "Compute Scaling Laws"
}

crew.kickoff(inputs=inputs)
\`\`\`
        `
      },
      {
        id: 'api-agents-compliance',
        title: 'AGENTS.md & Docs Compliance',
        description: 'Verification checklist for CrewAI OSS standards: multimodal message_content_text, behavior-driven tests, and multilingual MDX sync.',
        category: 'API Reference',
        icon: 'check-square',
        tags: ['agents-md', 'compliance', 'translations', 'multimodal', 'tests'],
        content: `
# AGENTS.md & Documentation Standards Compliance

All contributions and studio exports in this repository strictly enforce the rules defined in \`AGENTS.md\` and \`DOCS_TRANSLATIONS.md\`.

---

## 1. Key Engineering Guidelines

- **Idiomatic Python & Structure**: Maintains existing CrewAI module boundaries, DRY, and YAGNI principles with minimal diffs.
- **Behavioral Unit Tests**: Unit tests in \`tests/test_agent_utils_and_governor.py\` verify observable behavior (multimodal content normalization, non-string key resilience, and quota failover) rather than internal implementation details.
- **Public API & Logic Documentation**: Complex logic such as the **Gemini Credit & Argon Quota Governor** and **Graphify State Sync** are documented both in-app and in \`docs/edge/\`.

---

## 2. Multimodal Message Content (\`message_content_text\`)

\`LLMMessage.content\` is typed as \`str | list[dict[str, Any]] | None\`. Calling \`str()\` on a multimodal list injects raw Python representation (\`[{'type': 'text', 'text': 'hi'}]\`) into prompts and memory.

- **Rule Enforced**: Always collapse messages using \`message_content_text(msg)\` from \`crewai.utilities.agent_utils\`.
- **Edge-Case Safety**: \`_content_parts_text\` safely skips blocks where \`text\` is not a \`str\` without raising exceptions, and returns \`"[multimodal content]"\` when a list contains no usable text blocks.

---

## 3. Documentation & Translation Synchronization (\`DOCS_TRANSLATIONS.md\`)

- **Editable Source**: Only \`docs/edge/en/*.mdx\` is modified as the English source of truth.
- **Frozen Snapshots Protected**: \`docs/v1.10.0/*\` and \`docs/images/*\` are untouched frozen snapshots.
- **4-Locale Lockstep Sync**: Every update to \`docs/edge/en/concepts/llms.mdx\` is synchronized across:
  - \`docs/edge/en/concepts/llms.mdx\` (English)
  - \`docs/edge/ar/concepts/llms.mdx\` (Arabic - \`ar\`)
  - \`docs/edge/ko/concepts/llms.mdx\` (Korean - \`ko\`)
  - \`docs/edge/pt-BR/concepts/llms.mdx\` (Brazilian Portuguese - \`pt-BR\`)
        `,
        codeSnippets: [
          {
            language: 'python',
            title: 'Compliant Multimodal Content Helper (AGENTS.md)',
            code: `from crewai.utilities.agent_utils import message_content_text

# Safe for None, str, or multimodal list[dict[str, Any]]:
text = message_content_text(msg)  # "" for None; joined text for a parts list`
          }
        ]
      }
    ]
  }
];
