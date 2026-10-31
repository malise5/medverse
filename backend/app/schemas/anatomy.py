from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    AudienceLevel,
    ContentSection,
    EvidenceClass,
    Laterality,
    Predicate,
    RelationClass,
    VerificationStatus,
)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SystemOut(ORM):
    id: str
    name: str
    fma_id: str | None
    description: str | None
    display_order: int
    dissection_depth: int
    structure_count: int = 0
    mesh_count: int = 0


class StructureSummary(ORM):
    id: str
    name: str
    system_id: str | None
    laterality: Laterality
    is_compound: bool
    has_geometry: bool = False


class StructureIndex(BaseModel):
    """Compact columnar index of all structures for client-side labelling and trees."""

    ids: list[str]
    names: list[str]
    systems: list[str | None]
    # index into `ids` of each structure's first part_of parent, or -1
    parents: list[int]


class SearchHit(StructureSummary):
    score: float
    matched_text: str


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class ReferenceOut(ORM):
    id: str
    citation: str
    kind: str
    year: int | None
    doi: str | None
    pmid: str | None
    url: str | None


class SynonymOut(ORM):
    synonym: str
    kind: str
    source: str


class XrefOut(ORM):
    source: str
    code: str
    license: str | None


class ContentOut(ORM):
    section: ContentSection
    audience: AudienceLevel
    body: str
    evidence_class: EvidenceClass
    verification_status: VerificationStatus
    version: int
    author: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    reference_ids: list[str]


class RelationOut(BaseModel):
    predicate: Predicate
    label: str
    direction: str  # "outgoing" (this structure is the subject) | "incoming"
    relation_class: RelationClass
    target: StructureSummary
    source: str
    verification_status: VerificationStatus
    notes: str | None


class ConditionLink(BaseModel):
    id: str
    name: str
    category: str
    role: str


class SimulationLink(BaseModel):
    model_id: str
    name: str


class StructureDetail(StructureSummary):
    latin_name: str | None
    region: str | None
    identity_source: str
    verification_status: VerificationStatus
    system_name: str | None
    synonyms: list[SynonymOut]
    xrefs: list[XrefOut]
    parents: list[StructureSummary]
    children: list[StructureSummary]
    mesh_ids: list[str]
    content: list[ContentOut]
    relations: list[RelationOut]
    conditions: list[ConditionLink]
    simulations: list[SimulationLink]
    references: list[ReferenceOut]


class BundleOut(ORM):
    id: str
    uri: str
    system_id: str | None
    source_dataset: str
    license: str
    attribution: str
    version: str
    sha256: str
    byte_size: int
    mesh_count: int
    is_placeholder: bool
    body_model: str


class BodyModelSystem(BaseModel):
    system_id: str
    mesh_count: int


class BodyModelOut(BaseModel):
    """A complete 3D body (male or female) and what its source covers."""

    id: str
    label: str
    description: str
    sources: list[str]
    license: str
    mesh_count: int
    systems: list[BodyModelSystem]


class AssetManifest(BaseModel):
    body_model: str
    bundles: list[BundleOut]
    # mesh id -> [bundle id, structure id]; compact because it covers every mesh.
    meshes: dict[str, tuple[str, str]]


class StructureRef(BaseModel):
    id: str
    name: str


class CirculationOut(BaseModel):
    """Inferred vessel routes for a structure; mesh -> hops from the heart along the route."""

    structure_id: str
    mode: Literal["whole_circulation", "organ_route", "none"]
    organ_mesh_ids: list[str] = []
    arteries: dict[str, int] = {}
    veins: dict[str, int] = {}
    contact_arteries: list[StructureRef] = []
    contact_veins: list[StructureRef] = []
    unrouted_vessels: int = 0
    method: str
