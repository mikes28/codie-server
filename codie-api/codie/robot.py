"""Robot — high-level API over CodieApi, transport-agnostic.

Used by robot-scripts via the Context proxy. Every method maps to one
backend command.
"""

from __future__ import annotations

from .api import CodieApi


class Robot:
    def __init__(self, api: CodieApi):
        self.api = api

    # --- sound -------------------------------------------------------

    def beep(self, ms: int = 500):
        return self.api.beep(ms)

    def morse(self, text: str):
        return self.api.morse(text)

    def tune(self, name: str):
        return self.api.tune(name)

    # --- LEDs --------------------------------------------------------

    def led(self, color: str, led_mask: int = 0x0FFF):
        return self.api.led(color, led_mask)

    def led_single(self, color: str, index: int):
        return self.api.led_single(color, index)

    def leds_off(self):
        return self.api.leds_off()

    # --- movement ----------------------------------------------------

    def forward(self, cm: float, speed: int = 40):
        return self.api.forward(cm, speed)

    def backward(self, cm: float, speed: int = 40):
        return self.api.backward(cm, speed)

    def turn(self, deg: float, speed: int = 40):
        return self.api.turn(deg, speed)

    def stop(self):
        return self.api.stop()

    # --- sensors -----------------------------------------------------

    def status(self):
        return self.api.status()

    def battery(self):
        return self.api.battery()

    def sonar(self):
        return self.api.sonar()

    def light(self):
        return self.api.light()

    def line(self):
        return self.api.line()

    def mic(self):
        return self.api.mic()
