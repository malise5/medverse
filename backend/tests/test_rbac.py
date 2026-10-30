from sqlalchemy import select

from app.core.rbac import ROLES, Perm
from app.models import Role, User
from tests.conftest import register


def test_roles_seeded_with_expected_permissions(db):
    roles = {r.id: {p.id for p in r.permissions} for r in db.scalars(select(Role))}
    assert set(roles) == set(ROLES)
    assert roles["platform_admin"] == {p.value for p in Perm}
    assert Perm.CONTENT_REVIEW.value in roles["content_expert"]
    assert Perm.CONTENT_REVIEW.value not in roles["student"]
    assert Perm.COURSE_MANAGE.value in roles["lecturer"]


def test_user_without_permission_is_forbidden(client, db):
    email = register(client)["user"]["email"]
    user = db.scalar(select(User).where(User.email == email))
    user.roles = []
    db.commit()
    r = client.get("/api/v1/anatomy/systems")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"
