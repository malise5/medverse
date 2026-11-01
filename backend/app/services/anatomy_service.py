from sqlalchemy import (
    Float,
    String,
    and_,
    case,
    cast,
    func,
    literal,
    or_,
    select,
    union_all,
)
from sqlalchemy.orm import Session

from app.core.errors import not_found
from app.i18n import DEFAULT_LOCALE, overlay
from app.models import (
    AnatomicalSystem,
    AssetBundle,
    Condition,
    ConditionStructure,
    Mesh,
    Reference,
    Structure,
    StructureContent,
    StructureMesh,
    StructureRelationship,
    StructureSynonym,
)
from app.models.enums import INVERSE_LABELS, AudienceLevel, Predicate
from app.schemas.anatomy import (
    ConditionLink,
    ContentOut,
    RelationOut,
    SearchHit,
    SimulationLink,
    StructureDetail,
    StructureIndex,
    StructureSummary,
    SystemOut,
)
from app.services import i18n_service
from app.simulation.registry import models_for_structure

AUDIENCE_ORDER = list(AudienceLevel)


def _escape_like(q: str) -> str:
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _has_geometry_map(db: Session, ids: list[str]) -> set[str]:
    if not ids:
        return set()
    return set(
        db.scalars(
            select(StructureMesh.structure_id).where(StructureMesh.structure_id.in_(ids)).distinct()
        )
    )


def summaries(db: Session, structures: list[Structure]) -> list[StructureSummary]:
    geo = _has_geometry_map(db, [s.id for s in structures])
    return [
        StructureSummary.model_validate(s).model_copy(update={"has_geometry": s.id in geo})
        for s in structures
    ]


def list_systems(
    db: Session, body_model: str | None = None, locale: str = DEFAULT_LOCALE
) -> list[SystemOut]:
    """Systems with structure counts; mesh counts for one body model, or all bodies."""
    counts = dict(
        db.execute(select(Structure.system_id, func.count()).group_by(Structure.system_id)).all()
    )
    mesh_q = (
        select(Structure.system_id, func.count(Mesh.id))
        .join(Mesh, Mesh.structure_id == Structure.id)
        .group_by(Structure.system_id)
    )
    if body_model:
        mesh_q = mesh_q.join(AssetBundle, AssetBundle.id == Mesh.bundle_id).where(
            AssetBundle.body_model == body_model
        )
    mesh_counts = dict(db.execute(mesh_q).all())
    systems = list(db.scalars(select(AnatomicalSystem).order_by(AnatomicalSystem.display_order)))
    tr = i18n_service.translations(db, "system", [s.id for s in systems], locale)
    out = []
    for s in systems:
        local = overlay({"name": s.name, "description": s.description or ""}, tr.get(s.id))
        out.append(
            SystemOut.model_validate(s).model_copy(
                update={
                    "name": local["name"],
                    "description": local["description"] or None,
                    "structure_count": counts.get(s.id, 0),
                    "mesh_count": mesh_counts.get(s.id, 0),
                }
            )
        )
    return out


def structure_index(db: Session) -> StructureIndex:
    rows = db.execute(
        select(Structure.id, Structure.name, Structure.system_id).order_by(Structure.id)
    ).all()
    pos = {sid: i for i, (sid, _, _) in enumerate(rows)}
    parent_of: dict[str, str] = {}
    for sub, obj in db.execute(
        select(StructureRelationship.subject_id, StructureRelationship.object_id)
        .where(StructureRelationship.predicate == Predicate.PART_OF)
        .order_by(StructureRelationship.subject_id, StructureRelationship.object_id)
    ):
        parent_of.setdefault(sub, obj)
    return StructureIndex(
        ids=[r[0] for r in rows],
        names=[r[1] for r in rows],
        systems=[r[2] for r in rows],
        parents=[pos.get(parent_of.get(r[0], ""), -1) for r in rows],
    )


def list_structures(
    db: Session,
    *,
    system_id: str | None,
    with_geometry: bool,
    page: int,
    page_size: int,
) -> tuple[list[StructureSummary], int]:
    stmt = select(Structure)
    if system_id:
        stmt = stmt.where(Structure.system_id == system_id)
    if with_geometry:
        stmt = stmt.where(Structure.id.in_(select(StructureMesh.structure_id).distinct()))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(stmt.order_by(Structure.name).offset((page - 1) * page_size).limit(page_size))
    )
    return summaries(db, rows), total


