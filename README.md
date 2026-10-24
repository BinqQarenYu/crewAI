# Crew Studio

A React + Vite + TypeScript workbench for exploring the
[CrewAI](https://github.com/crewAIInc/crewAI) multi-agent framework: an agent/crew
configurator, flow visualizer, tool catalog, and a Gemini-backed assistant.

> **Not affiliated with CrewAI, Inc.** "CrewAI" is a trademark of CrewAI, Inc.
> This project is an independent UI that references their framework by name.
> It does not vendor, bundle, or execute crewAI code.

> **Status: prototype.** The UI is functional; several backend modules are
> simulated for demonstration. See [What is real vs. simulated](#what-is-real-vs-simulated)
> before relying on any output.

## Quickstart

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3000
```

On Windows you can also double-click `run.bat`, which installs dependencies on
first run and starts the dev server.

Copy `.env.example` to `.env` and fill in the keys you need:

```powershell
Copy-Item .env.example .env
```

## Configuration

Everything is read from `.env` (or the process environment).

| Variable | Purpose |
| :--- | :--- |
| `GEMINI_API_KEY_0…3` | Gemini keys, rotated round-robin. The only live LLM path. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` | Accepted and surfaced in the UI; wiring is partial. |
| `GITHUB_TOKEN` | Personal access token for the GitHub panel (push file / push app). |
| `JULES_API_KEY` | Reserved for the Jules integration (see below). |
| `OLLAMA_HOST` | Local Ollama endpoint for the model status panel. |
| `BIND_HOST` | Interface to bind. Defaults to `127.0.0.1`. |
| `ALLOWED_ORIGINS` | Comma-separated extra CORS origins (e.g. a tunnel URL). |
| `ALLOWED_HOSTS` | Comma-separated extra hostnames for the Host-header guard. |

## Security model

This process holds paid API keys and a GitHub token, so it is deliberately local-only:

- Binds to `127.0.0.1` by default. Set `BIND_HOST=0.0.0.0` only if you understand
  the exposure.
- CORS is an explicit allowlist (localhost + `ALLOWED_ORIGINS`), not a reflection
  of any origin.
- A middleware rejects requests whose `Origin` or `Host` header is not allowed,
  which also blocks DNS-rebinding and cross-site request attacks.
- `POST /api/config/upload-env` only accepts `KEY=VALUE` lines and caps the body
  at 64 KB.

**There is no user authentication.** Treat the server as a single-user local tool.
Never expose it to the internet as-is.

## What is real vs. simulated

Being explicit here matters: a dashboard that reports invented numbers is worse
than no dashboard.

| Module | Status |
| :--- | :--- |
| Agent / crew / task configuration UI | **Real** — full CRUD in local state, export to `crew.py` / `crew.jsonc` |
| Crew execution ("Run") | **Real** — a Python 3.12 runner drives crewAI and streams its event bus over SSE |
| Gemini assistant & smart routing | **Real** — live `@google/genai` calls with key rotation |
| GitHub panel (connect PAT, push file, push app) | **Real** — calls the GitHub REST API |
| Env config panel (upload / reload `.env`) | **Real** |

Features that were previously simulated have been **removed** rather than faked:
Jules dispatch and PR review, Remote PC / QR remote scan, PRO Mode autopilot,
the predictive scheduler, webhooks, and the generated `standalone.bat` download.
Their API routes return `404`, and unmatched `/api/*` paths now return a JSON
`404` instead of the SPA `index.html` — which previously masked missing
endpoints with a `200 text/html`.

If you want any of those back, they need a real implementation — see
[Roadmap](#roadmap).

## Project structure

```
server.ts                 Express server + API (route handlers)
server/crewRunner.ts      Real crew execution: spawn runner, SSE, run registry
runner/                   Python 3.12 crewAI runner (JSONL event protocol)
src/
  components/             React UI (CrewStudio, LangGraphView, dashboards…)
  services/realRun.ts     Client for start + SSE subscription
crews/                    Crew definitions on disk (crews/<name>/crew.jsonc)
public/                   Static assets
run.bat                   Windows launcher
```

## Roadmap

1. Bind real crewAI tools to the studio's tool picker (currently unbound, warned).
2. Persist runs in SQLite so history survives a restart.
3. Split `server.ts` into route modules; split the largest components.
4. Add a test suite (currently none) and CI.
5. Remove the remaining panels in `CrewStudio` that still call removed endpoints
   (`PredictiveSchedulerModule`, `AutonomyStrategyDashboard`, PR-review module).

## License

MIT — see [LICENSE](LICENSE).
