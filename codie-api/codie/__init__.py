"""Codie Python package — high-level robot API and sync REST client.

Talks to the Node.js backend's REST API (the BLE layer lives in the backend).
"""

from .api import CodieApi, CodieApiError
from .robot import Robot

__all__ = ["CodieApi", "CodieApiError", "Robot"]
