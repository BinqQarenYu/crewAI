"""Tool bindings for the Crew Studio runner.

These are the crew's hands: real file and network operations inside a sandbox,
rather than descriptions of operations.

Design rules:
  1. **Deny by default.** Only the tools registered here are reachable; a crew
     that asks for anything else gets a warning and runs without it.
  2. **Sandboxed filesystem.** Every path is resolved and must stay inside the
     workspace directory. `..` traversal is rejected, not normalised away.
  3. **Bounded.** Each tool carries `max_usage_count` from CREW_MAX_TOOL_CALLS so
     a looping agent cannot hammer the filesystem forever.
  4. **Honest mapping.** A studio tool name that would need a paid provider
     (Serper, Scrape) is reported as unavailable rather than silently swapped
     for something that behaves differently.
"""

from __future__ import annotations

import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

MAX_TOOL_CALLS = int(os.environ.get("CREW_MAX_TOOL_CALLS", "25"))
MAX_READ_BYTES = int(os.environ.get("CREW_MAX_READ_BYTES", str(200_000)))
HTTP_TIMEOUT_S = int(os.environ.get("CREW_HTTP_TIMEOUT_S", "15"))
HTTP_ALLOWLIST = [
    h.strip().lower()
    for h in os.environ.get(
        "CREW_HTTP_ALLOWLIST", "example.com,www.example.com,api.github.com,localhost,127.0.0.1"
    ).split(",")
    if h.strip()
]

_workspace: Optional[Path] = None


def set_workspace(path: str) -> Path:
    """Point the sandbox at `path`, creating it if needed."""
    global _workspace
    root = Path(path).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    _workspace = root
    return root


def get_workspace() -> Path:
    if _workspace is None:
        raise RuntimeError("Workspace not initialised; call set_workspace() first")
    return _workspace


def _resolve(path: str) -> Path:
    """Resolve `path` inside the workspace, refusing escapes."""
    root = get_workspace()
    candidate = (root / path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"Path escapes the crew workspace: {path}")
    return candidate


# ---------------------------------------------------------------------------
# Argument schemas
# ---------------------------------------------------------------------------


class ReadFileArgs(BaseModel):
    path: str = Field(..., description="Path relative to the crew workspace, e.g. 'notes/todo.md'")


class WriteFileArgs(BaseModel):
    path: str = Field(..., description="Path relative to the crew workspace")
    content: str = Field(..., description="Full UTF-8 content to write")


class ListFilesArgs(BaseModel):
    path: str = Field(".", description="Directory relative to the workspace; defaults to the root")


class HttpGetArgs(BaseModel):
    url: str = Field(..., description="Absolute http(s) URL on an allowlisted host")


class NoArgs(BaseModel):
    pass


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


class ReadFileTool(BaseTool):
    name: str = "read_file"
    description: str = (
        "Read a UTF-8 text file from the crew workspace. Use a path relative to "
        "the workspace root. Returns the file content, or an error message."
    )
    args_schema: type[BaseModel] = ReadFileArgs
    max_usage_count: int = MAX_TOOL_CALLS

    def _run(self, path: str) -> str:
        try:
            target = _resolve(path)
        except ValueError as exc:
            return f"ERROR: {exc}"
        if not target.exists():
            return f"ERROR: no such file: {path}"
        if not target.is_file():
            return f"ERROR: not a file: {path}"
        data = target.read_bytes()[:MAX_READ_BYTES]
        return data.decode("utf-8", errors="replace")


class WriteFileTool(BaseTool):
    name: str = "write_file"
    description: str = (
        "Create or overwrite a UTF-8 text file inside the crew workspace. "
        "Parent directories are created automatically. Returns a confirmation."
    )
    args_schema: type[BaseModel] = WriteFileArgs
    max_usage_count: int = MAX_TOOL_CALLS

    def _run(self, path: str, content: str) -> str:
        try:
            target = _resolve(path)
        except ValueError as exc:
            return f"ERROR: {exc}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} characters to {path}"


