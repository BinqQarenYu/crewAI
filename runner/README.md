# Crew Studio runner

Executes Crew Studio crew definitions with the **real** [crewAI](https://github.com/crewAIInc/crewAI)
framework and streams execution events as JSONL on stdout for the Node gateway.

This is the component that makes "Run" mean something. Before it existed, the
studio generated a plausible-looking trace; now every event comes from crewAI's
event bus.

## Requirements

- Python **3.10–3.13** (crewAI does not support 3.14 yet). `uv` handles this.
- [uv](https://docs.astral.sh/uv/)

## Install

From the repository root:

```bash
cd runner
uv venv --python 3.12 .venv
uv pip install crewai
```

Or use the root script: `npm run runner:install`.

## Run a crew

```bash
# Validate the definition without calling any model
.venv/Scripts/python.exe main.py --crew examples/smoke.crew.jsonc --dry-run

# Execute for real (defaults to ollama/llama3.2)
.venv/Scripts/python.exe main.py --crew examples/smoke.crew.jsonc --run-id demo
```

Model selection, in priority order: `--model` → `model` in the definition →
`manager_model` → `CREW_DEFAULT_MODEL` → `ollama/llama3.2`.

Bare model names are assumed to be Ollama tags; `openai/gpt-4o` style
provider-qualified names pass through unchanged.

## Event protocol

One JSON object per line on **stdout**. Everything else — crewAI's rich panels,
warnings, tracebacks — is redirected to stderr so the stream stays parseable.

```json
{"type":"run_started","run_id":"…","crew":"…","agents":2,"tasks":2,"process":"sequential"}
{"type":"task_started","task":"research_task","agent":"Repository Researcher"}
{"type":"agent_started","agent":"Repository Researcher"}
{"type":"task_completed","task":"research_task","agent":"…","output":"…"}
{"type":"crew_stats","total_tokens":395}
{"type":"run_completed","run_id":"…","output":"…","duration_ms":12800}
```

`run_failed` carries `error` and a truncated `trace`.

## Design notes

- **Tracing is disabled** (`CREWAI_TRACING_ENABLED=false`). Without this, crewAI
  prompts "Share this execution trace?" on first run and blocks the process.
- **Tools are not bound yet.** A crew that requests tools logs a `warning` event
  and runs without them, rather than silently pretending.
- **One process per run**, spawned by `server/crewRunner.ts`, so a run can be
  killed and timed out independently.
- `crews/<name>/crew.jsonc` is the unit of work. The studio writes it, the runner
  reads it, and `crewai run` can consume the same folder from a terminal.
