"""Body-system learning modules, quizzes, progress and the expanded curated content."""

import json

import pytest

from app.core.config import get_settings
from app.models.enums import VerificationStatus
from app.schemas.learning import ModuleIn, QuestionIn
from app.seed.loader import SeedReport, seed_learning
from tests.conftest import register

CONTENT = get_settings().content_dir
MODULES = json.loads((CONTENT / "learning" / "modules.json").read_text())["modules"]
QUESTIONS = json.loads((CONTENT / "learning" / "quizzes.json").read_text())["questions"]
SYSTEMS = json.loads((CONTENT / "systems.json").read_text())["systems"]
CORE_SYSTEMS = {s["id"] for s in SYSTEMS} - {"unclassified"}


# --- content ------------------------------------------------------------------------


def test_every_body_system_has_a_module_and_a_quiz():
    assert {m["id"] for m in MODULES} == CORE_SYSTEMS
    for sid in CORE_SYSTEMS:
        qs = [q for q in QUESTIONS if q["module"] == sid]
        assert len(qs) >= 4, sid
        assert {q["level"] for q in qs} >= {"basic", "undergraduate"}, sid


def test_question_ids_unique_and_answers_spread():
    ids = [q["id"] for q in QUESTIONS]
    assert len(ids) == len(set(ids))
    # Guard against a quiz where the right answer is always in the same position.
    positions = [q["answer"] for q in QUESTIONS if q["kind"] == "mcq"]
    assert max(positions.count(i) for i in set(positions)) < 0.6 * len(positions)


def test_modules_use_si_units_with_conventional_equivalents():
    text = json.dumps(MODULES)
    # Pressures in mmHg are always paired with kPa somewhere in the same module.
    for m in MODULES:
        body = json.dumps(m)
        if "mmHg" in body:
            assert "kPa" in body, m["id"]
    assert "mmol/L" in text and "mg/dL" in text
    for imperial in (" ft", " inch", " lb", "°F", " pint", " gallon"):
        assert imperial not in text, imperial


def test_validation_rejects_malformed_items():
    good = QUESTIONS[0]
    with pytest.raises(ValueError):
        QuestionIn.model_validate({**good, "answer": 9})
    with pytest.raises(ValueError):
        QuestionIn.model_validate({**good, "options": ["a", "a", "b"]})
    with pytest.raises(ValueError):
        ModuleIn.model_validate({**MODULES[0], "references": []})
    ident = next(q for q in QUESTIONS if q["kind"] == "identify")
    with pytest.raises(ValueError):
        QuestionIn.model_validate({**ident, "options": ["x", "y", "z"]})


def test_seed_flags_unknown_structures_and_references(db, tmp_path):
    bad_module = json.loads(json.dumps(MODULES[0]))
    bad_module["body"]["organs"][0]["structure_id"] = "FMA:999999999"
    bad_module["references"].append("no_such_ref")
    (tmp_path / "learning").mkdir()
    (tmp_path / "learning" / "modules.json").write_text(json.dumps({"modules": [bad_module]}))
    (tmp_path / "learning" / "quizzes.json").write_text(json.dumps({"questions": []}))
    report = SeedReport()
    seed_learning(db, tmp_path, report, known=set(), ref_ids=set(), system_ids={bad_module["id"]})
    db.rollback()
    assert any("unknown structure" in p for p in report.problems)
    assert any("unknown reference no_such_ref" in p for p in report.problems)


def test_curated_content_covers_every_system_at_basic_level(db):
    from sqlalchemy import select

    from app.models import Structure, StructureContent

    rows = db.execute(
        select(Structure.system_id, StructureContent.audience)
        .join(StructureContent, StructureContent.structure_id == Structure.id)
        .distinct()
    ).all()
    basic = {sid for sid, aud in rows if aud == "basic"}
    assert CORE_SYSTEMS <= basic
    statuses = set(db.scalars(select(StructureContent.verification_status)))
    assert VerificationStatus.EXPERT_REVIEWED not in statuses


# --- API ----------------------------------------------------------------------------


def test_modules_list_with_counts_and_empty_progress(auth_client):
    mods = auth_client.get("/api/v1/learning/modules").json()
    assert [m["id"] for m in mods][:3] == ["skeletal", "muscular", "cardiovascular"]
    sk = mods[0]
    assert sk["structure_count"] > 0 and sk["mesh_count"] > 0
    assert sk["progress"]["answered"] == 0 and sk["progress"]["questions"] >= 4


def test_module_detail_hides_answers_and_resolves_organs(auth_client):
    d = auth_client.get("/api/v1/learning/modules/urinary").json()
    assert set(d["overview"]) == {"basic", "undergraduate", "clinical"}
    kidney = next(o for o in d["organs"] if o["structure_id"] == "FMA:7204")
    assert kidney["in_3d"] and kidney["structure_name"] == "right kidney"
    assert d["references"] and d["verification_status"] == "draft"
    for q in d["questions"]:
        assert "answer" not in q and "explanation" not in q
    lymph = auth_client.get("/api/v1/learning/modules/lymphatic").json()
    assert any(not o["in_3d"] for o in lymph["organs"])  # e.g. spleen: honestly absent
    assert auth_client.get("/api/v1/learning/modules/nope").status_code == 404


