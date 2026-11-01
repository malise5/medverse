"""Idempotent loader from the version-controlled `content/` directory into PostgreSQL.

Load order matters (foreign keys): references -> systems -> structures -> graph ->
content -> assets -> pathology -> learning modules and quizzes -> RBAC. Every reference
to an unknown structure or citation is collected and reported as a ContentIntegrityError;
nothing is silently dropped.
"""

import json
import logging
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.rbac import PERMISSION_DESCRIPTIONS, ROLES
from app.i18n import DEFAULT_LOCALE, LOCALES
from app.models import (
    AnatomicalSystem,
    AssetBundle,
    Condition,
    ConditionScenario,
    ConditionStructure,
    ContentTranslation,
    LearningModule,
    Mesh,
    MeshContact,
    Permission,
    QuizQuestion,
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
    AudienceLevel,
    ContentSection,
    EvidenceClass,
    Predicate,
    VerificationStatus,
)
from app.schemas.learning import ModuleIn, QuestionIn
from app.services import i18n_service
from app.simulation.registry import list_models

log = logging.getLogger("medverse.seed")

BP3D_SOURCE = "bodyparts3d-4.0"
HRA_SOURCE = "hra-vhf"  # Human Reference Atlas 3D reference organs, Visible Human Female
ZA_SOURCE = "z-anatomy"  # Z-Anatomy head supplement (CC BY-SA 4.0)
# Supplement outputs used by both bodies; their bundles name their body model.
# zanatomy: pipeline/zanatomy/build.py; meninges: pipeline/meninges/build.py
SUPPLEMENT_DIRS = ("zanatomy", "meninges")
HRA_REFERENCE = "hra2021"
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
    overrides = {
        sid: system
        for system, ids in _read(content_dir / "systems.json")
        .get("structure_system_overrides", {})
        .items()
        if not system.startswith("_")
        for sid in ids
    }
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
                "system_id": overrides.get(s["id"], s["system_id"]),
                "laterality": s["laterality"],
                "is_compound": s["is_compound"],
                "identity_source": s.get("identity_source", BP3D_SOURCE),
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

    # Female body (HRA): new structures only; shared ones keep their male-source record.
    hra = content_dir / "generated" / "hra-female"
    hra_structures = _read(hra / "structures.json") if (hra / "structures.json").exists() else []
    # Upsert every female-source structure the male source does not define, so renamed
    # or re-classified records from a newer female build replace older ones.
    bp3d_ids = {s["id"] for s in structures}
    hra_new = [s for s in hra_structures if s["id"] not in bp3d_ids]
    for s in hra_new:
        if s["system_id"] not in system_ids:
            problems.append(f"female structure {s['id']}: unknown system {s['system_id']}")
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
                "identity_source": HRA_SOURCE,
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
            }
            for s in hra_new
        ],
        ["id"],
    )
    _upsert(
        db,
        StructureXref,
        [
            {
                "structure_id": s["id"],
                "source": s["id"].split(":", 1)[0],
                "code": s["id"].split(":", 1)[1],
                "license": "Identifier only (FMA CC BY 3.0 / Uberon CC BY 3.0)",
            }
            for s in hra_new
        ],
        ["structure_id", "source"],
    )
    report.counts["female_new_structures"] = len(hra_new)

    # Supplements (Z-Anatomy head, derived meninges; both bodies): structures neither
    # body source defines. See SUPPLEMENT_DIRS.
    supplements = [content_dir / "generated" / d for d in SUPPLEMENT_DIRS]
    za_structures = [
        s
        for d in supplements
        if (d / "structures.json").exists()
        for s in _read(d / "structures.json")
    ]
    hra_ids = {s["id"] for s in hra_structures}
    za_new = [s for s in za_structures if s["id"] not in bp3d_ids and s["id"] not in hra_ids]
    for s in za_new:
        if s["system_id"] not in system_ids:
            problems.append(f"Z-Anatomy structure {s['id']}: unknown system {s['system_id']}")
    _upsert(
        db,
        Structure,
        [
            {
                "id": s["id"],
                "name": s["name"],
                "system_id": overrides.get(s["id"], s["system_id"]),
                "laterality": s["laterality"],
                "is_compound": s["is_compound"],
                "identity_source": s.get("identity_source", ZA_SOURCE),
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
            }
            for s in za_new
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
            for s in za_new
            if s["id"].startswith("FMA:")
        ],
        ["structure_id", "source"],
    )
    report.counts["supplement_new_structures"] = len(za_new)
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

    bp3d_triples = {(r["subject_id"], r["object_id"]) for r in rel_rows}
    for r in _read(hra / "relationships.json") if (hra / "relationships.json").exists() else []:
        if r["subject"] not in known or r["object"] not in known:
            problems.append(f"female relation {r}: unknown structure")
            continue
        if (r["subject"], r["object"]) in bp3d_triples:
            continue
        rel_rows.append(
            {
                "subject_id": r["subject"],
                "predicate": Predicate.PART_OF.value,
                "object_id": r["object"],
                "relation_class": Predicate.PART_OF.relation_class.value,
                "source": HRA_SOURCE,
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
                "notes": None,
                "reference_id": HRA_REFERENCE if HRA_REFERENCE in ref_ids else None,
            }
        )
    seen_pairs = {(r["subject_id"], r["object_id"]) for r in rel_rows}
    za_rels = [
        r
        for d in supplements
        if (d / "relationships.json").exists()
        for r in _read(d / "relationships.json")
    ]
    for r in za_rels:
        if r["subject"] not in known or r["object"] not in known:
            problems.append(f"Z-Anatomy relation {r}: unknown structure")
            continue
        if (r["subject"], r["object"]) in seen_pairs:
            continue
        rel_rows.append(
            {
                "subject_id": r["subject"],
                "predicate": Predicate.PART_OF.value,
                "object_id": r["object"],
                "relation_class": Predicate.PART_OF.relation_class.value,
                "source": ZA_SOURCE,
                "verification_status": VerificationStatus.SOURCE_IMPORTED.value,
                "notes": None,
                "reference_id": None,
            }
        )

    curated = _read(content_dir / "anatomy" / "curated.json")
    author = curated.get("author")
    synonym_rows: list[dict] = []
    content_rows: list[dict] = []
    # An entry may name one structure ("id") or several that share the text ("ids"),
    # e.g. the left and right member of a paired organ.
    expanded = [
        {**entry, "id": sid}
        for entry in curated["structures"]
        for sid in (entry["ids"] if "ids" in entry else [entry["id"]])
    ]
    seen_ids: set[str] = set()
    for entry in expanded:
        sid = entry["id"]
        if sid in seen_ids:
            problems.append(f"curated entry {sid}: duplicated")
            continue
        seen_ids.add(sid)
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
                    "audience": AudienceLevel(c.get("audience", "undergraduate")).value,
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

    # 3D assets: one generated directory per body model ------------------------
    bundles, meshes, sm = [], [], {}
    # Z-Anatomy bundles name their body model themselves (male and female).
    for directory, body_model in (
        (gen, "male"),
        (hra, "female"),
        *((d, "male") for d in supplements),
    ):
        for b in _read(directory / "bundles.json") if (directory / "bundles.json").exists() else []:
            bundles.append({**b, "body_model": b.get("body_model", body_model)})
        if (directory / "meshes.json").exists():
            meshes.extend(_read(directory / "meshes.json"))
        if (directory / "structure_meshes.json").exists():
            for sid, mids in _read(directory / "structure_meshes.json").items():
                sm.setdefault(sid, []).extend(mids)
    _upsert(db, AssetBundle, bundles, ["id"])
    bundle_ids = {b["id"] for b in bundles}
    mesh_rows = []
    for m in meshes:
        if m["bundle_id"] not in bundle_ids or m["structure_id"] not in known:
            problems.append(f"mesh {m['id']}: unknown bundle or structure")
            continue
        mesh_rows.append({"render_group": None, **m})
    _upsert(db, Mesh, mesh_rows, ["id"])
    mesh_ids = {m["id"] for m in mesh_rows}
    db.execute(delete(StructureMesh))
    sm_rows = [
        {"structure_id": sid, "mesh_id": mid}
        for sid, mids in sm.items()
        if sid in known
        for mid in mids
        if mid in mesh_ids
    ]
    _upsert(db, StructureMesh, sm_rows, ["structure_id", "mesh_id"])

    # Geometric contact graph (optional pipeline output; see pipeline/bodyparts3d/adjacency.py)
    contacts_path = gen / "mesh_adjacency.json"
    contact_rows = []
    if contacts_path.exists():
        for a, b, d in _read(contacts_path)["pairs"]:
            if a in mesh_ids and b in mesh_ids and a != b:
                lo, hi = sorted((a, b))
                contact_rows.append({"mesh_a": lo, "mesh_b": hi, "distance_mm": float(d)})
    db.execute(delete(MeshContact))
    _upsert(db, MeshContact, contact_rows, ["mesh_a", "mesh_b"])
    # Bundles and meshes no longer produced by any pipeline (renamed or removed outputs)
    # would stay in the manifest and 404; remove them (meshes and links cascade).
    db.execute(delete(Mesh).where(Mesh.id.not_in(mesh_ids)))
    db.execute(delete(AssetBundle).where(AssetBundle.id.not_in(bundle_ids)))
    report.counts["mesh_contacts"] = len(contact_rows)
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

    seed_learning(db, content_dir, report, known=known, ref_ids=ref_ids, system_ids=system_ids)
    seed_translations(db, content_dir, report)
    seed_rbac(db)
    return report


