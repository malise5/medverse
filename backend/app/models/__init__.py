"""Importing this package registers every model on Base.metadata (used by Alembic)."""

from app.models.anatomy import (
    AnatomicalSystem,
    AssetBundle,
    Mesh,
    MeshContact,
    Reference,
    Structure,
    StructureContent,
    StructureMesh,
    StructureRelationship,
    StructureSynonym,
    StructureXref,
)
from app.models.clinical import Condition, ConditionScenario, ConditionStructure, SimulationRun
from app.models.i18n import ContentTranslation
from app.models.identity import AuditLog, AuthSession, Institution, Permission, Role, User
from app.models.learning import LearningModule, QuizAttempt, QuizQuestion

__all__ = [
    "ContentTranslation",
    "AnatomicalSystem",
    "AssetBundle",
    "AuditLog",
    "AuthSession",
    "Condition",
    "ConditionScenario",
    "ConditionStructure",
    "Institution",
    "LearningModule",
    "Mesh",
    "MeshContact",
    "Permission",
    "QuizAttempt",
    "QuizQuestion",
    "Reference",
    "Role",
    "SimulationRun",
    "Structure",
    "StructureContent",
    "StructureMesh",
    "StructureRelationship",
    "StructureSynonym",
    "StructureXref",
    "User",
]
