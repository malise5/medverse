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
from app.models.identity import AuditLog, AuthSession, Institution, Permission, Role, User

__all__ = [
    "AnatomicalSystem",
    "AssetBundle",
    "AuditLog",
    "AuthSession",
    "Condition",
    "ConditionScenario",
    "ConditionStructure",
    "Institution",
    "Mesh",
    "MeshContact",
    "Permission",
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