def _validation_problems(where: str, exc: ValidationError) -> list[str]:
    return [f"{where}: {'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()]


def seed_learning(
    db: Session,
    content_dir: Path,
    report: SeedReport,
    *,
    known: set[str],
    ref_ids: set[str],
    system_ids: set[str],
) -> None:
    """Body-system modules and quiz questions (content/learning)."""
    problems = report.problems
    base = content_dir / "learning"
    if not (base / "modules.json").exists():
        return
    raw_modules = _read(base / "modules.json")
    modules: list[ModuleIn] = []
    for raw in raw_modules["modules"]:
        try:
            m = ModuleIn.model_validate(raw)
        except ValidationError as exc:
            problems.extend(_validation_problems(f"module {raw.get('id')}", exc))
            continue
        if m.id not in system_ids:
            problems.append(f"module {m.id}: no anatomical system with this id")
            continue
        for r in m.references:
            if r not in ref_ids:
                problems.append(f"module {m.id}: unknown reference {r}")
        for organ in m.body.organs:
            if organ.structure_id and organ.structure_id not in known:
                problems.append(f"module {m.id}: organ {organ.name}: unknown structure")
        for link in m.body.works_with:
            if link.system not in system_ids or link.system == m.id:
                problems.append(f"module {m.id}: works_with {link.system}: invalid system")
        modules.append(m)
    module_ids = {m.id for m in modules}
    if len(module_ids) != len(modules):
        problems.append("learning modules: duplicate ids")

    raw_questions = (
        _read(base / "quizzes.json")["questions"] if (base / "quizzes.json").exists() else []
    )
    questions: list[QuestionIn] = []
    for raw in raw_questions:
        try:
            q = QuestionIn.model_validate(raw)
        except ValidationError as exc:
            problems.extend(_validation_problems(f"question {raw.get('id')}", exc))
            continue
        if q.module not in module_ids:
            problems.append(f"question {q.id}: unknown module {q.module}")
            continue
        for r in q.references:
            if r not in ref_ids:
                problems.append(f"question {q.id}: unknown reference {r}")
        if q.kind == "identify":
            for sid in q.answer:  # type: ignore[union-attr]
                if sid not in known:
                    problems.append(f"question {q.id}: unknown structure {sid}")
        questions.append(q)
    if len({q.id for q in questions}) != len(questions):
        problems.append("quiz questions: duplicate ids")

    author = raw_modules.get("author")
    _upsert(
        db,
        LearningModule,
        [
            {
                "id": m.id,
                "title": m.title,
                "tagline": m.tagline,
                "display_order": m.display_order,
                "body": m.body.model_dump(),
                "reference_ids": m.references,
                "evidence_class": EvidenceClass.B_EVIDENCE_SUPPORTED.value,
                "verification_status": VerificationStatus.DRAFT.value,
                "author": author,
                "version": 1,
            }
            for m in modules
        ],
        ["id"],
    )
    order = {mid: 0 for mid in module_ids}
    rows = []
    for q in questions:
        order[q.module] += 1
        rows.append(
            {
                "id": q.id,
                "module_id": q.module,
                "kind": q.kind,
                "level": q.level,
                "stem": q.stem,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
                "reference_ids": q.references,
                "display_order": order[q.module],
                "verification_status": VerificationStatus.DRAFT.value,
            }
        )
    _upsert(db, QuizQuestion, rows, ["id"])
    # Questions removed from content are removed here (their attempts cascade).
    db.execute(delete(QuizQuestion).where(QuizQuestion.id.not_in([q.id for q in questions])))
    db.execute(delete(LearningModule).where(LearningModule.id.not_in(module_ids)))
    report.counts["learning_modules"] = len(modules)
    report.counts["quiz_questions"] = len(questions)


# Translation files (content/i18n/<locale>/<file>.json) and the items they translate.
TRANSLATION_FILES = {
    "systems.json": "system",
    "modules.json": "module",
    "questions.json": "question",
    "structures.json": "structure",
    "models.json": "model",
    "conditions.json": "condition",
}


def _unknown_fields(base: object, translated: object, path: str = "") -> list[str]:
    """Fields of a translation that the English item does not have (typos, stale keys)."""
    if isinstance(translated, dict):
        if not isinstance(base, dict):
            return [path or "(root)"]
        out = []
        for k, v in translated.items():
            if k not in base:
                out.append(f"{path}{k}")
            else:
                out.extend(_unknown_fields(base[k], v, f"{path}{k}."))
        return out
    if isinstance(translated, list):
        if not isinstance(base, list):
            return [path.rstrip(".") or "(root)"]
        if len(translated) > len(base):
            return [f"{path.rstrip('.')} has {len(translated)} items, English {len(base)}"]
        return [
            x for i, v in enumerate(translated) for x in _unknown_fields(base[i], v, f"{path}{i}.")
        ]
    return []


def seed_translations(db: Session, content_dir: Path, report: SeedReport) -> None:
    """Translations of systems, modules, questions and structures (content/i18n/<locale>).

    Each file maps an item id to a partial copy of its translatable fields; it is checked
    against the English item so a stale id or misspelt field is reported, not ignored.
    """
    sources = {
        "system": {
            s.id: {"name": s.name, "description": s.description or ""}
            for s in db.scalars(select(AnatomicalSystem))
        },
        "module": {
            m.id: {"title": m.title, "tagline": m.tagline, **m.body}
            for m in db.scalars(select(LearningModule))
        },
        "question": {
            q.id: {"stem": q.stem, "options": q.options or [], "explanation": q.explanation}
            for q in db.scalars(select(QuizQuestion))
        },
        "structure": {
            sid: {"name": name} for sid, name in db.execute(select(Structure.id, Structure.name))
        },
        "model": {
            m.definition.id: i18n_service.model_text(asdict(m.definition)) for m in list_models()
        },
        "condition": {c.id: i18n_service.condition_text(c) for c in db.scalars(select(Condition))},
    }
    rows: list[dict] = []
    base_dir = content_dir / "i18n"
    locale_dirs = sorted(p for p in base_dir.iterdir() if p.is_dir()) if base_dir.exists() else []
    for locale_dir in locale_dirs:
        locale = locale_dir.name
        if locale not in LOCALES or locale == DEFAULT_LOCALE:
            report.problems.append(f"i18n: unsupported locale directory {locale}")
            continue
        for file, entity in TRANSLATION_FILES.items():
            path = locale_dir / file
            if not path.exists():
                continue
            data = _read(path)
            for item_id, payload in data.get("items", {}).items():
                where = f"i18n/{locale}/{file} {item_id}"
                if item_id not in sources[entity]:
                    report.problems.append(f"{where}: no such {entity}")
                    continue
                for name in _unknown_fields(sources[entity][item_id], payload):
                    report.problems.append(f"{where}: unknown field {name}")
                rows.append(
                    {
                        "entity_type": entity,
                        "entity_id": item_id,
                        "locale": locale,
                        "payload": payload,
                        "status": data.get("status", "draft"),
                    }
                )
    db.execute(delete(ContentTranslation))
    _upsert(db, ContentTranslation, rows, ["entity_type", "entity_id", "locale"])
    report.counts["translations"] = len(rows)


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
