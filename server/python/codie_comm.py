#!/usr/bin/env python3
"""The website Python communication script — the robot-script runner.

The backend launches this script; it drives the robot-scripts through the
`codie` package's high-level API, which talks to the Node.js backend's REST
API (the BLE layer lives in the backend). Every step is emitted as a JSON
line on stdout so the frontend can show a live log.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

# The repo root (server/python/codie_comm.py -> server/python -> server -> repo)
REPO_ROOT = Path(__file__).resolve().parents[2]
CODIE_API_DIR = REPO_ROOT / "codie-api"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(CODIE_API_DIR) not in sys.path:
    sys.path.insert(0, str(CODIE_API_DIR))

from codie.api import CodieApi, CodieApiError  # noqa: E402
from codie.robot import Robot  # noqa: E402

__all__ = ["Context", "ScriptError", "ScriptAborted", "ScriptRunner", "list_scripts", "main"]

#: the scripts' default location
DEFAULT_SCRIPT_DIR = Path(__file__).resolve().parent / "scripts"

#: maximum run length (seconds) — the safety limit
DEFAULT_TIMEOUT_S = 120.0


class ScriptError(RuntimeError):
    """A script error (the run stops, the robot is stopped)."""


class ScriptAborted(ScriptError):
    """The run was aborted (stop button, deadline, signal)."""


class _RobotProxy:
    """A shell around the robot API — every call emits a `step` event."""

    def __init__(self, robot: Robot, emit: Callable[[str, dict[str, Any]], None]):
        self._robot = robot
        self._emit = emit

    def __getattr__(self, name: str):
        func = getattr(self._robot, name)

        def wrapper(*args, **kwargs):
            self._emit("step", _describe_call(func, args, kwargs))
            return func(*args, **kwargs)

        return wrapper


def _describe_call(func: Callable[..., Any], args: tuple, kwargs: dict) -> dict[str, Any]:
    """The call's arguments in JSON-friendly form (for the step event)."""
    return {"args": list(args), **kwargs}


class Context:
    """What a robot-script receives.

    `ctx.robot` — the robot API (a proxy that emits `step` events).
    `ctx.log(message)` — append to the log.
    `ctx.wait(ms)` — interruptible sleep.
    """

    def __init__(
        self,
        robot: Robot,
        log: Callable[[str], None],
        wait: Callable[[float], None],
        abort: Callable[[], None],
    ):
        self.robot = _RobotProxy(robot, lambda event: None)  # replaced by runner
        self._log = log
        self._wait = wait
        self._abort = abort
        self._stopped = False

    def log(self, message: str) -> None:
        self._log(str(message))

    def wait(self, ms: float) -> None:
        if self._stopped:
            raise ScriptAborted("the script was aborted while waiting")
        self._wait(ms / 1000.0)

    def stop(self) -> None:
        """Request abort from within the script."""
        self._stopped = True
        self._abort()


