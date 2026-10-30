from sqlalchemy import select

from app.models import SimulationRun


def test_model_catalogue_exposes_scientific_documentation(auth_client):
    models = auth_client.get("/api/v1/simulations/models").json()
    wk = next(m for m in models if m["id"] == "cv.windkessel3")
    for key in ("equations", "assumptions", "limitations", "validation", "reference_ids"):
        assert wk[key], key
    assert wk["evidence_class"] == "C"
    assert "not validated" in wk["disclaimer"]


def test_run_persists_record(auth_client, db):
    r = auth_client.post("/api/v1/simulations/models/cv.windkessel3/run", json={"parameters": {}})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["time"]) == len(body["series"]["aortic_pressure"])
    assert 60 < body["metrics"]["diastolic_pressure"] < body["metrics"]["systolic_pressure"] < 160
    run = db.get(SimulationRun, body["run_id"])
    assert run.model_version == "1.0.0"
    assert run.summary["systolic_pressure"] == body["metrics"]["systolic_pressure"]


def test_scenario_overrides_apply_and_user_parameters_win(auth_client):
    url = "/api/v1/simulations/models/cv.windkessel3/run"
    stiff = auth_client.post(url, json={"scenario_id": "arterial-stiffening.compliance-50"}).json()
    assert stiff["parameters"]["arterial_compliance"] == 0.55
    custom = auth_client.post(
        url,
        json={
            "scenario_id": "arterial-stiffening.compliance-50",
            "parameters": {"arterial_compliance": 0.8},
        },
    ).json()
    assert custom["parameters"]["arterial_compliance"] == 0.8


def test_invalid_parameters_return_structured_422(auth_client):
    r = auth_client.post(
        "/api/v1/simulations/models/cv.windkessel3/run",
        json={"parameters": {"heart_rate": 999}},
    )
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "invalid_parameters"
    assert err["details"][0]["loc"] == ["parameters", "heart_rate"]


def test_unknown_model_and_mismatched_scenario(auth_client):
    assert auth_client.post("/api/v1/simulations/models/nope/run", json={}).status_code == 404
    r = auth_client.post(
        "/api/v1/simulations/models/cv.windkessel3/run", json={"scenario_id": "missing"}
    )
    assert r.json()["error"]["code"] == "invalid_scenario"


def test_websocket_runs_and_reports_errors(auth_client):
    with auth_client.websocket_connect("/api/v1/simulations/ws") as ws:
        ws.send_json({"model_id": "cv.windkessel3", "parameters": {"heart_rate": 90}})
        result = ws.receive_json()
        assert result["parameters"]["heart_rate"] == 90
        ws.send_json({"model_id": "cv.windkessel3", "parameters": {"heart_rate": -1}})
        assert ws.receive_json()["error"]["code"] == "invalid_parameters"


def test_websocket_rejects_foreign_origin(auth_client):
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with auth_client.websocket_connect(
            "/api/v1/simulations/ws", headers={"origin": "https://evil.example"}
        ) as ws:
            ws.receive_json()


def test_pathology_condition_detail(auth_client, db):
    conditions = auth_client.get("/api/v1/pathology/conditions").json()
    assert {c["id"] for c in conditions} >= {"arterial-stiffening", "raised-peripheral-resistance"}
    c = auth_client.get("/api/v1/pathology/conditions/arterial-stiffening").json()
    assert c["verification_status"] == "draft"
    assert any(
        a["structure_id"] == "FMA:3734" and a["name"] == "aorta" for a in c["affected_structures"]
    )
    assert c["scenarios"][0]["assumptions"]
    assert {r["id"] for r in c["references"]} == {"laurent2006stiffness", "westerhof2009windkessel"}
    assert db.scalar(select(SimulationRun).limit(1)) is not None
