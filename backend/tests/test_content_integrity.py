"""Data-integrity checks over the version-controlled content and the seeded database."""

import json

from sqlalchemy import func, select

from app.core.config import get_settings
from app.models import Reference, Structure, StructureContent, StructureMesh
from app.models.enums import VerificationStatus
from app.seed.loader import seed_content
from app.simulation.registry import list_models

CONTENT = get_settings().content_dir


def test_seed_reports_no_integrity_problems(db):
    report = seed_content(db, CONTENT)
    db.rollback()
    assert report.problems == []


def test_seed_is_idempotent(db):
    before = db.scalar(select(func.count()).select_from(Structure))
    seed_content(db, CONTENT)
    db.commit()
    assert db.scalar(select(func.count()).select_from(Structure)) == before


def test_structure_ids_are_curies(db):
    bad = db.scalars(select(Structure.id).where(Structure.id.op("!~")(r"^[A-Z][A-Z0-9]*:\d+$")))
    assert list(bad) == []


def test_every_content_section_is_referenced_and_not_marked_reviewed(db):
    for c in db.scalars(select(StructureContent)):
        assert c.reference_ids, f"{c.structure_id}/{c.section} lacks references"
        # Nothing in-house may claim expert review until a reviewer is recorded.
        if c.verification_status == VerificationStatus.EXPERT_REVIEWED:
            assert c.reviewed_by and c.reviewed_at


def test_simulation_models_reference_real_entries(db):
    ref_ids = set(db.scalars(select(Reference.id)))
    structure_ids = set(db.scalars(select(Structure.id)))
    for m in list_models():
        assert set(m.definition.reference_ids) <= ref_ids, m.definition.id
        assert set(m.definition.linked_structure_ids) <= structure_ids, m.definition.id
        for targets in m.definition.visual_mappings.values():
            assert set(targets) <= structure_ids


def test_every_bundle_file_exists_and_matches_checksum():
    import hashlib

    from app.core.config import BACKEND_DIR

    public = BACKEND_DIR.parent / "frontend" / "public"
    bundles = json.loads((CONTENT / "generated/bodyparts3d/bundles.json").read_text())
    for b in bundles:
        path = public / b["uri"].lstrip("/")
        assert path.exists(), path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == b["sha256"], path


def test_most_structures_have_geometry(db):
    total = db.scalar(select(func.count()).select_from(Structure))
    with_geo = db.scalar(select(func.count(func.distinct(StructureMesh.structure_id))))
    assert with_geo / total > 0.95
