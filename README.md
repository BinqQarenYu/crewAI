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
| Gemini assistant & smart routing | **Real** — live `@google/genai` calls with key rotation |
| GitHub panel (connect PAT, push file, push app) | **Real** — calls the GitHub REST API |
| Env config panel (upload / reload `.env`) | **Real** |
| Crew "run" + reasoning log | **Simulated** — generates a plausible trace; crewAI is never executed |
| Jules dispatch & PR review | **Simulated** — PR numbers are randomly generated |
| Remote PC hub / Remote scan | **Simulated** — actions return canned summaries |
| Predictive scheduler / Pro Mode autopilot | **Simulated** |
| Telemetry latency ("measured RTT") | **Simulated** — random numbers, not measurements |

If you want the simulated modules to become real, the backend needs to shell out
to the actual `crewai` Python package and report real job state — see
[Roadmap](#roadmap).

## Project structure

```
server.ts                 Express server + API (single file, ~4.9k lines)
src/
  components/             React UI (CrewStudio, LangGraphView, dashboards…)
  lib/                    Shared helpers
crews/                    Example crew definitions
public/                   Static assets
run.bat                   Windows launcher
```

## Roadmap

1. Replace the simulated crew runner with a real Python subprocess calling `crewai`.
2. Split `server.ts` into route modules; split the largest components.
3. Add a test suite (currently none) and CI.
4. Label simulated modules in the UI itself, not just in this README.

## License

MIT — see [LICENSE](LICENSE).
