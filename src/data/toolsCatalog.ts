export interface ToolItem {
  id: string;
  name: string;
  category: 'search' | 'scraping' | 'ai_ml' | 'database' | 'files' | 'automation' | 'cloud' | 'integration';
  categoryLabel: string;
  description: string;
  envKeys: string[];
  importStatement: string;
  codeSnippet: string;
  usageExample: string;
  popular?: boolean;
}

export const TOOLS_CATALOG: ToolItem[] = [
  {
    id: 'gmail_toolkit',
    name: 'GmailToolkit',
    category: 'integration',
    categoryLabel: 'Google Workspace',
    description: '1P Google Workspace Gmail integration for CrewAI agents. Reads incoming inbox threads (gmail.readonly) as task context and dispatches autonomous reports via Gmail (gmail.send) with explicit user confirmation.',
    envKeys: ['GOOGLE_OAUTH_CLIENT_ID', 'GMAIL_SCOPES'],
    importStatement: 'from crewai_tools import GmailToolkit',
    codeSnippet: 'gmail_tool = GmailToolkit(\n  scopes=["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"]\n)',
    usageExample: 'comms_agent = Agent(\n  role="Executive Communications Specialist",\n  goal="Triage incoming Gmail threads and send structured executive summaries",\n  backstory="Expert in inbox triage and client communications",\n  tools=[GmailToolkit()],\n  verbose=True\n)',
    popular: true
  },
  {
    id: 'serper_dev',
    name: 'SerperDevTool',
    category: 'search',
    categoryLabel: 'Search & Research',
    description: 'Fast Google Search API tailored for autonomous AI agents. Searches real-time web results, news, places, and images.',
    envKeys: ['SERPER_API_KEY'],
    importStatement: 'from crewai_tools import SerperDevTool',
    codeSnippet: 'search_tool = SerperDevTool()\n# Or scoped search:\nsearch_tool = SerperDevTool(search_url="https://google.com")',
    usageExample: 'researcher = Agent(\n  role="Senior Market Analyst",\n  goal="Search recent technological breakthroughs",\n  backstory="Expert at sifting through web noise",\n  tools=[SerperDevTool()],\n  verbose=True\n)',
    popular: true
  },
  {
    id: 'scrape_website',
    name: 'ScrapeWebsiteTool',
    category: 'scraping',
    categoryLabel: 'Web Scraping',
    description: 'Extracts cleanly formatted text or markdown directly from any webpage URL, stripping boilerplate ads and scripts.',
    envKeys: [],
    importStatement: 'from crewai_tools import ScrapeWebsiteTool',
    codeSnippet: 'scrape_tool = ScrapeWebsiteTool()\n# Optionally restrict to a specific site:\nsite_scraper = ScrapeWebsiteTool(website_url="https://news.ycombinator.com")',
    usageExample: 'content_fetcher = Agent(\n  role="Web Extractor",\n  goal="Scrape high-fidelity content from source links",\n  backstory="Specialized in structured web extraction",\n  tools=[ScrapeWebsiteTool()]\n)',
    popular: true
  },
  {
    id: 'firecrawl_scrape',
    name: 'FirecrawlScrapeWebsiteTool',
    category: 'scraping',
    categoryLabel: 'Web Scraping',
    description: 'Uses Firecrawl to turn dynamic JavaScript heavy websites and SPAs into clean, LLM-ready markdown.',
    envKeys: ['FIRECRAWL_API_KEY'],
    importStatement: 'from crewai_tools import FirecrawlScrapeWebsiteTool',
    codeSnippet: 'firecrawl_tool = FirecrawlScrapeWebsiteTool()',
    usageExample: 'scraper = Agent(\n  role="Deep Web Scraper",\n  goal="Turn JS-rendered portals into Markdown",\n  tools=[FirecrawlScrapeWebsiteTool()]\n)',
    popular: true
  },
  {
    id: 'code_interpreter',
    name: 'CodeInterpreterTool',
    category: 'ai_ml',
    categoryLabel: 'AI & ML',
    description: 'Executes Python code in a secure sandboxed environment to calculate formulas, analyze datasets, and generate charts.',
    envKeys: [],
    importStatement: 'from crewai_tools import CodeInterpreterTool',
    codeSnippet: 'code_tool = CodeInterpreterTool()',
    usageExample: 'math_agent = Agent(\n  role="Data Scientist",\n  goal="Calculate statistical distributions and correlations",\n  tools=[CodeInterpreterTool()]\n)',
    popular: true
  },
  {
    id: 'dalle_tool',
    name: 'DallETool',
    category: 'ai_ml',
    categoryLabel: 'AI & ML',
    description: 'Generates creative visuals and diagrams using OpenAI DALL-E 3 directly inside agent tasks.',
    envKeys: ['OPENAI_API_KEY'],
    importStatement: 'from crewai_tools import DallETool',
    codeSnippet: 'image_gen = DallETool(model="dall-e-3", size="1024x1024", quality="standard")',
    usageExample: 'creative_agent = Agent(\n  role="Creative Director",\n  goal="Generate marketing visuals for product launches",\n  tools=[DallETool()]\n)',
    popular: false
  },
  {
    id: 'vision_tool',
    name: 'VisionTool',
    category: 'ai_ml',
    categoryLabel: 'AI & ML',
    description: 'Inspects, OCRs, and answers natural language questions about local and web images.',
    envKeys: ['OPENAI_API_KEY'],
    importStatement: 'from crewai_tools import VisionTool',
    codeSnippet: 'vision_tool = VisionTool()',
    usageExample: 'inspector = Agent(\n  role="Visual QA Analyst",\n  goal="Inspect UI screenshots and identify UX anomalies",\n  tools=[VisionTool()]\n)'
  },
  {
    id: 'directory_read',
    name: 'DirectoryReadTool',
    category: 'files',
    categoryLabel: 'File & Document',
    description: 'Recursively lists and inspects directory trees, file metadata, and hierarchy on disk.',
    envKeys: [],
    importStatement: 'from crewai_tools import DirectoryReadTool',
    codeSnippet: 'dir_tool = DirectoryReadTool(directory="./workspace")',
    usageExample: 'auditor = Agent(\n  role="Code Auditor",\n  goal="Inspect repository structure and discover source files",\n  tools=[DirectoryReadTool()]\n)',
    popular: true
  },
  {
    id: 'file_read',
    name: 'FileReadTool',
    category: 'files',
    categoryLabel: 'File & Document',
    description: 'Reads text, markdown, configuration, or source code files from the local filesystem.',
    envKeys: [],
    importStatement: 'from crewai_tools import FileReadTool',
    codeSnippet: 'file_tool = FileReadTool()',
    usageExample: 'reviewer = Agent(\n  role="Code Reviewer",\n  goal="Read pull request diffs and explain code logic",\n  tools=[FileReadTool()]\n)',
    popular: true
  },
  {
    id: 'pdf_search',
    name: 'PDFSearchTool',
    category: 'files',
    categoryLabel: 'File & Document',
    description: 'Semantic vector search and question answering over PDF documents and enterprise reports.',
    envKeys: ['OPENAI_API_KEY'],
    importStatement: 'from crewai_tools import PDFSearchTool',
    codeSnippet: 'pdf_tool = PDFSearchTool(pdf="quarterly_report.pdf")',
    usageExample: 'analyst = Agent(\n  role="Financial Doc Auditor",\n  goal="Extract financial tables and disclosures from 10-K filings",\n  tools=[PDFSearchTool()]\n)',
    popular: true
  },
  {
    id: 'github_search',
    name: 'GithubSearchTool',
    category: 'search',
    categoryLabel: 'Search & Research',
    description: 'Semantic search across GitHub repositories, issues, discussions, pull requests, and codebases.',
    envKeys: ['GITHUB_TOKEN'],
    importStatement: 'from crewai_tools import GithubSearchTool',
    codeSnippet: 'gh_tool = GithubSearchTool(gh_token="ghp_...", repo="crewAIInc/crewAI")',
    usageExample: 'triage_agent = Agent(\n  role="Issue Triage Specialist",\n  goal="Find duplicates and search repo commits",\n  tools=[GithubSearchTool()]\n)'
  },
  {
    id: 'exa_search',
    name: 'ExaSearchTool',
    category: 'search',
    categoryLabel: 'Search & Research',
    description: 'Neural search engine designed specifically for AI models with semantic embeddings across the web.',
    envKeys: ['EXA_API_KEY'],
    importStatement: 'from crewai_tools import ExaSearchTool',
    codeSnippet: 'exa_tool = ExaSearchTool()',
    usageExample: 'deep_researcher = Agent(\n  role="AI Trend Researcher",\n  goal="Retrieve high quality scientific articles",\n  tools=[ExaSearchTool()]\n)'
  },
  {
    id: 'tavily_search',
    name: 'TavilySearchTool',
    category: 'search',
    categoryLabel: 'Search & Research',
    description: 'Search engine purpose-built for LLM retrieval and autonomous multi-agent deep research.',
    envKeys: ['TAVILY_API_KEY'],
    importStatement: 'from crewai_tools import TavilySearchTool',
    codeSnippet: 'tavily_tool = TavilySearchTool()',
    usageExample: 'news_agent = Agent(\n  role="Fact Checker",\n  goal="Verify live market data and claims with cited sources",\n  tools=[TavilySearchTool()]\n)',
    popular: true
  },
  {
    id: 'pg_search',
    name: 'PGSearchTool',
    category: 'database',
    categoryLabel: 'Database & Data',
    description: 'Performs semantic vector and text search on PostgreSQL databases using pgvector extension.',
    envKeys: ['DATABASE_URL'],
    importStatement: 'from crewai_tools import PGSearchTool',
    codeSnippet: 'pg_tool = PGSearchTool(db_uri="postgresql://user:pass@host/db", table_name="documents")',
    usageExample: 'db_agent = Agent(\n  role="Customer Records Searcher",\n  goal="Retrieve customer purchase histories from vector store",\n  tools=[PGSearchTool()]\n)'
  },
  {
    id: 'nl2sql_tool',
    name: 'NL2SQLTool',
    category: 'database',
    categoryLabel: 'Database & Data',
    description: 'Natural Language to SQL translator and executor with schema introspection and safe read locks.',
    envKeys: ['DATABASE_URL'],
    importStatement: 'from crewai_tools import NL2SQLTool',
    codeSnippet: 'sql_tool = NL2SQLTool(db_uri="postgresql://user:pass@localhost:5432/analytics")',
    usageExample: 'bi_agent = Agent(\n  role="BI Query Analyst",\n  goal="Convert user questions to SQL queries and return tabular data",\n  tools=[NL2SQLTool()]\n)'
  },
  {
    id: 'qdrant_search',
    name: 'QdrantVectorSearchTool',
    category: 'database',
    categoryLabel: 'Database & Data',
    description: 'High-performance vector similarity search across Qdrant collections with payload filtering.',
    envKeys: ['QDRANT_API_KEY', 'QDRANT_URL'],
    importStatement: 'from crewai_tools import QdrantVectorSearchTool',
    codeSnippet: 'qdrant_tool = QdrantVectorSearchTool(collection_name="support_kb")',
    usageExample: 'support_agent = Agent(\n  role="Knowledge Base Resolver",\n  goal="Search matching support articles with high semantic relevance",\n  tools=[QdrantVectorSearchTool()]\n)'
  },
  {
    id: 'zapier_actions',
    name: 'ZapierActionsTool',
    category: 'automation',
    categoryLabel: 'Automation',
    description: 'Connects AI agents to over 5,000+ business applications (Gmail, Slack, Jira, Salesforce) via Zapier NLA.',
    envKeys: ['ZAPIER_NLA_API_KEY'],
    importStatement: 'from crewai_tools import ZapierActionsTool',
    codeSnippet: 'zapier_tool = ZapierActionsTool()',
    usageExample: 'automation_agent = Agent(\n  role="Ops Automator",\n  goal="Trigger Slack alerts and update Jira issues on completion",\n  tools=[ZapierActionsTool()]\n)',
    popular: true
  },
  {
    id: 'browserbase_load',
    name: 'BrowserbaseLoadTool',
    category: 'scraping',
    categoryLabel: 'Web Scraping',
    description: 'Headless browser sandbox in the cloud with built-in CAPTCHA solving, residential proxies, and session replay.',
    envKeys: ['BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID'],
    importStatement: 'from crewai_tools import BrowserbaseLoadTool',
    codeSnippet: 'browser_tool = BrowserbaseLoadTool()',
    usageExample: 'web_agent = Agent(\n  role="Cloud Browser Navigator",\n  goal="Navigate complex multi-step authenticated web flows",\n  tools=[BrowserbaseLoadTool()]\n)'
  },
  {
    id: 's3_reader',
    name: 'S3ReaderTool',
    category: 'cloud',
    categoryLabel: 'Cloud Storage',
    description: 'Connects to AWS S3 buckets to stream, read, and parse blobs and CSV/Parquet archives.',
    envKeys: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    importStatement: 'from crewai_tools import S3ReaderTool',
    codeSnippet: 's3_tool = S3ReaderTool(bucket_name="company-logs")',
    usageExample: 'data_ingestion = Agent(\n  role="S3 Ingestion Worker",\n  goal="Download daily transaction dumps from cloud bucket",\n  tools=[S3ReaderTool()]\n)'
  },
  {
    id: 'file_write',
    name: 'FileWriteTool',
    category: 'files',
    categoryLabel: 'File & Document',
    description: 'Writes source code, TypeScript interfaces, SQL migrations, design tokens, and Markdown specifications directly to the project workspace.',
    envKeys: [],
    importStatement: 'from crewai_tools import FileWriteTool',
    codeSnippet: 'file_write_tool = FileWriteTool(directory="./src")',
    usageExample: 'architect = Agent(\n  role="Frontend Architect",\n  goal="Write modular React & TypeScript components to disk",\n  tools=[FileWriteTool()]\n)',
    popular: true
  },
  {
    id: 'jira_linear_pm',
    name: 'JiraLinearProjectTool',
    category: 'automation',
    categoryLabel: 'Project Management',
    description: 'Project management tool for Task Makers & Task Controllers. Creates epics, decomposes atomic sprint tasks, assigns story points, and tracks dependency blockers in Linear & Jira.',
    envKeys: ['LINEAR_API_KEY', 'JIRA_API_TOKEN'],
    importStatement: 'from crewai_tools import JiraLinearProjectTool',
    codeSnippet: 'pm_tool = JiraLinearProjectTool(workspace="full-stack-eng", auto_sync_dependencies=True)',
    usageExample: 'task_maker = Agent(\n  role="Lead Task Maker & Sprint Planner",\n  goal="Decompose PRDs into dependency-ordered Linear/Jira engineering tasks",\n  tools=[JiraLinearProjectTool()]\n)',
    popular: true
  },
  {
    id: 'github_project_board',
    name: 'GitHubProjectBoardTool',
    category: 'integration',
    categoryLabel: 'Project Management',
    description: 'Synchronizes CrewAI task controller gates, milestone checklists, issue assignments, and verified PR states with GitHub Projects v2 boards.',
    envKeys: ['GITHUB_TOKEN'],
    importStatement: 'from crewai_tools import GitHubProjectBoardTool',
    codeSnippet: 'board_tool = GitHubProjectBoardTool(repo="org/fullstack-app", project_number=1)',
    usageExample: 'task_controller = Agent(\n  role="Task Controller & QA Gatekeeper",\n  goal="Enforce Definition of Done and move verified tasks across GitHub Project columns",\n  tools=[GitHubProjectBoardTool()]\n)',
    popular: true
  },
  {
    id: 'figma_design_tokens',
    name: 'FigmaDesignTokensTool',
    category: 'ai_ml',
    categoryLabel: 'UI/UX & Design Systems',
    description: 'Extracts and validates W3C design tokens, Tailwind color scales, typographic hierarchy, bento-grid spacing, and WCAG AAA contrast ratios.',
    envKeys: ['FIGMA_ACCESS_TOKEN'],
    importStatement: 'from crewai_tools import FigmaDesignTokensTool',
    codeSnippet: 'design_tool = FigmaDesignTokensTool(export_format="tailwind_v4")',
    usageExample: 'ui_designer = Agent(\n  role="Principal UI/UX Designer",\n  goal="Generate high-craft dark/light design tokens and component anatomy specs",\n  tools=[FigmaDesignTokensTool()]\n)',
    popular: true
  },
  {
    id: 'docker_k8s_deploy',
    name: 'DockerK8sDeployTool',
    category: 'cloud',
    categoryLabel: 'DevOps & SRE',
    description: 'Generates and validates multi-stage Dockerfiles, Kubernetes deployment manifests, GitHub Actions CI/CD workflows, and container resource limits.',
    envKeys: ['KUBECONFIG', 'DOCKER_REGISTRY_TOKEN'],
    importStatement: 'from crewai_tools import DockerK8sDeployTool',
    codeSnippet: 'devops_tool = DockerK8sDeployTool(target_runtime="kubernetes", health_check_path="/api/health")',
    usageExample: 'devops_lead = Agent(\n  role="Principal DevOps & Cloud SRE",\n  goal="Automate zero-downtime CI/CD pipelines and container orchestration",\n  tools=[DockerK8sDeployTool()]\n)',
    popular: true
  }
];
