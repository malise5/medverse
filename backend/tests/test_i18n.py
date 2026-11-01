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
        assert m["translation"] != "missing", m["id"]
        assert m["title"] != en[m["id"]]["title"], m["id"]


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
