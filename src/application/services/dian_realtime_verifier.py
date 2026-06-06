"""Minimal stub for DIAN realtime verifier used in imports during local tests.

This file provides a lightweight `DianRealtimeVerifier` class with a
`verify` coroutine to avoid ModuleNotFoundError while running local checks.
Replace with the real implementation when available.
"""
from typing import Any


class DianRealtimeVerifier:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def verify(self, *args: Any, **kwargs: Any) -> dict:
        """Return a benign verification result for local testing."""
        return {"status": "stub", "verified": False}


__all__ = ["DianRealtimeVerifier"]