def search(db: Session, q: str, *, system_id: str | None, limit: int) -> list[SearchHit]:
    """Rank structures by trigram similarity of name or synonym, boosting prefix matches."""
    q = q.strip()
    like = f"%{_escape_like(q)}%"
    prefix = f"{_escape_like(q)}%"

    def scored(text_col):
        return (
            func.greatest(func.similarity(text_col, q), func.word_similarity(q, text_col))
            + case((text_col.ilike(prefix), 0.5), else_=0.0)
            + case((func.lower(text_col) == q.lower(), 1.0), else_=0.0)
        ).cast(Float)

    names = select(
        Structure.id.label("sid"),
        scored(Structure.name).label("score"),
        Structure.name.label("matched"),
    ).where(or_(Structure.name.ilike(like), Structure.name.op("%>")(q)))
    syns = select(
        StructureSynonym.structure_id.label("sid"),
        scored(StructureSynonym.synonym).label("score"),
        cast(StructureSynonym.synonym, String).label("matched"),
    ).where(or_(StructureSynonym.synonym.ilike(like), StructureSynonym.synonym.op("%>")(q)))
    candidates = union_all(names, syns).subquery()

    best = (
        select(
            candidates.c.sid,
            func.max(candidates.c.score).label("score"),
            func.min(candidates.c.matched).label("matched"),
        )
        .group_by(candidates.c.sid)
        .subquery()
    )
    stmt = (
        select(Structure, best.c.score, best.c.matched)
        .join(best, best.c.sid == Structure.id)
        .order_by(best.c.score.desc(), func.length(Structure.name), Structure.name)
        .limit(limit)
    )
    if system_id:
        stmt = stmt.where(Structure.system_id == system_id)
    rows = db.execute(stmt).all()
    geo = _has_geometry_map(db, [r[0].id for r in rows])
    return [
        SearchHit(
            **StructureSummary.model_validate(s).model_dump(exclude={"has_geometry"}),
            has_geometry=s.id in geo,
            score=round(float(score), 4),
            matched_text=matched,
        )
        for s, score, matched in rows
    ]


def get_structure(db: Session, structure_id: str) -> Structure:
    s = db.get(Structure, structure_id)
    if s is None:
        raise not_found("Structure", structure_id)
    return s


def children(db: Session, structure_id: str) -> list[StructureSummary]:
    rows = db.scalars(
        select(Structure)
        .join(StructureRelationship, StructureRelationship.subject_id == Structure.id)
        .where(
            and_(
                StructureRelationship.object_id == structure_id,
                StructureRelationship.predicate == Predicate.PART_OF,
            )
        )
        .order_by(Structure.name)
    )
    return summaries(db, list(rows))


def hierarchy_roots(db: Session, system_id: str | None) -> list[StructureSummary]:
    """Structures that are not part_of anything (optionally within one system)."""
    has_parent = select(StructureRelationship.subject_id).where(
        StructureRelationship.predicate == Predicate.PART_OF
    )
    stmt = select(Structure).where(Structure.id.not_in(has_parent))
    if system_id:
        # Within a system, a root is a structure whose parents are all outside the system.
        parent_in_system = (
            select(StructureRelationship.subject_id)
            .join(Structure, Structure.id == StructureRelationship.object_id)
            .where(
                StructureRelationship.predicate == Predicate.PART_OF,
                Structure.system_id == system_id,
            )
        )
        stmt = select(Structure).where(
            Structure.system_id == system_id, Structure.id.not_in(parent_in_system)
        )
    return summaries(db, list(db.scalars(stmt.order_by(Structure.name).limit(500))))


def _pick_content(rows: list[StructureContent], audience: AudienceLevel) -> list[StructureContent]:
    """One row per section: the requested audience, else the nearest available level."""
    target = AUDIENCE_ORDER.index(audience)
    by_section: dict[str, StructureContent] = {}
    for row in rows:
        cur = by_section.get(row.section)
        dist = abs(AUDIENCE_ORDER.index(row.audience) - target)
        if cur is None or dist < abs(AUDIENCE_ORDER.index(cur.audience) - target):
            by_section[row.section] = row
    order = {s: i for i, s in enumerate(type(rows[0].section))} if rows else {}
    return sorted(by_section.values(), key=lambda r: order[r.section])


def ancestor_ids(db: Session, structure_id: str, max_depth: int = 30) -> list[str]:
    """All structures this one is (transitively) part of."""
    rel = StructureRelationship
    base = (
        select(rel.object_id.label("id"), literal(1).label("depth"))
        .where(rel.subject_id == structure_id, rel.predicate == Predicate.PART_OF)
        .cte("ancestors", recursive=True)
    )
    step = (
        select(rel.object_id, base.c.depth + 1)
        .join(base, rel.subject_id == base.c.id)
        .where(rel.predicate == Predicate.PART_OF, base.c.depth < max_depth)
    )
    tree = base.union(step)
    return list(db.scalars(select(tree.c.id).distinct()))