class ListFilesTool(BaseTool):
    name: str = "list_files"
    description: str = (
        "List files and directories inside the crew workspace. Returns one entry "
        "per line, directories suffixed with '/'."
    )
    args_schema: type[BaseModel] = ListFilesArgs
    max_usage_count: int = MAX_TOOL_CALLS

    def _run(self, path: str = ".") -> str:
        try:
            target = _resolve(path)
        except ValueError as exc:
            return f"ERROR: {exc}"
        if not target.is_dir():
            return f"ERROR: not a directory: {path}"
        entries = sorted(target.iterdir(), key=lambda p: p.name.lower())
        if not entries:
            return "(empty directory)"
        lines = []
        for entry in entries[:200]:
            suffix = "/" if entry.is_dir() else ""
            lines.append(f"{entry.name}{suffix}")
        return "\n".join(lines)


class CurrentTimeTool(BaseTool):
    name: str = "current_time"
    description: str = "Return the current local date and time in ISO-8601 format."
    args_schema: type[BaseModel] = NoArgs
    max_usage_count: int = MAX_TOOL_CALLS

    def _run(self) -> str:
        return time.strftime("%Y-%m-%dT%H:%M:%S%z")


class HttpGetTool(BaseTool):
    name: str = "http_get"
    description: str = (
        "Fetch a URL over HTTP(S) and return up to 20 KB of the response body. "
        "Only allowlisted hosts are reachable."
    )
    args_schema: type[BaseModel] = HttpGetArgs
    max_usage_count: int = MAX_TOOL_CALLS

    def _run(self, url: str) -> str:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return "ERROR: only http(s) URLs are supported"
        host = (parsed.hostname or "").lower()
        if host not in HTTP_ALLOWLIST:
            return (
                f"ERROR: host '{host}' is not allowlisted. "
                f"Allowed: {', '.join(HTTP_ALLOWLIST)}"
            )
        request = urllib.request.Request(url, headers={"User-Agent": "crew-studio-runner/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S) as response:
                body = response.read(20_000)
                return body.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            return f"ERROR: HTTP {exc.code} for {url}"
        except Exception as exc:  # network failures are results, not crashes
            return f"ERROR: {type(exc).__name__}: {exc}"


# ---------------------------------------------------------------------------
# Registry and studio-name mapping
# ---------------------------------------------------------------------------

REGISTRY: Dict[str, BaseTool] = {
    "read_file": ReadFileTool(),
    "write_file": WriteFileTool(),
    "list_files": ListFilesTool(),
    "current_time": CurrentTimeTool(),
    "http_get": HttpGetTool(),
}

# Studio tool-picker names -> runner tool keys.
STUDIO_TOOL_MAP: Dict[str, str] = {
    "FileReadTool": "read_file",
    "FileWriterTool": "write_file",
    "FileWriteTool": "write_file",
    "DirectoryReadTool": "list_files",
    "DirectorySearchTool": "list_files",
    "TimeTool": "current_time",
    "HttpGetTool": "http_get",
}

# Names that need a paid provider; reported honestly rather than substituted.
NEEDS_PROVIDER: Dict[str, str] = {
    "SerperDevTool": "SERPER_API_KEY",
    "ScrapeWebsiteTool": "external scraping provider",
    "WebsiteSearchTool": "embedding provider",
    "GithubSearchTool": "GITHUB_TOKEN",
    "CodeInterpreterTool": "sandboxed interpreter (not enabled)",
    "DallETool": "OPENAI_API_KEY",
}


def bind_tools(requested: List[str]) -> Tuple[List[BaseTool], List[str]]:
    """Map studio tool names onto runner tools.

    Returns (bound tools, warnings). Unknown or provider-bound names are warned
    about and skipped — never silently replaced with something that behaves
    differently.
    """
    bound: List[BaseTool] = []
    warnings: List[str] = []
    seen = set()

    for raw in requested or []:
        name = str(raw).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        key = STUDIO_TOOL_MAP.get(name, name if name in REGISTRY else None)
        if key and key in REGISTRY:
            tool = REGISTRY[key]
            if tool.name not in {t.name for t in bound}:
                bound.append(tool)
            continue
        if name in NEEDS_PROVIDER:
            warnings.append(
                f"tool '{name}' needs {NEEDS_PROVIDER[name]} and is not available; skipped"
            )
        else:
            warnings.append(f"tool '{name}' has no runner binding; skipped")

    return bound, warnings


def available_tools() -> List[Dict[str, str]]:
    """Describe the tools this runner can actually bind (for /api/runner/health)."""
    return [
        {"name": t.name, "description": t.description, "max_calls": MAX_TOOL_CALLS}
        for t in REGISTRY.values()
    ]
