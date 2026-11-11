"""CodieApi — synchronous REST client for the Node.js backend.

Standard library only (urllib). The BLE layer lives in the backend; this
client is the gate through which Python code (scripts, MCP server) controls
the robot.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class CodieApiError(RuntimeError):
    """A 4xx/5xx or connection error from the backend, with the HTTP status."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class CodieApi:
    """Thin synchronous client over the backend's REST API.

    Endpoints used:
      POST /api/robots/:address/command  {"name", "params"}  -> command result
      GET  /api/robots/:address/telemetry -> last telemetry snapshot
      POST /api/robots/:address/connect
      POST /api/robots/:address/disconnect
    """

    def __init__(self, base_url: str = "http://127.0.0.1:3000", address: str = ""):
        self.base_url = base_url.rstrip("/")
        self.address = address

    # --- low-level request ------------------------------------------

    def _request(self, method: str, path: str, payload: dict | None = None) -> Any:
        url = self.base_url + path
        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                if not body:
                    return None
                return json.loads(body.decode("utf-8"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            msg = body or error.reason
            raise CodieApiError(msg, error.code) from error
        except urllib.error.URLError as error:
            raise CodieApiError(str(error), None) from error

    # --- connection --------------------------------------------------

    def connect(self) -> Any:
        return self._request("POST", f"/api/robots/{self.address}/connect")

    def disconnect(self) -> Any:
        return self._request("POST", f"/api/robots/{self.address}/disconnect")

    # --- commands -----------------------------------------------------

    def command(self, name: str, params: dict | None = None) -> Any:
        return self._request(
            "POST",
            f"/api/robots/{self.address}/command",
            {"name": name, "params": params or {}},
        )

    def telemetry(self) -> Any:
        return self._request("GET", f"/api/robots/{self.address}/telemetry")

    # --- high-level convenience methods ------------------------------

    def beep(self, ms: int = 500) -> Any:
        return self.command("beep", {"ms": ms})

    def led(self, color: str, led_mask: int = 0x0FFF) -> Any:
        return self.command("led", {"color": color, "ledMask": led_mask})

    def led_single(self, color: str, index: int) -> Any:
        return self.command("ledSingle", {"color": color, "index": index})

    def leds_off(self) -> Any:
        return self.command("ledsOff", {})

    def forward(self, cm: float, speed: int = 40) -> Any:
        return self.command("forward", {"cm": cm, "speed": speed})

    def backward(self, cm: float, speed: int = 40) -> Any:
        return self.command("backward", {"cm": cm, "speed": speed})

    def turn(self, deg: float, speed: int = 40) -> Any:
        return self.command("turn", {"deg": deg, "speed": speed})

    def stop(self) -> Any:
        return self.command("stop", {})

    def status(self) -> Any:
        return self.command("status", {})

    def battery(self) -> Any:
        return self.command("battery", {})

    def sonar(self) -> Any:
        return self.command("sonar", {})

    def light(self) -> Any:
        return self.command("light", {})

    def line(self) -> Any:
        return self.command("line", {})

    def mic(self) -> Any:
        return self.command("mic", {})

    # Aliases matching the reference README usage
    def morse(self, text: str) -> Any:
        return self.command("morse", {"text": text})

    def tune(self, name: str) -> Any:
        return self.command("tune", {"name": name})
