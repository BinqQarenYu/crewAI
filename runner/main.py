"""Crew Studio runner.

Loads a Crew Studio crew definition (the JSON/JSONC the studio exports), builds
real crewAI `Agent`/`Task`/`Crew` objects, executes the crew, and streams one
JSON object per line on stdout so the Node gateway can forward them over SSE.

Protocol (one JSON object per line, stdout):
    {"type": "run_started",   "run_id": ..., "crew": ..., "agents": n, "tasks": m}
    {"type": "task_started",  "task": ..., "agent": ...}
    {"type": "task_completed","task": ..., "output": "..."}
    {"type": "agent_started", "agent": ...}
    {"type": "agent_finished","agent": ...}
    {"type": "log",           "level": ..., "message": ...}
    {"type": "run_completed", "run_id": ..., "output": "...", "duration_ms": ...}
    {"type": "run_failed",    "run_id": ..., "error": "...", "duration_ms": ...}

Every event carries "ts". Anything the runner cannot do honestly is reported as
a "log" event with level "warning" rather than silently faked.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import traceback
from typing import Any, Dict, List, Optional

# --------------------------------------------------------------------------
# Keep stdout clean for the JSONL protocol.
#
# crewAI renders rich panels and, on first run, asks whether to upload an
# execution trace. Both write to stdout, which would corrupt the event stream.
# We therefore capture the real stdout for events only and point sys.stdout at
# stderr for everything else. Tracing is disabled because the runner is
# non-interactive and must never block on a prompt.
# --------------------------------------------------------------------------
_EVENT_STREAM = sys.stdout
# Everything else — crewAI's rich panels, warnings, stray prints — goes to
# stderr. Without this the event stream is not machine-parseable.
sys.stdout = sys.stderr

os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("CREWAI_TELEMETRY_OPT_OUT", "true")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")


# --------------------------------------------------------------------------
# Event emission
# --------------------------------------------------------------------------


def emit(payload: Dict[str, Any]) -> None:
    """Write a single JSON line to the real stdout and flush immediately."""
    payload.setdefault("ts", time.time())
    _EVENT_STREAM.write(json.dumps(payload, default=str) + "\n")
    _EVENT_STREAM.flush()


def log(message: str, level: str = "info", **extra: Any) -> None:
    emit({"type": "log", "level": level, "message": message, **extra})


# --------------------------------------------------------------------------
# JSONC parsing (the studio emits `crew.jsonc`)
# --------------------------------------------------------------------------


def strip_jsonc(text: str) -> str:
    """Remove // and /* */ comments plus trailing commas, respecting strings."""
    out: List[str] = []
    i, n = 0, len(text)
    in_string = False
    escaped = False
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "/":
            while i < n and text[i] not in "\r\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    cleaned = "".join(out)
    # Trailing commas before } or ]
    return re.sub(r",(\s*[}\]])", r"\1", cleaned)


