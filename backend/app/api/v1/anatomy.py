from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from app.api.deps import DbSession, require
from app.core.rbac import Perm
from app.models import AssetBundle, Mesh
from app.models.enums import AudienceLevel
from app.schemas.anatomy import (
    AssetManifest,
    BundleOut,
    Page,
    SearchHit,
    StructureDetail,
    StructureIndex,
    StructureSummary,
    SystemOut,
)
from app.services import anatomy_service

# Anatomy reference data is readable by any authenticated user with anatomy:read.
router = APIRouter(tags=["anatomy"], dependencies=[Depends(require(Perm.ANATOMY_READ))])

CACHE_REFERENCE = "private, max-age=300"


@router.get("/anatomy/systems", response_model=list[SystemOut])
def list_systems(db: DbSession, response: Response):
    response.headers["Cache-Control"] = CACHE_REFERENCE
    return anatomy_service.list_systems(db)


@router.get("/anatomy/index", response_model=StructureIndex)
def structure_index(db: DbSession, response: Response):
    response.headers["Cache-Control"] = CACHE_REFERENCE
    return anatomy_service.structure_index(db)


@router.get("/anatomy/structures", response_model=Page[StructureSummary])
def list_structures(
    db: DbSession,
    system: Annotated[str | None, Query(max_length=48)] = None,
    with_geometry: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
):
    items, total = anatomy_service.list_structures(
        db, system_id=system, with_geometry=with_geometry, page=page, page_size=page_size
    )
    return Page[StructureSummary](items=items, total=total, page=page, page_size=page_size)


@router.get("/anatomy/search", response_model=list[SearchHit])
def search(
    db: DbSession,
    q: Annotated[str, Query(min_length=2, max_length=100)],
    system: Annotated[str | None, Query(max_length=48)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    return anatomy_service.search(db, q, system_id=system, limit=limit)


@router.get("/anatomy/hierarchy/roots", response_model=list[StructureSummary])
def hierarchy_roots(db: DbSession, system: Annotated[str | None, Query(max_length=48)] = None):
    return anatomy_service.hierarchy_roots(db, system)


@router.get("/anatomy/structures/{structure_id}", response_model=StructureDetail)
def get_structure(
    structure_id: str,
    db: DbSession,
    audience: AudienceLevel = AudienceLevel.UNDERGRADUATE,
):
    return anatomy_service.structure_detail(db, structure_id, audience)


@router.get("/anatomy/structures/{structure_id}/children", response_model=list[StructureSummary])
def get_children(structure_id: str, db: DbSession):
    anatomy_service.get_structure(db, structure_id)
    return anatomy_service.children(db, structure_id)


@router.get("/assets/manifest", response_model=AssetManifest)
def asset_manifest(db: DbSession, response: Response):
    response.headers["Cache-Control"] = CACHE_REFERENCE
    bundles = list(db.scalars(select(AssetBundle).order_by(AssetBundle.id)))
    meshes = {
        m_id: (b_id, s_id)
        for m_id, b_id, s_id in db.execute(select(Mesh.id, Mesh.bundle_id, Mesh.structure_id))
    }
    return AssetManifest(bundles=[BundleOut.model_validate(b) for b in bundles], meshes=meshes)
