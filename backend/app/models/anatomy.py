"""Anatomical knowledge graph.

Structures are nodes with permanent CURIE identifiers (e.g. ``FMA:7088``); typed
relationships are edges. Rendering assets reference structures by the same ID but
live in their own tables, so knowledge and geometry evolve independently.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    AudienceLevel,
    ContentSection,
    EvidenceClass,
    Laterality,
    Predicate,
    RelationClass,
    VerificationStatus,
    db_enum,
)


class Reference(Base):
    """A citable source. Never create a reference that cannot be traced to a real publication."""

    __tablename__ = "references"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    citation: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(32))  # journal_article | book | dataset | standard
    year: Mapped[int | None] = mapped_column(Integer)
    doi: Mapped[str | None] = mapped_column(String(255))
    pmid: Mapped[str | None] = mapped_column(String(32))
    url: Mapped[str | None] = mapped_column(String(1024))
    license_note: Mapped[str | None] = mapped_column(Text)


class AnatomicalSystem(Base):
    __tablename__ = "anatomical_systems"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    fma_id: Mapped[str | None] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, default=100)
    # Default depth for progressive dissection (0 = outermost, e.g. skin).
    dissection_depth: Mapped[int] = mapped_column(Integer, default=50)


class Structure(TimestampMixin, Base):
    __tablename__ = "structures"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    latin_name: Mapped[str | None] = mapped_column(String(255))
    system_id: Mapped[str | None] = mapped_column(
        ForeignKey("anatomical_systems.id", ondelete="SET NULL"), index=True
    )
    region: Mapped[str | None] = mapped_column(String(128))
    laterality: Mapped[Laterality] = mapped_column(
        db_enum(Laterality, "laterality"), default=Laterality.UNSPECIFIED
    )
    # True when the structure is a compound of other meshed parts (BodyParts3D COMPOUND).
    is_compound: Mapped[bool] = mapped_column(default=False)
    identity_source: Mapped[str] = mapped_column(String(64))  # e.g. "bodyparts3d-4.0", "curated"
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status"), default=VerificationStatus.DRAFT
    )

    system: Mapped[AnatomicalSystem | None] = relationship(lazy="joined")
    synonyms: Mapped[list["StructureSynonym"]] = relationship(
        back_populates="structure", cascade="all, delete-orphan"
    )
    xrefs: Mapped[list["StructureXref"]] = relationship(
        back_populates="structure", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "ix_structures_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )


class StructureSynonym(Base):
    __tablename__ = "structure_synonyms"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), index=True
    )
    synonym: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(32), default="exact")  # exact|related|latin|abbrev
    source: Mapped[str] = mapped_column(String(64))

    structure: Mapped[Structure] = relationship(back_populates="synonyms")

    __table_args__ = (
        UniqueConstraint("structure_id", "synonym", name="uq_structure_synonyms_pair"),
        Index(
            "ix_structure_synonyms_trgm",
            "synonym",
            postgresql_using="gin",
            postgresql_ops={"synonym": "gin_trgm_ops"},
        ),
    )


class StructureXref(Base):
    """Cross-reference to an external terminology. `license` records redistribution terms."""

    __tablename__ = "structure_xrefs"

    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), primary_key=True
    )
    source: Mapped[str] = mapped_column(String(32), primary_key=True)  # FMA | TA2 | UBERON | ...
    code: Mapped[str] = mapped_column(String(64))
    license: Mapped[str | None] = mapped_column(String(128))

    structure: Mapped[Structure] = relationship(back_populates="xrefs")


class StructureRelationship(Base):
    __tablename__ = "structure_relationships"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    subject_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), index=True
    )
    predicate: Mapped[Predicate] = mapped_column(db_enum(Predicate, "predicate"))
    object_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), index=True
    )
    relation_class: Mapped[RelationClass] = mapped_column(db_enum(RelationClass, "relation_class"))
    source: Mapped[str] = mapped_column(String(64))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    reference_id: Mapped[str | None] = mapped_column(ForeignKey("references.id"))

    subject: Mapped[Structure] = relationship(foreign_keys=[subject_id])
    object: Mapped[Structure] = relationship(foreign_keys=[object_id])

    __table_args__ = (
        UniqueConstraint("subject_id", "predicate", "object_id", name="uq_structure_rel_triple"),
    )


class StructureContent(TimestampMixin, Base):
    """One section of educational content for one audience level, with provenance."""

    __tablename__ = "structure_content"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), index=True
    )
    section: Mapped[ContentSection] = mapped_column(db_enum(ContentSection, "content_section"))
    audience: Mapped[AudienceLevel] = mapped_column(
        db_enum(AudienceLevel, "audience_level"), default=AudienceLevel.UNDERGRADUATE
    )
    body: Mapped[str] = mapped_column(Text)
    evidence_class: Mapped[EvidenceClass] = mapped_column(
        db_enum(EvidenceClass, "evidence_class"), default=EvidenceClass.B_EVIDENCE_SUPPORTED
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        db_enum(VerificationStatus, "verification_status"), default=VerificationStatus.DRAFT
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    author: Mapped[str | None] = mapped_column(String(128))
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reference_ids: Mapped[list[str]] = mapped_column(JSON, default=list)

    __table_args__ = (
        UniqueConstraint("structure_id", "section", "audience", name="uq_structure_content_slot"),
    )


class AssetBundle(Base):
    """A deployable 3D file (GLB) containing many independently addressable meshes."""

    __tablename__ = "asset_bundles"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    uri: Mapped[str] = mapped_column(String(1024))
    system_id: Mapped[str | None] = mapped_column(ForeignKey("anatomical_systems.id"))
    source_dataset: Mapped[str] = mapped_column(String(128))
    license: Mapped[str] = mapped_column(String(128))
    attribution: Mapped[str] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String(32))
    sha256: Mapped[str] = mapped_column(String(64))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    mesh_count: Mapped[int] = mapped_column(Integer)
    is_placeholder: Mapped[bool] = mapped_column(default=False)


class Mesh(Base):
    """One selectable mesh. `id` is the source element file ID (e.g. BodyParts3D FJ1234)."""

    __tablename__ = "meshes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    bundle_id: Mapped[str] = mapped_column(
        ForeignKey("asset_bundles.id", ondelete="CASCADE"), index=True
    )
    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), index=True
    )
    triangle_count: Mapped[int] = mapped_column(Integer)


class StructureMesh(Base):
    """Which meshes render a structure (one for atomic parts, many for compounds)."""

    __tablename__ = "structure_meshes"

    structure_id: Mapped[str] = mapped_column(
        ForeignKey("structures.id", ondelete="CASCADE"), primary_key=True
    )
    mesh_id: Mapped[str] = mapped_column(
        ForeignKey("meshes.id", ondelete="CASCADE"), primary_key=True, index=True
    )
