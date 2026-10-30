import uuid

from sqlalchemy import select

from app.models import AuditLog, User
from tests.conftest import PASSWORD, register


def test_register_sets_httponly_session_cookie(client):
    body = register(client)
    assert body["user"]["roles"] == ["student"]
    assert "anatomy:read" in body["user"]["permissions"]
    cookie = client.cookies.get("mv_session")
    assert cookie and cookie == body["access_token"]
    assert client.get("/api/v1/auth/me").json()["email"] == body["user"]["email"]


def test_password_is_hashed_with_argon2(client, db):
    body = register(client)
    user = db.scalar(select(User).where(User.email == body["user"]["email"]))
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash


def test_weak_password_rejected(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "weak@example.org", "full_name": "Weak", "password": "alllowercase"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_duplicate_email_conflict_is_case_insensitive(client):
    email = f"dup-{uuid.uuid4().hex[:8]}@example.org"
    register(client, email)
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email.upper(), "full_name": "Again", "password": PASSWORD},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


def test_login_logout_and_session_revocation(client):
    email = register(client)["user"]["email"]
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]

    # Bearer tokens work for non-browser clients.
    client.cookies.clear()
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_invalid_credentials_are_generic_and_audited(client, db):
    email = register(client)["user"]["email"]
    client.cookies.clear()
    wrong = client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong-pass-123"})
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.org", "password": "Wrong-pass-123"}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert db.scalar(
        select(AuditLog).where(
            AuditLog.action == "auth.login_failed", AuditLog.details["email"].as_string() == email
        )
    )


def test_login_rate_limited(client):
    email = f"rl-{uuid.uuid4().hex[:8]}@example.org"
    statuses = [
        client.post("/api/v1/auth/login", json={"email": email, "password": "x"}).status_code
        for _ in range(12)
    ]
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_unauthenticated_requests_rejected(client):
    r = client.get("/api/v1/anatomy/systems")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"


def test_stale_session_cookie_is_expired(client):
    client.cookies.set("mv_session", "not-a-real-token")
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert "mv_session=;" in r.headers["set-cookie"]


def test_demo_users_can_sign_in(client, db):
    from app.seed.demo_users import DEMO_PASSWORD, ensure_demo_users

    for email in ensure_demo_users(db):
        r = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        assert r.status_code == 200, (email, r.text)
