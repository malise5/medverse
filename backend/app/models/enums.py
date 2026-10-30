"""Controlled vocabularies shared by models, schemas and the seed loader.

Stored as VARCHAR + CHECK (native_enum=False) so values can be extended with an
ordinary migration instead of ALTER TYPE.
"""

from enum import StrEnum

from sqlalchemy import Enum


def db_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        length=48,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class VerificationStatus(StrEnum):
    """Content governance state. Only `expert_reviewed` content is considered validated."""

    SOURCE_IMPORTED = "source_imported"  # imported verbatim from a cited external dataset
    DRAFT = "draft"  # written in-house, not yet reviewed by a credentialed expert
    IN_REVIEW = "in_review"
    EXPERT_REVIEWED = "expert_reviewed"
    DEPRECATED = "deprecated"


class EvidenceClass(StrEnum):
    """Spec §18 classification of content and models."""

    A_ANATOMICALLY_VALIDATED = "A"
    B_EVIDENCE_SUPPORTED = "B"
    C_SIMPLIFIED_EDUCATIONAL = "C"
    D_EXPERIMENTAL = "D"


class AudienceLevel(StrEnum):
    BASIC = "basic"
    UNDERGRADUATE = "undergraduate"
    CLINICAL = "clinical"
    POSTGRADUATE = "postgraduate"
    SPECIALIST = "specialist"


class Laterality(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    UNPAIRED = "unpaired"
    UNSPECIFIED = "unspecified"


class ContentSection(StrEnum):
    OVERVIEW = "overview"
    GROSS_ANATOMY = "gross_anatomy"
    SURFACE_ANATOMY = "surface_anatomy"
    MICROSCOPIC_ANATOMY = "microscopic_anatomy"
    HISTOLOGY = "histology"
    PHYSIOLOGY = "physiology"
    BLOOD_SUPPLY = "blood_supply"
    VENOUS_DRAINAGE = "venous_drainage"
    INNERVATION = "innervation"
    LYMPHATIC_DRAINAGE = "lymphatic_drainage"
    RELATIONS = "relations"
    EMBRYOLOGY = "embryology"
    VARIATIONS = "variations"
    CLINICAL_ANATOMY = "clinical_anatomy"
    PATHOLOGY = "pathology"
    INJURIES = "injuries"
    INVESTIGATIONS = "investigations"
    MANAGEMENT_PRINCIPLES = "management_principles"
    CLINICAL_CORRELATIONS = "clinical_correlations"


class RelationClass(StrEnum):
    STRUCTURAL = "structural"  # direct anatomical relationship
    FUNCTIONAL = "functional"  # functional association, not a physical connection


class Predicate(StrEnum):
    PART_OF = "part_of"
    BRANCH_OF = "branch_of"
    ARISES_FROM = "arises_from"
    CONTINUOUS_WITH = "continuous_with"
    DRAINS_INTO = "drains_into"
    SUPPLIED_BY = "supplied_by"
    DRAINED_BY = "drained_by"
    INNERVATED_BY = "innervated_by"
    ADJACENT_TO = "adjacent_to"
    PASSES_THROUGH = "passes_through"
    ARTICULATES_WITH = "articulates_with"
    ATTACHES_TO = "attaches_to"
    CONNECTED_TO = "connected_to"
    FUNCTIONALLY_ASSOCIATED_WITH = "functionally_associated_with"

    @property
    def relation_class(self) -> RelationClass:
        if self is Predicate.FUNCTIONALLY_ASSOCIATED_WITH:
            return RelationClass.FUNCTIONAL
        return RelationClass.STRUCTURAL

    @property
    def symmetric(self) -> bool:
        return self in {
            Predicate.ADJACENT_TO,
            Predicate.ARTICULATES_WITH,
            Predicate.CONNECTED_TO,
            Predicate.CONTINUOUS_WITH,
            Predicate.FUNCTIONALLY_ASSOCIATED_WITH,
        }


# Human-readable label for the inverse direction, used when a structure is the object.
INVERSE_LABELS: dict[Predicate, str] = {
    Predicate.PART_OF: "has part",
    Predicate.BRANCH_OF: "has branch",
    Predicate.ARISES_FROM: "gives rise to",
    Predicate.CONTINUOUS_WITH: "continuous with",
    Predicate.DRAINS_INTO: "receives drainage from",
    Predicate.SUPPLIED_BY: "supplies",
    Predicate.DRAINED_BY: "drains",
    Predicate.INNERVATED_BY: "innervates",
    Predicate.ADJACENT_TO: "adjacent to",
    Predicate.PASSES_THROUGH: "transmits",
    Predicate.ARTICULATES_WITH: "articulates with",
    Predicate.ATTACHES_TO: "receives attachment of",
    Predicate.CONNECTED_TO: "connected to",
    Predicate.FUNCTIONALLY_ASSOCIATED_WITH: "functionally associated with",
}
