from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from app.api.deps import DbSession, require
from app.core.rbac import Perm
from app.i18n import request_locale
from app.models import AssetBundle, Mesh
from app.models.enums import AudienceLevel
from app.schemas.anatomy import (
    AssetManifest,
    BodyModelOut,
    BodyModelSystem,
    BundleOut,
    CirculationOut,
    Page,
    SearchHit,
    StructureDetail,
    StructureIndex,
    StructureSummary,
    SystemOut,
)
from app.services import anatomy_service, circulation_service

# Anatomy reference data is readable by any authenticated user with anatomy:read.
router = APIRouter(tags=["anatomy"], dependencies=[Depends(require(Perm.ANATOMY_READ))])

CACHE_REFERENCE = "private, max-age=300"


BodyModel = Literal["male", "female"]

BODY_MODELS: dict[str, tuple[str, str]] = {
    "male": (
        "Adult male",
        "Whole-body adult male segmented in BodyParts3D (FMA identifiers): skeleton, "
        "muscles, vessels, nervous system and organs.",
    ),
    "female": (
        "Adult female",
        "Adult female organs, skeleton parts and vessels from the Human Reference Atlas "
        "3D reference organs (Visible Human Female), including the female reproductive "
        "organs and breasts. Not every system is covered by this source.",
    ),
}


@router.get("/anatomy/systems", response_model=list[SystemOut])
def list_systems(
    db: DbSession,
    response: Response,
    locale: Annotated[str, Depends(request_locale)],
    model: BodyModel | None = None,
):
    response.headers["Cache-Control"] = CACHE_REFERENCE
    response.headers["Vary"] = "Accept-Language"  # system names are translated
    return anatomy_service.list_systems(db, model, locale)


@router.get("/assets/models", response_model=list[BodyModelOut])
def body_models(db: DbSession, response: Response):
    """The available 3D bodies and how many meshes each has per system."""
    response.headers["Cache-Control"] = CACHE_REFERENCE
    out = []
    for model_id, (label, description) in BODY_MODELS.items():
        bundles = list(db.scalars(select(AssetBundle).where(AssetBundle.body_model == model_id)))
        if not bundles:
            continue
        per_system: dict[str, int] = {}
        for b in bundles:
            per_system[b.system_id or "unclassified"] = (
                per_system.get(b.system_id or "unclassified", 0) + b.mesh_count
            )
        out.append(
            BodyModelOut(
                id=model_id,
                label=label,
                description=description,
                sources=sorted({b.attribution for b in bundles}),
                license=", ".join(sorted({b.license for b in bundles})),
                mesh_count=sum(per_system.values()),
                systems=[
                    BodyModelSystem(system_id=k, mesh_count=v)
                    for k, v in sorted(per_system.items())
                ],
            )
        )
    return out


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
    locale: Annotated[str, Depends(request_locale)],
    response: Response,
    audience: AudienceLevel = AudienceLevel.UNDERGRADUATE,
):
    response.headers["Vary"] = "Accept-Language"  # system name is translated
    return anatomy_service.structure_detail(db, structure_id, audience, locale)


@router.get("/anatomy/structures/{structure_id}/circulation", response_model=CirculationOut)
def get_circulation(structure_id: str, db: DbSession, response: Response):
    response.headers["Cache-Control"] = CACHE_REFERENCE
    return circulation_service.circulation(db, structure_id)


@router.get("/anatomy/structures/{structure_id}/children", response_model=list[StructureSummary])
def get_children(structure_id: str, db: DbSession):
    anatomy_service.get_structure(db, structure_id)
    return anatomy_service.children(db, structure_id)


@router.get("/assets/manifest", response_model=AssetManifest)
def asset_manifest(db: DbSession, response: Response, model: BodyModel = "male"):
    """Bundles and mesh -> structure map of one body model."""
    response.headers["Cache-Control"] = CACHE_REFERENCE
    bundles = list(
        db.scalars(
            select(AssetBundle).where(AssetBundle.body_model == model).order_by(AssetBundle.id)
        )
    )
    meshes = {
        m_id: (b_id, s_id)
        for m_id, b_id, s_id in db.execute(
            select(Mesh.id, Mesh.bundle_id, Mesh.structure_id)
            .join(AssetBundle, AssetBundle.id == Mesh.bundle_id)
            .where(AssetBundle.body_model == model)
        )
    }
    return AssetManifest(
        body_model=model, bundles=[BundleOut.model_validate(b) for b in bundles], meshes=meshes
    )
