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

`run_failed` carries `error` and a truncated `trace`. Tool activity appears as
`tool_started` / `tool_finished` / `tool_error`.

## Tools (acting, not describing)

`tools.py` gives agents real capabilities inside a sandbox:

| Tool | What it does |
|---|---|
| `read_file` | read a UTF-8 file in the workspace |
| `write_file` | create/overwrite a file, parents auto-created |
| `list_files` | list a directory |
| `current_time` | ISO-8601 timestamp |
| `http_get` | fetch an allowlisted host, 20 KB cap |

Rules, all verified:

- **Sandboxed**: every path is resolved and must stay inside `--workspace`
  (default `<repo>/.crew-workspace`). `../escape.txt` and absolute paths are
  rejected — no file escapes.
- **Bounded**: each tool carries `max_usage_count` (default 25,
  `CREW_MAX_TOOL_CALLS`), so a looping agent cannot hammer the disk.
- **Network allowlist**: `CREW_HTTP_ALLOWLIST`.
- **Honest mapping**: studio names needing a paid provider (`SerperDevTool`,
  `ScrapeWebsiteTool`, …) are reported unavailable and skipped, never swapped
  for something with different behaviour.

### Local-model tool calling

Small models often emit a tool call as *text* (`{"name":"write_file",…}`)
instead of using the tool channel, so nothing executes. Two mitigations:

1. `--native-tools auto|on|off` wires `function_calling_llm` for models with
   native function calling (auto: on for Ollama models).
2. A **text-mode fallback** executes a JSON tool call found in the final answer,
   emits `tool_started`/`tool_finished` with `"source": "text_fallback"`, and
   appends the real result. It warns in the stream rather than pretending the
   framework did it.

## Memory between runs

The gateway appends every finished run to `crews/<name>/memory.json` (last 50).
When present the runner is passed `--memory-file` and prepends a short journal to
the **first** task:

```
Context from previous runs of this crew (most recent last):
- [2026-10-24T16:05:08.638Z] succeeded: A git repository is …
Use this only as background; do not repeat it verbatim.
```

A run journal, not vector memory — deliberately dependency-free.

## Budgets

| Guard | Where |
|---|---|
| `--max-tokens` / `CREW_MAX_TOKENS_PER_RUN` | run fails if crewAI reports more; output withheld |
| `CREW_MAX_TOOL_CALLS` | per-tool `max_usage_count` |
| `CREW_RUN_TIMEOUT_MS` | gateway kills the process |
| `CREW_MAX_CONCURRENT_RUNS` | gateway returns 429 beyond the cap |

## Design notes

- **Tracing is disabled** (`CREWAI_TRACING_ENABLED=false`). Without this, crewAI
  prompts "Share this execution trace?" on first run and blocks the process.
- **One process per run**, spawned by `server/crewRunner.ts`, so a run can be
  killed and timed out independently.
- `crews/<name>/crew.jsonc` is the unit of work. The studio writes it, the runner
  reads it, and `crewai run` can consume the same folder from a terminal.
