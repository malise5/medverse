from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import DbSession, require
from app.core.errors import not_found
from app.core.rbac import Perm
from app.models import Condition, Reference, Structure
from app.models.enums import EvidenceClass, VerificationStatus
from app.schemas.anatomy import ReferenceOut

router = APIRouter(
    prefix="/pathology", tags=["pathology"], dependencies=[Depends(require(Perm.PATHOLOGY_READ))]
)


class AffectedStructureOut(BaseModel):
    structure_id: str
    name: str
    role: str


class ScenarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_id: str
    title: str
    description: str
    parameter_overrides: dict[str, float]
    assumptions: list[str]


class ConditionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    summary: str
    evidence_class: EvidenceClass
    verification_status: VerificationStatus


class ConditionDetail(ConditionSummary):
    mechanism: str
    anatomical_changes: str
    physiological_consequences: str
    clinical_manifestations: str | None
    complications: str | None
    investigations: str | None
    management_principles: str | None
    affected_structures: list[AffectedStructureOut]
    scenarios: list[ScenarioOut]
    references: list[ReferenceOut]


@router.get("/conditions", response_model=list[ConditionSummary])
def list_conditions(db: DbSession, category: str | None = None):
    stmt = select(Condition).order_by(Condition.category, Condition.name)
    if category:
        stmt = stmt.where(Condition.category == category)
    return list(db.scalars(stmt))


@router.get("/conditions/{condition_id}", response_model=ConditionDetail)
def get_condition(condition_id: str, db: DbSession):
    c = db.get(Condition, condition_id)
    if c is None:
        raise not_found("Condition", condition_id)
    names = dict(
        db.execute(
            select(Structure.id, Structure.name).where(
                Structure.id.in_([a.structure_id for a in c.affected_structures])
            )
        ).all()
    )
    refs = list(db.scalars(select(Reference).where(Reference.id.in_(c.reference_ids))))
    return ConditionDetail(
        **ConditionSummary.model_validate(c).model_dump(),
        mechanism=c.mechanism,
        anatomical_changes=c.anatomical_changes,
        physiological_consequences=c.physiological_consequences,
        clinical_manifestations=c.clinical_manifestations,
        complications=c.complications,
        investigations=c.investigations,
        management_principles=c.management_principles,
        affected_structures=[
            AffectedStructureOut(
                structure_id=a.structure_id, name=names[a.structure_id], role=a.role
            )
            for a in c.affected_structures
        ],
        scenarios=[ScenarioOut.model_validate(s) for s in c.scenarios],
        references=[ReferenceOut.model_validate(r) for r in refs],
    )
