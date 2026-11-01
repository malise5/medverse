"""Body-system learning modules, quizzes and per-learner progress."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError, not_found
from app.models import LearningModule, QuizAttempt, QuizQuestion, Reference, Structure
from app.schemas.anatomy import ReferenceOut
from app.schemas.learning import (
    AnswerOut,
    GlossaryEntry,
    ModuleBody,
    ModuleDetail,
    ModuleSummary,
    OrganOut,
    Progress,
    QuestionOut,
)
from app.services import anatomy_service


def _latest_results(db: Session, user_id: uuid.UUID) -> dict[str, bool]:
    """question id -> whether the learner's most recent attempt was correct."""
    latest = (
        select(QuizAttempt.question_id, func.max(QuizAttempt.id).label("last"))
        .where(QuizAttempt.user_id == user_id)
        .group_by(QuizAttempt.question_id)
        .subquery()
    )
    rows = db.execute(
        select(QuizAttempt.question_id, QuizAttempt.correct).join(
            latest, QuizAttempt.id == latest.c.last
        )
    )
    return dict(rows.all())


def _progress(question_ids: list[str], results: dict[str, bool]) -> Progress:
    answered = [q for q in question_ids if q in results]
    return Progress(
        questions=len(question_ids),
        answered=len(answered),
        correct=sum(results[q] for q in answered),
    )


def _references(db: Session, ids: list[str]) -> list[ReferenceOut]:
    refs = {r.id: r for r in db.scalars(select(Reference).where(Reference.id.in_(ids)))}
    return [ReferenceOut.model_validate(refs[rid]) for rid in ids if rid in refs]


def list_modules(db: Session, user_id: uuid.UUID) -> list[ModuleSummary]:
    systems = {s.id: s for s in anatomy_service.list_systems(db)}
    results = _latest_results(db, user_id)
    by_module: dict[str, list[str]] = {}
    for qid, mid in db.execute(select(QuizQuestion.id, QuizQuestion.module_id)):
        by_module.setdefault(mid, []).append(qid)
    out = []
    for m in db.scalars(select(LearningModule).order_by(LearningModule.display_order)):
        s = systems.get(m.id)
        out.append(
            ModuleSummary(
                id=m.id,
                title=m.title,
                tagline=m.tagline,
                latin_name=m.body.get("latin_name"),
                display_order=m.display_order,
                structure_count=s.structure_count if s else 0,
                mesh_count=s.mesh_count if s else 0,
                progress=_progress(by_module.get(m.id, []), results),
            )
        )
    return out


def get_module(db: Session, module_id: str, user_id: uuid.UUID) -> ModuleDetail:
    m = db.get(LearningModule, module_id)
    if m is None:
        raise not_found("Learning module", module_id)
    body = ModuleBody.model_validate(m.body)
    organ_ids = [o.structure_id for o in body.organs if o.structure_id]
    names = dict(
        db.execute(select(Structure.id, Structure.name).where(Structure.id.in_(organ_ids))).all()
    )
    questions = list(
        db.scalars(
            select(QuizQuestion)
            .where(QuizQuestion.module_id == module_id)
            .order_by(QuizQuestion.display_order)
        )
    )
    results = _latest_results(db, user_id)
    targets = {sid for q in questions if q.kind == "identify" for sid in q.answer}  # type: ignore[union-attr]
    bodies = anatomy_service.body_models_of(db, sorted(set(organ_ids) | targets))

    def question_bodies(q: QuizQuestion) -> list[str]:
        if q.kind != "identify":
            return []
        found = {b for sid in q.answer for b in bodies.get(sid, [])}  # type: ignore[union-attr]
        return [b for b in ("male", "female") if b in found]

    return ModuleDetail(
        id=m.id,
        title=m.title,
        tagline=m.tagline,
        latin_name=body.latin_name,
        objectives=body.objectives,
        overview=body.overview,
        functions=body.functions,
        organs=[
            OrganOut(
                **o.model_dump(),
                in_3d=bool(o.structure_id and bodies.get(o.structure_id)),
                structure_name=names.get(o.structure_id) if o.structure_id else None,
                body_models=bodies.get(o.structure_id, []) if o.structure_id else [],
            )
            for o in body.organs
        ],
        works_with=body.works_with,
        key_terms=body.key_terms,
        facts=body.facts,
        clinical_notes=body.clinical_notes,
        asset_note=body.asset_note,
        questions=[
            QuestionOut(
                id=q.id,
                kind=q.kind,
                level=q.level,
                stem=q.stem,
                options=q.options,
                last_correct=results.get(q.id),
                body_models=question_bodies(q),
            )
            for q in questions
        ],
        references=_references(db, m.reference_ids),
        verification_status=m.verification_status,
        progress=_progress([q.id for q in questions], results),
    )


def answer_question(db: Session, question_id: str, response: str, user_id: uuid.UUID) -> AnswerOut:
    q = db.get(QuizQuestion, question_id)
    if q is None:
        raise not_found("Question", question_id)
    if q.kind == "mcq":
        try:
            choice = int(response)
        except ValueError:
            raise ApiError(422, "invalid_response", "Response must be an option number") from None
        if not 0 <= choice < len(q.options or []):
            raise ApiError(422, "invalid_response", "No such option")
        correct = choice == q.answer
        accepted: list[dict] = []
        correct_option = int(q.answer)  # type: ignore[arg-type]
    else:
        if db.get(Structure, response) is None:
            raise ApiError(422, "invalid_response", f"Unknown structure '{response}'")
        targets = set(q.answer)  # type: ignore[arg-type]
        # Selecting a part of the target counts (e.g. one rib for "the rib cage").
        correct = response in targets or bool(
            targets & set(anatomy_service.ancestor_ids(db, response))
        )
        names = dict(
            db.execute(select(Structure.id, Structure.name).where(Structure.id.in_(targets))).all()
        )
        accepted = [{"id": sid, "name": names.get(sid, sid)} for sid in q.answer]  # type: ignore[union-attr]
        correct_option = None
    db.add(QuizAttempt(user_id=user_id, question_id=q.id, response=response, correct=correct))
    db.commit()
    return AnswerOut(
        correct=correct,
        correct_option=correct_option,
        accepted=accepted,
        explanation=q.explanation,
        references=_references(db, q.reference_ids),
    )


def glossary(db: Session) -> list[GlossaryEntry]:
    out = []
    for m in db.scalars(select(LearningModule).order_by(LearningModule.display_order)):
        for t in ModuleBody.model_validate(m.body).key_terms:
            out.append(GlossaryEntry(**t.model_dump(), module_id=m.id, module_title=m.title))
    return sorted(out, key=lambda e: e.term.casefold())