class ScriptRunner:
    """Execute one robot-script with events and safety limits."""

    def __init__(
        self,
        address: str,
        api_url: str,
        script_dir: Path | None = None,
        timeout_s: float = DEFAULT_TIMEOUT_S,
    ):
        self.address = address
        self.api_url = api_url
        self.script_dir = script_dir or DEFAULT_SCRIPT_DIR
        self.timeout_s = timeout_s
        self._events: list[dict[str, Any]] = []
        self._stop_requested = False

    # --- events -----------------------------------------------------

    def _emit(self, event: str, payload: dict[str, Any] | None = None) -> None:
        item = {"event": event, **(payload or {})}
        self._events.append(item)
        sys.stdout.write(json.dumps(item, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def _log(self, message: str) -> None:
        self._emit("log", {"text": message})

    # --- running -----------------------------------------------------

    def run(self, name: str) -> int:
        """Load and run a script by name. Returns the exit code."""
        path = self._resolve_script(name)
        if path is None:
            self._emit("error", {"text": f"script not found: {name}"})
            return 1

        run = self._load_script(path)
        ctx = Context(
            robot=None,  # set below after the API is ready
            log=self._log,
            wait=self._wait,
            abort=self._abort,
        )

        api = CodieApi(base_url=self.api_url, address=self.address)
        robot = Robot(api)
        ctx.robot = _RobotProxy(robot, lambda event: self._emit("step", event))

        self._emit("start", {"name": name, "address": self.address})

        try:
            run(ctx)
            if not self._stop_requested:
                self._emit("done", {"name": name})
        except ScriptAborted:
            self._emit("stopped", {"name": name})
            return 130
        except ScriptError as error:
            self._emit("error", {"name": name, "text": str(error)})
            return 1
        except Exception as error:  # noqa: BLE001
            self._emit("error", {"name": name, "text": f"unexpected: {error}"})
            return 1
        finally:
            try:
                robot.stop()
            except Exception:  # noqa: BLE001
                pass

        return 0

    def _wait(self, seconds: float) -> None:
        import time

        deadline = time.time() + seconds
        while time.time() < deadline:
            if self._stop_requested:
                raise ScriptAborted("the script was aborted while waiting")
            time.sleep(min(0.05, deadline - time.time()))

    def _abort(self) -> None:
        self._stop_requested = True

    def request_stop(self) -> None:
        """Called from outside (stop button / deadline) to abort the run."""
        self._stop_requested = True

    # --- script resolution ------------------------------------------

    def _resolve_script(self, name: str) -> Path | None:
        candidates = [
            self.script_dir / f"{name}.py",
            Path(name),
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate.resolve()
        return None

    def _load_script(self, path: Path) -> Callable[[Context], None]:
        import importlib.util

        spec = importlib.util.spec_from_file_location(f"codie_script_{path.stem}", path)
        if spec is None or spec.loader is None:
            raise ScriptError(f"cannot load script: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not hasattr(module, "run") or not callable(module.run):
            raise ScriptError(f"script {path} has no run(ctx) function")
        return module.run


# --- script listing ------------------------------------------------------

def _script_meta(path: Path) -> dict[str, Any]:
    """A script's metadata (without loading the module)."""
    title = path.stem.replace("_", " ").title()
    description = ""
    try:
        text = path.read_text(encoding="utf-8")
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("# title:"):
                title = stripped[len("# title:"):].strip()
            elif stripped.startswith("# description:"):
                description = stripped[len("# description:"):].strip()
    except OSError:
        pass
    return {"name": path.stem, "title": title, "description": description}


def list_scripts(script_dir: Path | None = None) -> list[dict[str, Any]]:
    """The list of scripts (name, title, description)."""
    directory = script_dir or DEFAULT_SCRIPT_DIR
    if not directory.is_dir():
        return []
    return [
        _script_meta(path)
        for path in sorted(directory.glob("*.py"))
        if path.is_file()
    ]


def firmware_surface() -> dict[str, Any]:
    """The firmware interface register as JSON (the robot's real surface)."""
    # This is fetched from the backend's REST API; here we return a minimal
    # descriptor so the CLI --firmware flag works standalone.
    return {"interfaces": [], "note": "fetch /api/firmware from the backend"}


def console_command(address: str, command: str, api_url: str = "http://localhost:3000") -> dict[str, Any]:
    """Execute one firmware console command on the robot."""
    try:
        api = CodieApi(base_url=api_url, address=address)
        # parse "get|set|call <interface> <op> [args...]"
        parts = command.split()
        if len(parts) < 3:
            return {"ok": False, "error": "usage: get|set|call <interface> <op> [args...]"}
        op, iface, opname = parts[0], parts[1], parts[2]
        cmd_args = parts[3:]
        if op == "get":
            if iface == "appSys" and opname in ("ver", "mat", "date", "ttpms"):
                return {"ok": True, "interface": iface, "op": opname, "value": getattr(api, opname)()}
            return {"ok": False, "error": f"unsupported get {iface} {opname}"}
        if op == "call" and iface == "appSys" and opname == "hwInit":
            api = CodieApi(base_url=api_url, address=address)
            robot = Robot(api)
            robot.stop()
            return {"ok": True, "interface": iface, "op": opname}
        return {"ok": False, "error": f"unsupported console command: {command}"}
    except CodieApiError as error:
        return {"ok": False, "error": str(error), "status": error.status}
    except Exception as error:  # noqa: BLE001
        return {"ok": False, "error": str(error)}


# --- CLI entry point ------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    """Entry point: list scripts or run one script."""
    parser = argparse.ArgumentParser(description="Codie robot-script runner")
    parser.add_argument("--list", action="store_true", help="list available scripts")
    parser.add_argument("--address", help="robot BLE address")
    parser.add_argument("--api", default="http://localhost:3000", help="backend API URL")
    parser.add_argument("--script", help="script name to run")
    parser.add_argument(
        "--script-dir",
        default=str(DEFAULT_SCRIPT_DIR),
        help="directory with robot scripts",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_S,
        help="per-run timeout in seconds",
    )
    parser.add_argument(
        "--firmware",
        action="store_true",
        help="print the firmware interface register",
    )
    args = parser.parse_args(argv)

    if args.list:
        scripts = list_scripts(Path(args.script_dir))
        print(json.dumps(scripts, ensure_ascii=False))
        return 0

    if args.firmware:
        print(json.dumps(firmware_surface(), ensure_ascii=False))
        return 0

    if not args.address or not args.script:
        parser.error("--address and --script are required (unless --list / --firmware)")

    runner = ScriptRunner(
        address=args.address,
        api_url=args.api,
        script_dir=Path(args.script_dir),
        timeout_s=args.timeout,
    )

    import threading
    import time

    deadline = [None]

    def run_it():
        try:
            code = runner.run(args.script)
        except Exception:  # noqa: BLE001
            code = 1
        deadline[0] = code

    thread = threading.Thread(target=run_it, daemon=True)
    thread.start()
    thread.join(args.timeout_s + 5)

    if thread.is_alive():
        runner.request_stop()
        thread.join(5)
        print(json.dumps({"event": "error", "text": "script timed out"}, ensure_ascii=False))
        return 1

    return deadline[0] or 0


if __name__ == "__main__":
    sys.exit(main())
