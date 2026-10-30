"""Pathology/injury knowledge and simulation run records."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow
from app.models.enums import EvidenceClass, VerificationStatus, db_enum


class Condition(TimestampMixin, Base):
    """A disease, injury or pathological process.

    Narrative fields hold educational text; every row carries governance metadata and
    references. Simulation behaviour lives in ConditionScenario, never in UI code.
    """

    __tablename__ = "conditions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64))  # cardiovascular | trauma | respiratory ...
    summary: Mapped[str] = mapped_column(Text)
    mechanism: Mapped[str] = mapped_column(Text)
    anatomical_changes: Mapped[str] = mapped_column(Text)
    physiological_consequences: Mapped[str] = mapped_column(Text)
    clinical_manifestations: Mapped[str | None] = mapped_column(Text)
    complications: Mapped[str | None] = mapped_column(Text)
    investigations: Mapped[str | None] = mapped_column(Text)
    management_principles: Mapped[str | None] = mapped_column(Text)
    evidence_class: Mapped[EvidenceClass] = mapped_column(db_enum(EvidenceClass, "evidence_class"))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status")
    )
    reference_ids: Mapped[list[str]] = mapped_column(JSON, default=list)

    affected_structures: Mapped[list["ConditionStructure"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    scenarios: Mapped[list["ConditionScenario"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class ConditionStructure(Base):
    __tablename__ = "condition_structures"

    condition_id: Mapped[str] = mapped_column(
        ForeignKey("conditions.id", ondelete="CASCADE"), primary_key=True
    )
    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str] = mapped_column(String(32), default="primary")  # primary | secondary


class ConditionScenario(Base):
    """Maps a condition onto a simulation model via parameter overrides."""

    __tablename__ = "condition_scenarios"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    condition_id: Mapped[str] = mapped_column(ForeignKey("conditions.id", ondelete="CASCADE"))
    model_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    parameter_overrides: Mapped[dict] = mapped_column(JSON)
    assumptions: Mapped[list[str]] = mapped_column(JSON, default=list)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    model_id: Mapped[str] = mapped_column(String(64), index=True)
    model_version: Mapped[str] = mapped_column(String(32))
    scenario_id: Mapped[str | None] = mapped_column(String(64))
    parameters: Mapped[dict] = mapped_column(JSON)
    summary: Mapped[dict] = mapped_column(JSON)
    duration_ms: Mapped[int] = mapped_column(BigInteger)
