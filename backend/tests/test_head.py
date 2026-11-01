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
