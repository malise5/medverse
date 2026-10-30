from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import DbSession, require
from app.core.errors import not_found
from app.core.rbac import Perm
from app.models import Reference
from app.schemas.anatomy import ReferenceOut

router = APIRouter(
    prefix="/references", tags=["references"], dependencies=[Depends(require(Perm.ANATOMY_READ))]
)


@router.get("", response_model=list[ReferenceOut])
def list_references(db: DbSession):
    return list(db.scalars(select(Reference).order_by(Reference.id)))


@router.get("/{reference_id}", response_model=ReferenceOut)
def get_reference(reference_id: str, db: DbSession):
    ref = db.get(Reference, reference_id)
    if ref is None:
        raise not_found("Reference", reference_id)
    return ref
