from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import DbSession, require
from app.core.errors import not_found
from app.core.rbac import Perm
from app.i18n import overlay, request_locale
from app.models import Condition, Reference, Structure
from app.models.enums import EvidenceClass, VerificationStatus
from app.schemas.anatomy import ReferenceOut
from app.services import i18n_service

router = APIRouter(
    prefix="/pathology", tags=["pathology"], dependencies=[Depends(require(Perm.PATHOLOGY_READ))]
)
Lang = Annotated[str, Depends(request_locale)]


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
def list_conditions(db: DbSession, locale: Lang, response: Response, category: str | None = None):
    response.headers["Vary"] = "Accept-Language"
    stmt = select(Condition).order_by(Condition.category, Condition.name)
    if category:
        stmt = stmt.where(Condition.category == category)
    rows = list(db.scalars(stmt))
    tr = i18n_service.translations(db, "condition", [c.id for c in rows], locale)
    out = []
    for c in rows:
        s = ConditionSummary.model_validate(c)
        text = overlay({"name": s.name, "summary": s.summary}, tr.get(c.id))
        out.append(s.model_copy(update=text))
    return out


@router.get("/conditions/{condition_id}", response_model=ConditionDetail)
def get_condition(condition_id: str, db: DbSession, locale: Lang, response: Response):
    response.headers["Vary"] = "Accept-Language"
    c = db.get(Condition, condition_id)
    if c is None:
        raise not_found("Condition", condition_id)
    text = overlay(
        i18n_service.condition_text(c),
        i18n_service.translations(db, "condition", [c.id], locale).get(c.id),
    )
    ids = [a.structure_id for a in c.affected_structures]
    structure_tr = i18n_service.translations(db, "structure", ids, locale)
    names = dict(
        db.execute(
            select(Structure.id, Structure.name).where(
                Structure.id.in_([a.structure_id for a in c.affected_structures])
            )
        ).all()
    )
    refs = list(db.scalars(select(Reference).where(Reference.id.in_(c.reference_ids))))
    for sid, payload in structure_tr.items():
        names[sid] = overlay({"name": names[sid]}, payload)["name"]
    return ConditionDetail(
        **{
            **ConditionSummary.model_validate(c).model_dump(),
            "name": text["name"],
            "summary": text["summary"],
        },
        mechanism=text["mechanism"],
        anatomical_changes=text["anatomical_changes"],
        physiological_consequences=text["physiological_consequences"],
        clinical_manifestations=text["clinical_manifestations"] or None,
        complications=text["complications"] or None,
        investigations=text["investigations"] or None,
        management_principles=text["management_principles"] or None,
        affected_structures=[
            AffectedStructureOut(
                structure_id=a.structure_id, name=names[a.structure_id], role=a.role
            )
            for a in c.affected_structures
        ],
        scenarios=[
            ScenarioOut.model_validate(s).model_copy(update=text["scenarios"][s.id])
            for s in c.scenarios
        ],
        references=[ReferenceOut.model_validate(r) for r in refs],
    )
