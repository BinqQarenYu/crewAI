# CrewAI Studio & Interactive Documentation Platform

A React + Vite + TypeScript web application and developer workbench for the **CrewAI Multi-Agent Automation Framework**.

## Overview

This project provides an interactive developer portal, documentation suite, and visual studio for building and running autonomous AI multi-agent workflows.

### Key Capabilities

1. **Interactive Documentation Browser**:
   - Comprehensive documentation covering Core Concepts (Agents, Crews, Tasks, Flows, LLMs, Memory, Knowledge, Observability), Guides, and API Reference.
   - Aspen Mintlify-style navigation with copyable code snippets, breadcrumbs, search, and language switching (EN, AR, KO, PT-BR).
   - Version support for Edge and v1.10.0 releases.

2. **Crew Studio Playground**:
   - Visual multi-agent orchestration workbench.
   - Create, configure, and inspect Agents with custom roles, goals, backstories, model selection, memory toggles, and toolkits.
   - Configure sequential and hierarchical task pipelines.
   - Run autonomous multi-agent simulation with real-time reasoning logs, tool call execution, and deliverable synthesis.
   - Export both standalone Python scripts (`crew.py`) and modern JSONC declarations (`crew.jsonc`).

3. **Flow Visualizer & State Inspector**:
   - Visual graph representation of event-driven state machines (`@start`, `@listen`, `@router`).
   - Step-by-step state machine runner with live Pydantic state inspections, mutation diffs, and audit checkpoints.

4. **Tools Ecosystem Catalog**:
   - Directory of 18+ CrewAI tools across Search, Web Scraping, AI/ML Sandboxes, Database & SQL, File Parsers, Cloud Storage, and Automation.
   - Required environment variables, code snippets, and usage examples.

5. **OpenTelemetry Observability & Trace Explorer**:
   - Sub-millisecond execution timeline with waterfall spans, token usage breakdowns, latency metrics, and payload inspector.

6. **Agent Skills & Setup Hub**:
   - One-click copy tool for coding assistants (Claude Code, Cursor, Windsurf, Codex) to install the official `crewaiinc/skills`.

## Quickstart: 1-Click Standalone Run

### Windows
Double-click `start.bat` (or `run.bat`).
It will automatically:
1. Verify Node.js
2. Generate `.env` from `.env.example` if not already present
3. Install dependencies (`npm install`) if needed
4. Open `http://localhost:3000` in your default browser
5. Launch the full-stack server

### macOS / Linux / WSL
```bash
./run.sh
```

### Manual Development
```bash
npm install
npm run dev
```

### Build & Compilation
```bash
npm run build
```


## Architecture
For a detailed look at the autonomous pipeline and Jules integration, see [Architecture & Jules Lifecycle](/.aistudio/artifacts/brain/5695ea9b-9941-4cad-8737-20fff04f28b1/ARCHITECTURE_AND_WORKFLOW.md).

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
