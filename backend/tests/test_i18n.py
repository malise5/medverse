"""Content languages: negotiation, translation overlays and translated API responses."""

import json
import shutil

import pytest

from app.core.config import get_settings
from app.i18n import negotiate, overlay, state
from app.seed.loader import SeedReport, seed_translations

CONTENT = get_settings().content_dir


def test_negotiates_swahili_from_accept_language():
    assert negotiate("sw-KE,sw;q=0.9,en;q=0.8") == "sw"
    assert negotiate("en-GB,en;q=0.9,sw;q=0.5") == "en"
    assert negotiate("fr;q=0.9,sw-TZ;q=0.8") == "sw"
    assert negotiate("fr-FR") == "en"
    assert negotiate(None) == "en"


def test_overlay_keeps_english_where_untranslated_and_never_changes_identifiers():
    base = {
        "title": "Heart",
        "latin_name": "Cor",
        "organs": [{"name": "Aorta", "structure_id": "FMA:3734", "role": "Main artery"}],
        "overview": {"basic": "A pump", "clinical": "Detail"},
    }
    tr = {
        "title": "Moyo",
        "latin_name": "Changed",
        "organs": [{"name": "Aota", "structure_id": "FMA:1"}],
        "overview": {"basic": "Pampu", "clinical": "  "},
    }
    out = overlay(base, tr)
    assert out["title"] == "Moyo" and out["latin_name"] == "Cor"
    assert out["organs"][0] == {"name": "Aota", "structure_id": "FMA:3734", "role": "Main artery"}
    assert out["overview"] == {"basic": "Pampu", "clinical": "Detail"}  # blank keeps English
    assert state("sw", base, tr) == "partial"
    assert state("sw", base, None) == "missing"
    assert state("en", base, None) == "source"
    full = {
        "title": "Moyo",
        "organs": [{"name": "Aota", "role": "Ateri kuu"}],
        "overview": {"basic": "Pampu", "clinical": "Kina"},
    }
    assert state("sw", base, full) == "complete"  # identifiers and Latin need no translation


def test_module_and_systems_follow_accept_language(auth_client):
    en = auth_client.get("/api/v1/learning/modules/cardiovascular").json()
    sw = auth_client.get(
        "/api/v1/learning/modules/cardiovascular", headers={"Accept-Language": "sw"}
    ).json()
    assert en["translation"] == "source" and en["title"] == "Cardiovascular system"
    assert sw["title"] == "Mfumo wa moyo na mishipa ya damu"
    assert sw["overview"]["basic"].startswith("Moyo wako")
    assert sw["translation"] in ("partial", "complete")
    if sw["translation"] == "partial":  # untranslated fields stay in English, not empty
        assert all(sw["overview"][lvl] for lvl in ("basic", "undergraduate", "clinical"))
    assert sw["latin_name"] == en["latin_name"]  # international names are not translated
    r = auth_client.get("/api/v1/anatomy/systems", headers={"Accept-Language": "sw-TZ"})
    assert "Accept-Language" in r.headers["vary"]
    names = {s["id"]: s["name"] for s in r.json()}
    assert names["skeletal"] == "Mfumo wa mifupa"


def test_every_module_has_swahili_title_and_beginner_overview(auth_client):
    mods = auth_client.get("/api/v1/learning/modules", headers={"Accept-Language": "sw"}).json()
    en = {m["id"]: m for m in auth_client.get("/api/v1/learning/modules").json()}
    for m in mods:
        assert m["translation"] == "complete", m["id"]
        assert m["title"] != en[m["id"]]["title"], m["id"]


def test_quiz_questions_and_answers_are_in_swahili(auth_client):
    sw_file = json.loads((CONTENT / "i18n" / "sw" / "questions.json").read_text())["items"]
    src = json.loads((CONTENT / "learning" / "quizzes.json").read_text())["questions"]
    for q in src:  # every question, options in the same order (answers are graded by number)
        assert q["id"] in sw_file, q["id"]
        assert len(sw_file[q["id"]].get("options") or []) == len(q.get("options") or []), q["id"]

    sw = auth_client.get("/api/v1/learning/modules/skeletal", headers={"Accept-Language": "sw"})
    qs = {q["id"]: q for q in sw.json()["questions"]}
    assert qs["skel-01"]["stem"] == sw_file["skel-01"]["stem"]
    assert qs["skel-01"]["options"] == sw_file["skel-01"]["options"]
    r = auth_client.post(
        "/api/v1/learning/questions/skel-id-01/answer",
        json={"response": "FMA:7485"},
        headers={"Accept-Language": "sw"},
    ).json()
    assert r["correct"] and r["accepted"] == [{"id": "FMA:7485", "name": "fupa la kidari"}]
    assert r["explanation"] == sw_file["skel-id-01"]["explanation"]


@pytest.fixture
def content_copy(tmp_path):
    shutil.copytree(CONTENT / "i18n", tmp_path / "i18n")
    return tmp_path


def test_seed_reports_stale_ids_and_unknown_fields(db, content_copy):
    path = content_copy / "i18n/sw/modules.json"
    data = json.loads(path.read_text())
    data["items"]["no_such_module"] = {"title": "X"}
    data["items"]["skeletal"]["tilte"] = "typo"
    path.write_text(json.dumps(data))
    report = SeedReport()
    seed_translations(db, content_copy, report)
    db.rollback()
    assert any("no_such_module: no such module" in p for p in report.problems)
    assert any("skeletal: unknown field tilte" in p for p in report.problems)


def test_simulation_models_are_translated_with_ids_and_maths_unchanged(auth_client):
    en = {m["id"]: m for m in auth_client.get("/api/v1/simulations/models").json()}
    r = auth_client.get("/api/v1/simulations/models", headers={"Accept-Language": "sw"})
    assert "Accept-Language" in r.headers["vary"]
    for m in r.json():
        e = en[m["id"]]
        assert m["name"] != e["name"], m["id"]
        assert [p["id"] for p in m["parameters"]] == [p["id"] for p in e["parameters"]]
        assert all(
            p["label"] != q["label"] for p, q in zip(m["parameters"], e["parameters"], strict=True)
        )
        assert m["equations"] == e["equations"]  # technical documentation stays in English
        assert [p["default"] for p in m["parameters"]] == [p["default"] for p in e["parameters"]]
    one = auth_client.get(
        "/api/v1/simulations/models/cv.windkessel3", headers={"Accept-Language": "sw"}
    )
    assert one.json()["parameters"][0]["label"] == "Mapigo ya moyo"


def test_pathology_conditions_are_translated(auth_client):
    sw = {"Accept-Language": "sw"}
    names = {
        c["id"]: c["name"]
        for c in auth_client.get("/api/v1/pathology/conditions", headers=sw).json()
    }
    assert names["arterial-stiffening"].startswith("Kukakamaa kwa ateri")
    d = auth_client.get("/api/v1/pathology/conditions/arterial-stiffening", headers=sw).json()
    assert d["mechanism"].startswith("Mabadiliko ya kimuundo")
    assert d["scenarios"][0]["title"].startswith("Unyumbufu wa jumla")
    assert d["scenarios"][0]["parameter_overrides"]  # numbers untouched
    en = auth_client.get("/api/v1/pathology/conditions/raised-peripheral-resistance").json()
    assert en["complications"] is None  # untranslated empty fields stay empty
