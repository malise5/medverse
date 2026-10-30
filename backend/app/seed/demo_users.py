from sqlalchemy.orm import Session

from app.core.rbac import ROLES
from app.services import auth_service

# Development-only credential; documented in README. Never used in production.
DEMO_PASSWORD = "Medverse-Demo-2026!"  # noqa: S105 - dev-only, refused in production


def ensure_demo_users(db: Session) -> list[str]:
    emails = []
    for role_id, (name, _, _) in ROLES.items():
        # example.org is reserved for documentation (RFC 2606) and passes email validation.
        email = f"{role_id.replace('_', '.')}.demo@example.org"
        if auth_service.get_user_by_email(db, email) is None:
            auth_service.create_user(
                db,
                email=email,
                full_name=f"Demo {name}",
                password=DEMO_PASSWORD,
                roles=[role_id],
            )
        emails.append(email)
    db.commit()
    return emails
