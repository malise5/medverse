"""Idempotent loader from the version-controlled `content/` directory into PostgreSQL.

Load order matters (foreign keys): references -> systems -> structures -> graph ->
content -> assets -> pathology -> RBAC. Every reference to an unknown structure or
citation is collected and reported as a ContentIntegrityError; nothing is silently
dropped.
"""

import json
import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.rbac import PERMISSION_DESCRIPTIONS, ROLES
from app.models import (
    AnatomicalSystem,
    AssetBundle,
    Condition,
    ConditionScenario,
    ConditionStructure,
    Mesh,
    Permission,
    Reference,
    Role,
    Structure,
    StructureContent,
    StructureMesh,
    StructureRelationship,
    StructureSynonym,
    StructureXref,
)
from app.models.enums import (
    ContentSection,
    EvidenceClass,
    Predicate,
    VerificationStatus,
)

log = logging.getLogger("medverse.seed")

BP3D_SOURCE = "bodyparts3d-4.0"
CURATED_SOURCE = "medverse-curated"
CHUNK = 1000


class ContentIntegrityError(RuntimeError):
    pass


@dataclass
class SeedReport:
    counts: dict[str, int] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)


def _read(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _chunks(rows: list[dict], size: int = CHUNK) -> Iterable[list[dict]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _upsert(db: Session, model, rows: list[dict], keys: list[str]) -> None:
    if not rows:
        return
    update_cols = [c for c in rows[0] if c not in keys]
    for chunk in _chunks(rows):
        stmt = insert(model).values(chunk)
        if update_cols:
            stmt = stmt.on_conflict_do_update(
                index_elements=keys, set_={c: stmt.excluded[c] for c in update_cols}
            )
        else:
            stmt = stmt.on_conflict_do_nothing(index_elements=keys)
        db.execute(stmt)


def seed_rbac(db: Session) -> None:
    _upsert(
        db,
        Permission,
        [{"id": p.value, "description": d} for p, d in PERMISSION_DESCRIPTIONS.items()],
        ["id"],
    )
    _upsert(
        db,
        Role,
        [{"id": rid, "name": n, "description": d} for rid, (n, d, _) in ROLES.items()],
        ["id"],
    )
    db.flush()
    perms = {p.id: p for p in db.scalars(select(Permission))}
    for role in db.scalars(select(Role)):
        role.permissions = [perms[p.value] for p in sorted(ROLES[role.id][2])]


def seed_content(db: Session, content_dir: Path) -> SeedReport:
    report = SeedReport()
    problems = report.problems

    # References ---------------------------------------------------------------
    refs = _read(content_dir / "references.json")
    _upsert(
        db,
        Reference,
        [
            {
                k: r.get(k)
                for k in ("id", "citation", "kind", "year", "doi", "pmid", "url", "license_note")
            }
            for r in refs
        ],
        ["id"],
    )
    ref_ids = {r["id"] for r in refs}
    report.counts["references"] = len(refs)

    # Systems ------------------------------------------------------------------
    systems = _read(content_dir / "systems.json")["systems"]
    _upsert(
        db,
        AnatomicalSystem,
        [
            {
                k: s[k]
                for k in (
                    "id",
                    "name",
                    "fma_id",
                    "description",
                    "display_order",
                    "dissection_depth",
                )
            }
            for s in systems
        ],
        ["id"],
    )
    system_ids = {s["id"] for s in systems}
    report.counts["systems"] = len(systems)

    # Source-imported structures (BodyParts3D) --------------------------------
    gen = content_dir / "generated" / "bodyparts3d"
    structures = _read(gen / "structures.json") if (gen / "structures.json").exists() else []
    for s in structures:
        if s["system_id"] not in system_ids:
            problems.append(f"structure {s['id']}: unknown system {s['system_id']}")
    _upsert(
        db,
        Structure,
        [
            {
                "id": s["id"],
                "name": s["name"],
                "system_id": s["system_id"],
                "laterality": s["laterality"],
                "is_compound": s["is_compound"],
                "identity_source": BP3D_SOURCE,
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
            }
            for s in structures
        ],
        ["id"],
    )
    _upsert(
        db,
        StructureXref,
        [
            {
                "structure_id": s["id"],
                "source": "FMA",
                "code": s["id"].split(":", 1)[1],
                "license": "Identifier only (FMA, CC BY 3.0)",
            }
            for s in structures
            if s["id"].startswith("FMA:")
        ],
        ["structure_id", "source"],
    )
    report.counts["structures"] = len(structures)
    known = set(db.scalars(select(Structure.id)))

    # Graph: part_of from source + curated relations -------------------------
    rel_rows: list[dict] = []
    for r in _read(gen / "relationships.json") if (gen / "relationships.json").exists() else []:
        if r["subject"] not in known or r["object"] not in known:
            problems.append(f"source relation {r}: unknown structure")
            continue
        pred = Predicate(r["predicate"])
        rel_rows.append(
            {
                "subject_id": r["subject"],
                "predicate": pred.value,
                "object_id": r["object"],
                "relation_class": pred.relation_class.value,
                "source": BP3D_SOURCE,
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
                "notes": None,
                "reference_id": "bodyparts3d",
            }
        )

    curated = _read(content_dir / "anatomy" / "curated.json")
    author = curated.get("author")
    synonym_rows: list[dict] = []
    content_rows: list[dict] = []
    for entry in curated["structures"]:
        sid = entry["id"]
        if sid not in known:
            problems.append(f"curated entry {sid}: structure does not exist")
            continue
        if entry.get("latin_name"):
            db.get(Structure, sid).latin_name = entry["latin_name"]
            synonym_rows.append(
                {
                    "structure_id": sid,
                    "synonym": entry["latin_name"],
                    "kind": "latin",
                    "source": "TA2 (curated)",
                }
            )
        for syn in entry.get("synonyms", []):
            synonym_rows.append(
                {
                    "structure_id": sid,
                    "synonym": syn["synonym"],
                    "kind": syn["kind"],
                    "source": CURATED_SOURCE,
                }
            )
        for rel in entry.get("relations", []):
            pred = Predicate(rel["predicate"])
            if rel["object"] not in known:
                problems.append(f"curated relation {sid} {pred} {rel['object']}: unknown object")
                continue
            if rel.get("reference") and rel["reference"] not in ref_ids:
                problems.append(f"curated relation {sid}: unknown reference {rel['reference']}")
                continue
            rel_rows.append(
                {
                    "subject_id": sid,
                    "predicate": pred.value,
                    "object_id": rel["object"],
                    "relation_class": pred.relation_class.value,
                    "source": CURATED_SOURCE,
                    "verification_status": VerificationStatus.DRAFT.value,
                    "notes": rel.get("notes"),
                    "reference_id": rel.get("reference"),
                }
            )
        for c in entry.get("content", []):
            missing = [r for r in c.get("references", []) if r not in ref_ids]
            if missing:
                problems.append(f"content {sid}/{c['section']}: unknown references {missing}")
            if not c.get("references"):
                problems.append(f"content {sid}/{c['section']}: no references (required)")
            content_rows.append(
                {
                    "structure_id": sid,
                    "section": ContentSection(c["section"]).value,
                    "audience": c.get("audience", "undergraduate"),
                    "body": c["body"],
                    "evidence_class": c.get(
                        "evidence_class", EvidenceClass.B_EVIDENCE_SUPPORTED.value
                    ),
                    "verification_status": VerificationStatus.DRAFT.value,
                    "version": c.get("version", 1),
                    "author": author,
                    "reference_ids": c.get("references", []),
                }
            )
    _upsert(db, StructureRelationship, rel_rows, ["subject_id", "predicate", "object_id"])
    _upsert(db, StructureSynonym, synonym_rows, ["structure_id", "synonym"])
    _upsert(db, StructureContent, content_rows, ["structure_id", "section", "audience"])
    report.counts["relationships"] = len(rel_rows)
    report.counts["content_sections"] = len(content_rows)

    # 3D assets ----------------------------------------------------------------
    bundles = _read(gen / "bundles.json") if (gen / "bundles.json").exists() else []
    _upsert(db, AssetBundle, bundles, ["id"])
    bundle_ids = {b["id"] for b in bundles}
    meshes = _read(gen / "meshes.json") if (gen / "meshes.json").exists() else []
    mesh_rows = []
    for m in meshes:
        if m["bundle_id"] not in bundle_ids or m["structure_id"] not in known:
            problems.append(f"mesh {m['id']}: unknown bundle or structure")
            continue
        mesh_rows.append(m)
    _upsert(db, Mesh, mesh_rows, ["id"])
    mesh_ids = {m["id"] for m in mesh_rows}
    sm = _read(gen / "structure_meshes.json") if (gen / "structure_meshes.json").exists() else {}
    db.execute(delete(StructureMesh))
    sm_rows = [
        {"structure_id": sid, "mesh_id": mid}
        for sid, mids in sm.items()
        if sid in known
        for mid in mids
        if mid in mesh_ids
    ]
    _upsert(db, StructureMesh, sm_rows, ["structure_id", "mesh_id"])
    report.counts["bundles"] = len(bundles)
    report.counts["meshes"] = len(mesh_rows)

    # Pathology ------------------------------------------------------------------
    conditions = _read(content_dir / "pathology" / "conditions.json")["conditions"]
    for c in conditions:
        for r in c["references"]:
            if r not in ref_ids:
                problems.append(f"condition {c['id']}: unknown reference {r}")
        affected = [a for a in c["affected_structures"] if a["structure_id"] in known]
        for a in c["affected_structures"]:
            if a["structure_id"] not in known:
                problems.append(f"condition {c['id']}: unknown structure {a['structure_id']}")
        row = db.get(Condition, c["id"])
        if row is None:
            row = Condition(id=c["id"])
            db.add(row)
        else:
            # Flush orphan deletion first: the unit of work would otherwise insert the
            # replacement scenarios (same primary keys) before deleting the old ones.
            row.affected_structures.clear()
            row.scenarios.clear()
            db.flush()
        for k in (
            "name",
            "category",
            "summary",
            "mechanism",
            "anatomical_changes",
            "physiological_consequences",
            "clinical_manifestations",
            "complications",
            "investigations",
            "management_principles",
        ):
            setattr(row, k, c.get(k))
        row.evidence_class = EvidenceClass(c["evidence_class"])
        row.verification_status = VerificationStatus.DRAFT
        row.reference_ids = c["references"]
        row.affected_structures = [
            ConditionStructure(structure_id=a["structure_id"], role=a["role"]) for a in affected
        ]
        row.scenarios = [
            ConditionScenario(
                id=s["id"],
                model_id=s["model_id"],
                title=s["title"],
                description=s["description"],
                parameter_overrides=s["parameter_overrides"],
                assumptions=s["assumptions"],
            )
            for s in c["scenarios"]
        ]
        db.flush()
    report.counts["conditions"] = len(conditions)

    seed_rbac(db)
    return report


def run_seed(db: Session, content_dir: Path, *, strict: bool = True) -> SeedReport:
    report = seed_content(db, content_dir)
    if report.problems and strict:
        db.rollback()
        raise ContentIntegrityError(
            f"{len(report.problems)} content integrity problem(s):\n  "
            + "\n  ".join(report.problems[:50])
        )
    db.commit()
    return report
