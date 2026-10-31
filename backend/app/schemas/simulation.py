import uuid
from dataclasses import asdict
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import EvidenceClass
from app.simulation.core import ModelDefinition


class ParameterSpecOut(BaseModel):
    id: str
    label: str
    unit: str
    default: float
    min: float
    max: float
    description: str
    step: float | None


class OutputSpecOut(BaseModel):
    id: str
    label: str
    unit: str
    description: str


class AnimationBindingOut(BaseModel):
    output: str
    structure_ids: list[str]
    effect: Literal["scale", "tint", "glow"]
    amplitude: float
    description: str
    color: str | None
    normalise: Literal["range", "magnitude"]


class ReferenceLineOut(BaseModel):
    label: str
    slope_parameter: str
    x_intercept_parameter: str
    description: str


class PhasePlotOut(BaseModel):
    id: str
    title: str
    x: str
    y: str
    description: str
    lines: list[ReferenceLineOut]
    x_min: float | None
    y_min: float | None


class ModelDefinitionOut(BaseModel):
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
    parameters: list[ParameterSpecOut]
    series: list[OutputSpecOut]
    metrics: list[OutputSpecOut]
    linked_structure_ids: list[str]
    visual_mappings: dict[str, list[str]]
    animations: list[AnimationBindingOut]
    time_unit: Literal["s", "ms"]
    playback_rate: float
    phase_plots: list[PhasePlotOut]
    disclaimer: str

    @classmethod
    def from_definition(cls, d: ModelDefinition) -> "ModelDefinitionOut":
        return cls.model_validate(asdict(d))


class RunRequest(BaseModel):
    parameters: dict[str, float] = Field(default_factory=dict, max_length=64)
    scenario_id: str | None = Field(default=None, max_length=64)


class RunResult(BaseModel):
    run_id: uuid.UUID | None
    model_id: str
    model_version: str
    scenario_id: str | None
    parameters: dict[str, float]
    time: list[float]
    series: dict[str, list[float]]
    metrics: dict[str, float]
    warnings: list[str]
    disclaimer: str