def load_crew_definition(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8-sig") as fh:
        raw = fh.read()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(strip_jsonc(raw))


# --------------------------------------------------------------------------
# Model configuration
# --------------------------------------------------------------------------

DEFAULT_MODEL = os.environ.get("CREW_DEFAULT_MODEL", "ollama/llama3.2")
OLLAMA_BASE = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
if OLLAMA_BASE and not OLLAMA_BASE.startswith("http"):
    OLLAMA_BASE = f"http://{OLLAMA_BASE}"


def resolve_model(requested: Optional[str]) -> str:
    """Map the studio's model label onto a crewAI/LiteLLM model string."""
    if not requested:
        return DEFAULT_MODEL
    model = str(requested).strip()
    if not model:
        return DEFAULT_MODEL
    # Already provider-qualified (e.g. "ollama/llama3.2", "openai/gpt-4o").
    if "/" in model:
        return model
    lowered = model.lower()
    if lowered.startswith(("gpt-", "o1", "o3")):
        return f"openai/{model}"
    if lowered.startswith("claude"):
        return f"anthropic/{model}"
    if lowered.startswith("gemini"):
        return f"gemini/{model}"
    # Bare local model names are assumed to be Ollama tags.
    return f"ollama/{model}"


def build_llm(requested: Optional[str]):
    from crewai import LLM

    model = resolve_model(requested)
    kwargs: Dict[str, Any] = {}
    if model.startswith("ollama/"):
        kwargs.update(base_url=OLLAMA_BASE, temperature=0.2)
    log(f"Using model: {model}", model=model)
    return LLM(model=model, **kwargs)


# --------------------------------------------------------------------------
# Crew construction
# --------------------------------------------------------------------------


def build_crew(definition: Dict[str, Any], model_override: Optional[str]):
    from crewai import Agent, Crew, Process, Task

    agents_spec = definition.get("agents") or []
    tasks_spec = definition.get("tasks") or []
    if not agents_spec:
        raise ValueError("Crew definition has no agents")
    if not tasks_spec:
        raise ValueError("Crew definition has no tasks")

    crew_model = model_override or definition.get("model") or definition.get("manager_model")

    agents_by_id: Dict[str, Any] = {}
    agent_objects: List[Any] = []

    for spec in agents_spec:
        aid = str(spec.get("id") or spec.get("name") or f"agent-{len(agents_by_id) + 1}")
        tools = spec.get("tools") or []
        if tools:
            # Honest reporting: tool bindings are not wired up yet, so a crew that
            # asks for tools runs without them rather than pretending otherwise.
            log(
                f"Agent '{spec.get('name') or aid}' requested tools {tools}; "
                "tool binding is not implemented yet, running without them.",
                level="warning",
                agent=aid,
            )
        agent = Agent(
            role=spec.get("role") or spec.get("name") or aid,
            goal=spec.get("goal") or "Complete the assigned task.",
            backstory=spec.get("backstory") or "An autonomous agent in Crew Studio.",
            llm=build_llm(spec.get("model") or crew_model),
            verbose=bool((spec.get("settings") or {}).get("verbose", True)),
            allow_delegation=bool((spec.get("settings") or {}).get("allow_delegation", False)),
            max_iter=int((spec.get("settings") or {}).get("max_iter", 15)),
            tools=[],
        )
        agents_by_id[aid] = agent
        agent_objects.append(agent)

    tasks_by_id: Dict[str, Any] = {}
    task_objects: List[Any] = []

    ordered = sorted(
        tasks_spec,
        key=lambda t: (t.get("sequence_order") is None, t.get("sequence_order") or 0),
    )

    for spec in ordered:
        tid = str(spec.get("id") or spec.get("name") or f"task-{len(task_objects) + 1}")
        agent_id = str(spec.get("agent") or "")
        agent_obj = agents_by_id.get(agent_id)
        if agent_obj is None:
            if agent_id:
                log(
                    f"Task '{spec.get('name') or tid}' references unknown agent '{agent_id}'; "
                    "assigning the first agent.",
                    level="warning",
                    task=tid,
                )
            agent_obj = agent_objects[0]

        context_specs = spec.get("depends_on") or []
        context_tasks = [tasks_by_id[c] for c in context_specs if c in tasks_by_id]

        task = Task(
            description=spec.get("description") or "",
            expected_output=spec.get("expected_output") or "A complete, clear result.",
            agent=agent_obj,
            context=context_tasks or None,
        )
        tasks_by_id[tid] = task
        task_objects.append(task)

    process_name = str(definition.get("process") or "sequential").lower()
    if "hier" in process_name:
        process = Process.hierarchical
        crew_kwargs: Dict[str, Any] = {"manager_llm": build_llm(crew_model)}
    else:
        process = Process.sequential
        crew_kwargs = {}

    crew = Crew(
        agents=agent_objects,
        tasks=task_objects,
        process=process,
        verbose=False,
        **crew_kwargs,
    )
    return crew, list(agents_by_id.keys()), list(tasks_by_id.keys())


# --------------------------------------------------------------------------
# Event bridge: crewAI event bus -> JSONL
# --------------------------------------------------------------------------


def install_event_bridge() -> List[str]:
    """Subscribe to crewAI's event bus and forward events as JSONL.

    crewAI 1.15 exposes events under `crewai.events.types.*` and the bus at
    `crewai.events.event_bus`. Each subscription is guarded so a renamed class
    degrades to fewer events rather than crashing the run.
    """
    installed: List[str] = []
    try:
        from crewai.events.event_bus import crewai_event_bus
    except Exception as exc:  # pragma: no cover - version dependent
        log(f"Event bus unavailable ({exc}); streaming start/finish only.", level="warning")
        return installed

    def subscribe(event_name: str, module_name: str, mapper) -> None:
        try:
            module = __import__(module_name, fromlist=[event_name])
            event_cls = getattr(module, event_name)
        except Exception:
            return

        def handler(*args, **kwargs):
            event = kwargs.get("event")
            if event is None and args:
                event = args[-1]
            try:
                payload = mapper(event)
                payload.setdefault("event", event_name)
                emit(payload)
            except Exception as exc:  # never let a listener break the run
                emit({"type": "log", "level": "debug", "message": f"{event_name}: {exc}"})

        crewai_event_bus.on(event_cls)(handler)
        installed.append(event_name)

    def _role(event: Any) -> str:
        """Resolve an agent role from whichever field the event populates."""
        direct = getattr(event, "agent_role", None)
        if direct:
            return str(direct)
        agent = getattr(event, "agent", None)
        role = getattr(agent, "role", None) if agent is not None else None
        if role:
            return str(role)
        task = getattr(event, "task", None)
        task_agent = getattr(task, "agent", None) if task is not None else None
        return str(getattr(task_agent, "role", "") or "")

    T = "crewai.events.types.task_events"
    A = "crewai.events.types.agent_events"
    C = "crewai.events.types.crew_events"

    subscribe(
        "TaskStartedEvent",
        T,
        lambda e: {
            "type": "task_started",
            "task": getattr(e, "task_name", "") or "",
            "task_id": getattr(e, "task_id", ""),
            "agent": _role(e),
        },
    )
    subscribe(
        "TaskCompletedEvent",
        T,
        lambda e: {
            "type": "task_completed",
            "task": getattr(e, "task_name", "") or "",
            "task_id": getattr(e, "task_id", ""),
            "agent": _role(e),
            "output": str(getattr(e, "output", "") or "")[:4000],
        },
    )
    subscribe(
        "TaskFailedEvent",
        T,
        lambda e: {
            "type": "task_failed",
            "task": getattr(e, "task_name", "") or "",
            "error": str(getattr(e, "error", "") or "task failed"),
        },
    )
    subscribe(
        "AgentExecutionStartedEvent",
        A,
        lambda e: {
            "type": "agent_started",
            "agent": _role(e),
            "task": getattr(e, "task_name", "") or "",
        },
    )
    subscribe(
        "AgentExecutionCompletedEvent",
        A,
        lambda e: {
            "type": "agent_finished",
            "agent": _role(e),
            "task": getattr(e, "task_name", "") or "",
        },
    )
    subscribe(
        "AgentExecutionErrorEvent",
        A,
        lambda e: {
            "type": "agent_error",
            "agent": _role(e),
            "error": str(getattr(e, "error", "") or "agent error"),
        },
    )
    subscribe(
        "CrewKickoffCompletedEvent",
        C,
        lambda e: {
            "type": "crew_stats",
            "total_tokens": getattr(e, "total_tokens", None),
        },
    )
    return installed


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Crew Studio runner")
    parser.add_argument("--crew", required=True, help="Path to crew definition JSON/JSONC")
    parser.add_argument("--run-id", default="local", help="Run identifier for event correlation")
    parser.add_argument("--inputs", default="{}", help="JSON object of crew inputs")
    parser.add_argument("--model", default=None, help="Override model for all agents")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and validate the crew without calling any LLM",
    )
    args = parser.parse_args()

    run_id = args.run_id
    started = time.time()

    try:
        definition = load_crew_definition(args.crew)
    except Exception as exc:
        emit({"type": "run_failed", "run_id": run_id, "error": f"Cannot read crew definition: {exc}", "duration_ms": 0})
        return 2

    try:
        inputs = json.loads(args.inputs or "{}")
    except json.JSONDecodeError as exc:
        emit({"type": "run_failed", "run_id": run_id, "error": f"Invalid --inputs JSON: {exc}", "duration_ms": 0})
        return 2

    try:
        crew, agent_ids, task_ids = build_crew(definition, args.model)
    except Exception as exc:
        emit(
            {
                "type": "run_failed",
                "run_id": run_id,
                "error": f"Crew could not be constructed: {exc}",
                "trace": traceback.format_exc(),
                "duration_ms": int((time.time() - started) * 1000),
            }
        )
        return 3

    emit(
        {
            "type": "run_started",
            "run_id": run_id,
            "crew": definition.get("name") or "untitled-crew",
            "agents": len(agent_ids),
            "tasks": len(task_ids),
            "process": str(definition.get("process") or "sequential"),
        }
    )

    if args.dry_run:
        emit(
            {
                "type": "run_completed",
                "run_id": run_id,
                "output": "dry-run: crew constructed successfully, no LLM called",
                "duration_ms": int((time.time() - started) * 1000),
                "dry_run": True,
            }
        )
        return 0

    installed = install_event_bridge()
    log(f"Event bridge active ({len(installed)} handlers)", events=installed)

    try:
        result = crew.kickoff(inputs=inputs)
        output = getattr(result, "raw", None) or str(result)
        emit(
            {
                "type": "run_completed",
                "run_id": run_id,
                "output": str(output),
                "duration_ms": int((time.time() - started) * 1000),
            }
        )
        return 0
    except Exception as exc:
        emit(
            {
                "type": "run_failed",
                "run_id": run_id,
                "error": f"{type(exc).__name__}: {exc}",
                "trace": traceback.format_exc()[-4000:],
                "duration_ms": int((time.time() - started) * 1000),
            }
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
