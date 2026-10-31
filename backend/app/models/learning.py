"""Learning layer: body-system modules, quiz questions and learners' attempts.

Modules and questions are version-controlled content (``content/learning``) loaded by the
seed loader; attempts are user data. A module's id is the id of the anatomical system it
teaches, so the 3D workspace and the learning hub share one vocabulary.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import AudienceLevel, EvidenceClass, VerificationStatus, db_enum


class LearningModule(TimestampMixin, Base):
    __tablename__ = "learning_modules"

    id: Mapped[str] = mapped_column(
        ForeignKey("anatomical_systems.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(String(128))
    tagline: Mapped[str] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, default=100)
    # Validated against app.schemas.learning.ModuleBody by the seed loader.
    body: Mapped[dict] = mapped_column(JSON)
    reference_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    evidence_class: Mapped[EvidenceClass] = mapped_column(
        db_enum(EvidenceClass, "evidence_class"), default=EvidenceClass.B_EVIDENCE_SUPPORTED
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status"), default=VerificationStatus.DRAFT
    )
    author: Mapped[str | None] = mapped_column(String(128))
    version: Mapped[int] = mapped_column(Integer, default=1)


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    module_id: Mapped[str] = mapped_column(
        ForeignKey("learning_modules.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16))  # mcq | identify
    level: Mapped[AudienceLevel] = mapped_column(db_enum(AudienceLevel, "audience_level"))
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str] | None] = mapped_column(JSON)
    # mcq: index of the correct option; identify: structure IDs that count as correct
    # (a selected structure is also correct when it is part of one of them).
    answer: Mapped[int | list[str]] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    reference_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status"), default=VerificationStatus.DRAFT
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"))
    response: Mapped[str] = mapped_column(String(64))
    correct: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_func.now()
    )

    __table_args__ = (Index("ix_quiz_attempts_user_question", "user_id", "question_id"),)