def structure_detail(
    db: Session,
    structure_id: str,
    audience: AudienceLevel = AudienceLevel.UNDERGRADUATE,
    locale: str = DEFAULT_LOCALE,
) -> StructureDetail:
    """Structure names stay in English/Latin (the language of instruction in anatomy);
    the name of its body system follows the request locale."""
    s = get_structure(db, structure_id)

    rels = list(
        db.scalars(
            select(StructureRelationship).where(
                or_(
                    StructureRelationship.subject_id == s.id,
                    StructureRelationship.object_id == s.id,
                )
            )
        )
    )
    other_ids = {r.object_id if r.subject_id == s.id else r.subject_id for r in rels}
    others = {
        o.id: o
        for o in summaries(
            db, list(db.scalars(select(Structure).where(Structure.id.in_(other_ids))))
        )
    }

    parents: list[StructureSummary] = []
    kids: list[StructureSummary] = []
    relations: list[RelationOut] = []
    for r in rels:
        outgoing = r.subject_id == s.id
        target = others[r.object_id if outgoing else r.subject_id]
        if r.predicate == Predicate.PART_OF:
            (parents if outgoing else kids).append(target)
            continue
        relations.append(
            RelationOut(
                predicate=r.predicate,
                label=r.predicate.value.replace("_", " ")
                if outgoing
                else INVERSE_LABELS[r.predicate],
                direction="outgoing" if outgoing else "incoming",
                relation_class=r.relation_class,
                target=target,
                source=r.source,
                verification_status=r.verification_status,
                notes=r.notes,
            )
        )
    relations.sort(key=lambda r: (r.relation_class, r.direction, r.predicate, r.target.name))

    content_rows = list(
        db.scalars(select(StructureContent).where(StructureContent.structure_id == s.id))
    )
    content = _pick_content(content_rows, audience)

    mesh_ids = list(
        db.scalars(
            select(StructureMesh.mesh_id)
            .where(StructureMesh.structure_id == s.id)
            .order_by(StructureMesh.mesh_id)
        )
    )

    cond_rows = db.execute(
        select(Condition, ConditionStructure.role)
        .join(ConditionStructure, ConditionStructure.condition_id == Condition.id)
        .where(ConditionStructure.structure_id == s.id)
    ).all()

    ref_ids = {rid for c in content for rid in c.reference_ids}
    ref_ids |= {r.reference_id for r in rels if r.reference_id}
    references = list(db.scalars(select(Reference).where(Reference.id.in_(ref_ids))))

    return StructureDetail(
        **StructureSummary.model_validate(s).model_dump(exclude={"has_geometry"}),
        has_geometry=bool(mesh_ids),
        latin_name=s.latin_name,
        region=s.region,
        identity_source=s.identity_source,
        verification_status=s.verification_status,
        system_name=(
            overlay(
                {"name": s.system.name},
                i18n_service.translations(db, "system", [s.system.id], locale).get(s.system.id),
            )["name"]
            if s.system
            else None
        ),
        synonyms=s.synonyms,
        xrefs=s.xrefs,
        parents=sorted(parents, key=lambda p: p.name),
        children=sorted(kids, key=lambda p: p.name),
        mesh_ids=mesh_ids,
        content=[ContentOut.model_validate(c) for c in content],
        relations=relations,
        conditions=[
            ConditionLink(id=c.id, name=c.name, category=c.category, role=role)
            for c, role in cond_rows
        ],
        simulations=[
            SimulationLink(model_id=m.definition.id, name=m.definition.name)
            for m in models_for_structure(s.id, ancestor_ids(db, s.id))
        ],
        references=references,
    )


def body_models_of(db: Session, structure_ids: list[str]) -> dict[str, list[str]]:
    """Structure -> body models ("male", "female") that have at least one of its meshes."""
    if not structure_ids:
        return {}
    rows = db.execute(
        select(StructureMesh.structure_id, AssetBundle.body_model)
        .join(Mesh, Mesh.id == StructureMesh.mesh_id)
        .join(AssetBundle, AssetBundle.id == Mesh.bundle_id)
        .where(StructureMesh.structure_id.in_(structure_ids))
        .distinct()
    )
    out: dict[str, set[str]] = {}
    for sid, model in rows:
        out.setdefault(sid, set()).add(model)
    order = {"male": 0, "female": 1}
    return {sid: sorted(models, key=order.get) for sid, models in out.items()}
