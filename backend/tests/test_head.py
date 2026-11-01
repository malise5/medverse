"""Head study: male head supplements (IS-A elements, registered SPL atlases) and content."""

import json

from app.core.config import BACKEND_DIR, get_settings

CONTENT = get_settings().content_dir
REPORT = json.loads((CONTENT / "generated/bodyparts3d/pipeline_report.json").read_text())


def _in_male(auth_client, structure_id):
    manifest = auth_client.get("/api/v1/assets/manifest", params={"model": "male"}).json()
    ids = auth_client.get(f"/api/v1/anatomy/structures/{structure_id}").json()["mesh_ids"]
    return any(i in manifest["meshes"] for i in ids)


def test_registered_atlases_are_reported_with_residuals():
    reg = REPORT["supplements"]["spl_registration"]
    assert reg["head_neck"]["median_mm"] < 5 and reg["head_neck"]["p90_mm"] < 10
    for side in ("inner_ear_right", "inner_ear_left"):
        assert reg[side]["median_mm"] < 6
    assert reg["inner_ear_left"]["mirrored_from_right"] is True
    assert len(REPORT["atlas_derived_meshes"]) == REPORT["supplements"]["spl_meshes"] > 0


def test_slicer_licence_text_ships_with_atlas_bundles():
    bundles = json.loads((CONTENT / "generated/bodyparts3d/bundles.json").read_text())
    tagged = [b for b in bundles if "3D Slicer License Part B" in b["license"]]
    assert tagged and all("SPL" in b["attribution"] for b in tagged)
    text = (
        BACKEND_DIR.parent / "frontend/public/assets/anatomy/bp3d-4.0/LICENSE-3D-Slicer-Part-B.txt"
    ).read_text()
    assert text.startswith("All or portions of this licensed product")
    assert "MODIFIED" in text and "PART B. DOWNLOADING AGREEMENT" in text


def test_head_structures_present_in_male_body(auth_client):
    for sid in (
        "FMA:49006",  # temporalis (SPL)
        "FMA:48996",  # masseter (SPL)
        "FMA:9603",  # thyroid gland (SPL)
        "FMA:60179",  # bony labyrinth (SPL)
        "FMA:52751",  # stapes (SPL)
        "FMA:86464",  # corpus callosum (IS-A)
        "FMA:258714",  # right thalamus (IS-A)
        "FMA:62045",  # optic chiasm (IS-A)
        "FMA:55681",  # right upper central incisor (IS-A)
        "FMA:52736",  # sphenoid bone
        "FMA:50542",  # basilar artery
    ):
        assert _in_male(auth_client, sid), sid


def test_head_content_has_location_function_and_clinical_sections(auth_client):
    d = auth_client.get("/api/v1/anatomy/structures/FMA:50868").json()  # facial nerve
    sections = {c["section"] for c in d["content"]}
    assert {"overview", "gross_anatomy", "physiology", "clinical_anatomy"} <= sections
    assert d["latin_name"] == "Nervus facialis" and d["system_id"] == "nervous"
    stapes = auth_client.get("/api/v1/anatomy/structures/FMA:52751").json()
    assert stapes["identity_source"] == "spl-atlas" and stapes["content"]
    teeth = auth_client.get("/api/v1/anatomy/structures/FMA:55681").json()
    assert teeth["identity_source"] == "bodyparts3d-4.0-isa"


# --- Z-Anatomy head supplement (CC BY-SA 4.0), pipeline/zanatomy/build.py -------------
ZA = CONTENT / "generated/zanatomy-head"


def _mesh_ids(auth_client, model, structure_id):
    manifest = auth_client.get("/api/v1/assets/manifest", params={"model": model}).json()
    ids = auth_client.get(f"/api/v1/anatomy/structures/{structure_id}").json()["mesh_ids"]
    return [i for i in ids if i in manifest["meshes"]]


def test_zanatomy_bundles_are_share_alike_and_separate():
    bundles = json.loads((ZA / "bundles.json").read_text())
    assert bundles and {b["body_model"] for b in bundles} == {"male", "female"}
    for b in bundles:
        assert b["license"] == "CC BY-SA 4.0"
        assert b["uri"].startswith("/assets/anatomy/zanatomy-head/")
        assert "Z-Anatomy" in b["attribution"] and "BodyParts3D" in b["attribution"]
        if b["body_model"] == "female":
            assert "male-derived" in b["attribution"] and "male-derived" in b["source_dataset"]
    text = (
        BACKEND_DIR.parent / "frontend/public/assets/anatomy/zanatomy-head/LICENSE.txt"
    ).read_text()
    assert "CC BY-SA 4.0" in text and "NOT female anatomy" in text


def test_zanatomy_registration_residuals_are_reported():
    report = json.loads((ZA / "pipeline_report.json").read_text())
    male = report["male_registration"]
    assert male["median_mm"] < 2 and male["p90_mm"] < 8 and 0.95 < male["scale"] < 1.08
    for anchor, r in report["female_fit"]["anchors"].items():
        assert r["median_mm"] < 7, anchor


def test_zanatomy_fills_male_head_gaps(auth_client):
    for sid in (
        "FMA:46781",  # orbital part of orbicularis oculi
        "FMA:46836",  # left buccinator
        "FMA:50887",  # left abducens nerve (VI)
        "FMA:50903",  # left hypoglossal nerve (XII)
        "FMA:50767",  # superior sagittal sinus
        "FMA:57417",  # frontal sinus
        "FMA:55561",  # left superior parathyroid gland
    ):
        ids = _mesh_ids(auth_client, "male", sid)
        assert ids and all(i.startswith("ZAM-") for i in ids), sid
        d = auth_client.get(f"/api/v1/anatomy/structures/{sid}").json()
        assert d["identity_source"] == "z-anatomy", sid


def test_female_head_has_fitted_skull_but_keeps_its_own_organs(auth_client):
    for sid in ("FMA:52734", "FMA:52748", "FMA:74052"):  # frontal bone, mandible, malleus
        ids = _mesh_ids(auth_client, "female", sid)
        assert ids and all(i.startswith("ZAF-") for i in ids), sid
    # the male skull stays BodyParts3D; female eyes and brain stay female-donor geometry
    assert not any(i.startswith("ZA") for i in _mesh_ids(auth_client, "male", "FMA:52734"))
    for sid in ("FMA:50801", "FMA:58271"):  # brain, right sclera
        ids = _mesh_ids(auth_client, "female", sid)
        assert ids and not any(i.startswith("ZA") for i in ids), sid
