from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require
from app.core.rbac import Perm
from app.i18n import request_locale
from app.models import User
from app.schemas.learning import AnswerIn, AnswerOut, GlossaryEntry, ModuleDetail, ModuleSummary
from app.services import learning_service

router = APIRouter(prefix="/learning", tags=["learning"])
Learner = Annotated[User, Depends(require(Perm.ANATOMY_READ))]
Lang = Annotated[str, Depends(request_locale)]


@router.get("/modules", response_model=list[ModuleSummary])
def list_modules(db: DbSession, user: Learner, locale: Lang):
    return learning_service.list_modules(db, user.id, locale)


@router.get("/modules/{module_id}", response_model=ModuleDetail)
def get_module(module_id: str, db: DbSession, user: Learner, locale: Lang):
    return learning_service.get_module(db, module_id, user.id, locale)


@router.post("/questions/{question_id}/answer", response_model=AnswerOut)
def answer_question(question_id: str, body: AnswerIn, db: DbSession, user: Learner, locale: Lang):
    return learning_service.answer_question(db, question_id, body.response, user.id, locale)


@router.get("/glossary", response_model=list[GlossaryEntry])
def glossary(db: DbSession, _: Learner, locale: Lang):
    return learning_service.glossary(db, locale)
