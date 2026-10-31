"""Core abstractions of the physiological simulation engine.

A model is a pure computation (parameters -> time series + metrics). It knows nothing
about HTTP, the database or rendering. Visualisation layers consume the declared
`visual_mappings` to bind outputs to anatomical structure IDs.
"""

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

from app.models.enums import EvidenceClass


class SimulationInputError(ValueError):
    def __init__(self, errors: list[dict]) -> None:
        super().__init__("; ".join(e["msg"] for e in errors))
        self.errors = errors


@dataclass(frozen=True)
class ParameterSpec:
    id: str
    label: str
    unit: str
    default: float
    min: float
    max: float
    description: str
    step: float | None = None


@dataclass(frozen=True)
class OutputSpec:
    id: str
    label: str
    unit: str
    description: str


@dataclass(frozen=True)
class AnimationBinding:
    """Declares how one output series drives the 3D view of some structures.

    The renderer normalises the series over the returned window to n in 0..1, either by
    its range ("range": min→0, max→1) or by size regardless of sign ("magnitude":
    |v| / max|v|, for signed quantities such as airflow), then applies the effect.
    Bindings are presentation only: they never feed back into the model, and
    `description` must state what the motion does and does not represent.
    """

    output: str
    structure_ids: list[str]
    effect: Literal["scale", "tint", "glow"]
    # scale: size varies by ±amplitude around the rest size; tint/glow: blend strength
    amplitude: float
    description: str
    color: str | None = None
    normalise: Literal["range", "magnitude"] = "range"


@dataclass(frozen=True)
class ModelDefinition:
    id: str
    version: str
    name: str
    domain: str
    summary: str
    purpose: str
    equations: list[str]
    solver: str
    initial_conditions: str
    assumptions: list[str]
    limitations: list[str]
    validation: list[str]
    evidence_class: EvidenceClass
    reference_ids: list[str]
    parameters: list[ParameterSpec]
    series: list[OutputSpec]
    metrics: list[OutputSpec]
    linked_structure_ids: list[str] = field(default_factory=list)
    # output id -> structure IDs whose visual state can be driven by that output
    visual_mappings: dict[str, list[str]] = field(default_factory=dict)
    # 3D "function" playback: bindings, time unit of `time`, and model time per real second
    animations: list[AnimationBinding] = field(default_factory=list)
    time_unit: Literal["s", "ms"] = "s"
    playback_rate: float = 1.0
    disclaimer: str = (
        "Simplified educational model. It is not validated for, and must not be used for, "
        "clinical decision-making or prediction of individual patient outcomes."
    )


@dataclass
class SimulationResult:
    time: list[float]
    series: dict[str, list[float]]
    metrics: dict[str, float]
    warnings: list[str] = field(default_factory=list)


class SimulationModel(ABC):
    definition: ModelDefinition

    def resolve_parameters(self, overrides: dict[str, float] | None) -> dict[str, float]:
        """Merge overrides onto defaults and validate names, finiteness and bounds."""
        specs = {p.id: p for p in self.definition.parameters}
        overrides = overrides or {}
        errors: list[dict] = []
        for key in overrides:
            if key not in specs:
                errors.append({"loc": ["parameters", key], "msg": f"Unknown parameter '{key}'"})
        values = {pid: spec.default for pid, spec in specs.items()}
        for key, raw in overrides.items():
            if key not in specs:
                continue
            spec = specs[key]
            try:
                value = float(raw)
            except (TypeError, ValueError):
                errors.append({"loc": ["parameters", key], "msg": "Must be a number"})
                continue
            if not math.isfinite(value) or not spec.min <= value <= spec.max:
                errors.append(
                    {
                        "loc": ["parameters", key],
                        "msg": (
                            f"{spec.label} must be between {spec.min} and {spec.max} {spec.unit}"
                        ),
                    }
                )
                continue
            values[key] = value
        errors.extend(self.cross_validate(values))
        if errors:
            raise SimulationInputError(errors)
        return values

    def cross_validate(self, values: dict[str, float]) -> list[dict]:
        """Constraints spanning several parameters. Override in subclasses."""
        return []

    @abstractmethod
    def simulate(self, params: dict[str, float]) -> SimulationResult: ...

    def run(self, overrides: dict[str, float] | None = None) -> SimulationResult:
        return self.simulate(self.resolve_parameters(overrides))
