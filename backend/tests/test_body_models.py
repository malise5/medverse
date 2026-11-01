"""Male and female 3D bodies: separate sources, shared knowledge graph."""

import json

from sqlalchemy import select

from app.core.config import get_settings
from app.models import AssetBundle, Mesh, Structure, StructureMesh

CONTENT = get_settings().content_dir


def _manifest(client, model):
    return client.get("/api/v1/assets/manifest", params={"model": model}).json()


def test_models_endpoint_lists_both_bodies_with_coverage(auth_client):
    models = {m["id"]: m for m in auth_client.get("/api/v1/assets/models").json()}
    assert set(models) == {"male", "female"}
    female = {s["system_id"]: s["mesh_count"] for s in models["female"]["systems"]}
    male = {s["system_id"]: s["mesh_count"] for s in models["male"]["systems"]}
    assert female["reproductive"] > 0 and male["reproductive"] > 0
    assert 0 < female["muscular"] < male["muscular"]  # female: fitted head muscles only
    assert models["female"]["license"] == "CC BY 4.0, CC BY-SA 4.0"  # HRA + Z-Anatomy head
    # male: BodyParts3D (CC BY 4.0) plus registered SPL atlas meshes (3D Slicer License Part B)
    assert "CC BY 4.0" in models["male"]["license"] and "3D Slicer" in models["male"]["license"]
    assert any("Human Reference Atlas" in s for s in models["female"]["sources"])


def test_unknown_model_is_rejected(auth_client):
    assert auth_client.get("/api/v1/assets/manifest", params={"model": "x"}).status_code == 422


def test_sex_specific_organs_exist_only_in_their_body(auth_client):
    male, female = _manifest(auth_client, "male"), _manifest(auth_client, "female")

    def in_model(manifest, structure_id):
        ids = auth_client.get(f"/api/v1/anatomy/structures/{structure_id}").json()["mesh_ids"]
        return any(i in manifest["meshes"] for i in ids)

    for female_only in ("FMA:17558", "FMA:7213", "FMA:7214", "FMA:18483", "FMA:57991"):
        assert in_model(female, female_only) and not in_model(male, female_only), female_only
    assert in_model(male, "FMA:9600") and not in_model(female, "FMA:9600")  # prostate
    for shared in ("FMA:7088", "FMA:7204", "FMA:7197", "FMA:50801"):
        assert in_model(male, shared) and in_model(female, shared), shared


def test_female_structures_are_linked_into_the_graph(auth_client):
    uterus = auth_client.get("/api/v1/anatomy/structures/FMA:17558").json()
    assert uterus["name"] == "uterus" and uterus["system_id"] == "reproductive"
    assert uterus["identity_source"] == "hra-vhf"
    assert {c["name"] for c in uterus["children"]} >= {"fundus of uterus", "body of uterus"}
    # curated content applies to the female-only structure
    assert any(c["section"] == "overview" for c in uterus["content"])
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "fallopian tube"}).json()
    assert {"FMA:18483", "FMA:18484"} & {h["id"] for h in hits}


def test_systems_counts_per_body(auth_client):
    female = {
        s["id"]: s
        for s in auth_client.get("/api/v1/anatomy/systems", params={"model": "female"}).json()
    }
    allb = {s["id"]: s for s in auth_client.get("/api/v1/anatomy/systems").json()}
    # female muscles exist only in the head (Z-Anatomy, fitted from a male-derived model)
    assert 0 < female["muscular"]["mesh_count"] < allb["muscular"]["mesh_count"]
    assert 0 < female["reproductive"]["mesh_count"] < allb["reproductive"]["mesh_count"] + 1


def test_female_assets_are_cc_by_with_organ_citations():
    report = json.loads((CONTENT / "generated/hra-female/pipeline_report.json").read_text())
    assert report["organs"] and not report["licence_failures"]
    for organ in report["organs"]:
        assert organ["license"] == "CC BY 4.0" and organ["doi"].startswith("https://doi.org/")
    files = {o["file"] for o in report["organs"]}
    assert "3d-vh-f-placenta-full-term" not in files  # pregnancy-specific, excluded
    assert 1.4 < report["body_height_m"] < 1.9


def test_classification_overrides_fix_lung_system(db):
    assert db.get(Structure, "FMA:7310").system_id == "respiratory"  # left lung
    assert db.get(Structure, "FMA:7395").system_id == "respiratory"  # right main bronchus


def test_structure_meshes_cover_each_mesh_owner(db):
    """Every mesh is reachable from its owning structure, in both bodies."""
    owned = set(db.execute(select(Mesh.structure_id, Mesh.id)).all())
    linked = set(db.execute(select(StructureMesh.structure_id, StructureMesh.mesh_id)).all())
    assert owned <= linked
    models = set(db.scalars(select(AssetBundle.body_model).distinct()))
    assert models == {"male", "female"}
