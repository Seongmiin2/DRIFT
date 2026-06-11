"""
Engine interface — the ONLY coupling point between backend and computation modules.

backend never imports from engine/, risk/, report/ directly.
It calls functions returned by the factory functions below.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Protocol

if TYPE_CHECKING:
    from datetime import datetime

    from contracts.models import (
        BriefingResult,
        EnginePredictionResult,
        PredictionRequest,
        RiskForecastResult,
        VesselType,
    )


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------

class DriftEngineProtocol(Protocol):
    def predict(self, request: "PredictionRequest") -> "EnginePredictionResult": ...


BriefingGeneratorProtocol = Callable[["EnginePredictionResult"], "BriefingResult"]

RiskGeneratorProtocol = Callable[..., "RiskForecastResult"]


# ---------------------------------------------------------------------------
# Factory functions — swap MockEngine ↔ RealEngine via DRIFT_ENGINE env var
# ---------------------------------------------------------------------------

def get_engine() -> DriftEngineProtocol:
    from django.conf import settings

    if getattr(settings, "DRIFT_ENGINE", "mock") == "mock":
        from .mock_engine import MockEngine
        return MockEngine()

    try:
        from drift_engine import RealDriftEngine  # type: ignore[import]
        return RealDriftEngine()
    except ImportError:
        import warnings
        warnings.warn("drift_engine package not found — falling back to MockEngine", stacklevel=2)
        from .mock_engine import MockEngine
        return MockEngine()


def get_briefing_engine() -> BriefingGeneratorProtocol:
    try:
        from drift_report import generate_briefing  # type: ignore[import]
        return generate_briefing
    except ImportError:
        from .mock_briefing import MockBriefingEngine
        return MockBriefingEngine().generate


def get_risk_engine() -> RiskGeneratorProtocol:
    try:
        from drift_risk import forecast_risk  # type: ignore[import]
        return forecast_risk
    except ImportError:
        from .mock_risk import MockRiskEngine
        return MockRiskEngine().forecast