def test_mcq_answer_is_graded_and_progress_recorded(auth_client):
    q = next(q for q in QUESTIONS if q["id"] == "cv-04")
    wrong = (q["answer"] + 1) % len(q["options"])
    r = auth_client.post("/api/v1/learning/questions/cv-04/answer", json={"response": str(wrong)})
    assert r.status_code == 200
    body = r.json()
    assert body["correct"] is False and body["correct_option"] == q["answer"]
    assert body["explanation"] and body["references"]
    r = auth_client.post(
        "/api/v1/learning/questions/cv-04/answer", json={"response": str(q["answer"])}
    )
    assert r.json()["correct"] is True
    d = auth_client.get("/api/v1/learning/modules/cardiovascular").json()
    assert d["progress"]["answered"] == 1 and d["progress"]["correct"] == 1
    assert next(x for x in d["questions"] if x["id"] == "cv-04")["last_correct"] is True


def test_identify_accepts_target_or_its_parts(auth_client):
    url = "/api/v1/learning/questions/cv-id-01/answer"  # find the heart
    assert auth_client.post(url, json={"response": "FMA:7088"}).json()["correct"] is True
    # The left ventricle is part of the heart, so selecting it also counts.
    assert auth_client.post(url, json={"response": "FMA:7101"}).json()["correct"] is True
    r = auth_client.post(url, json={"response": "FMA:7197"}).json()  # liver
    assert r["correct"] is False and r["accepted"] == [{"id": "FMA:7088", "name": "heart"}]


def test_invalid_answers_rejected(auth_client):
    base = "/api/v1/learning/questions"
    assert auth_client.post(f"{base}/cv-04/answer", json={"response": "x"}).status_code == 422
    assert auth_client.post(f"{base}/cv-04/answer", json={"response": "99"}).status_code == 422
    r = auth_client.post(f"{base}/cv-id-01/answer", json={"response": "FMA:0"})
    assert r.status_code == 422
    assert auth_client.post(f"{base}/missing/answer", json={"response": "0"}).status_code == 404


def test_progress_is_per_user(client):
    register(client)
    client.post("/api/v1/learning/questions/skel-01/answer", json={"response": "2"})
    assert client.get("/api/v1/learning/modules").json()[0]["progress"]["answered"] == 1
    client.cookies.clear()
    register(client)
    assert client.get("/api/v1/learning/modules").json()[0]["progress"]["answered"] == 0


def test_learning_requires_login(client):
    client.cookies.clear()
    assert client.get("/api/v1/learning/modules").status_code == 401


def test_glossary_is_sorted_and_has_latin_and_origins(auth_client):
    g = auth_client.get("/api/v1/learning/glossary").json()
    terms = [e["term"].casefold() for e in g]
    assert terms == sorted(terms) and len(g) >= 50
    assert any(e["latin"] for e in g) and any(e["origin"] for e in g)


def test_search_finds_international_and_lay_terms(auth_client):
    def ids(q):
        return {h["id"] for h in auth_client.get("/api/v1/anatomy/search", params={"q": q}).json()}

    assert "FMA:7131" in ids("oesophagus") and "FMA:7131" in ids("esophagus")
    assert "FMA:7394" in ids("windpipe")
    assert {"FMA:15629", "FMA:15630"} & ids("suprarenal gland")
    assert {"FMA:13322", "FMA:13323"} & ids("collarbone")
    assert "FMA:50801" in ids("encephalon")


def test_structure_detail_serves_basic_level(auth_client):
    d = auth_client.get("/api/v1/anatomy/structures/FMA:7148", params={"audience": "basic"}).json()
    overview = next(c for c in d["content"] if c["section"] == "overview")
    assert overview["audience"] == "basic" and "stomach" in overview["body"].lower()
    d = auth_client.get("/api/v1/anatomy/structures/FMA:7148").json()
    assert (
        next(c for c in d["content"] if c["section"] == "overview")["audience"] == "undergraduate"
    )
    assert d["latin_name"] == "Gaster"


def test_organs_and_questions_name_the_body_they_are_in(auth_client):
    d = auth_client.get("/api/v1/learning/modules/reproductive").json()
    organs = {o["structure_id"]: o for o in d["organs"] if o["structure_id"]}
    assert organs["FMA:17558"]["body_models"] == ["female"] and organs["FMA:17558"]["in_3d"]
    assert organs["FMA:9600"]["body_models"] == ["male"]
    qs = {q["id"]: q for q in d["questions"]}
    assert qs["rep-id-02"]["body_models"] == ["female"]
    assert qs["rep-id-01"]["body_models"] == ["male"]
    cv = auth_client.get("/api/v1/learning/modules/cardiovascular").json()
    assert next(q for q in cv["questions"] if q["id"] == "cv-id-01")["body_models"] == [
        "male",
        "female",
    ]
    assert next(q for q in cv["questions"] if q["kind"] == "mcq")["body_models"] == []
