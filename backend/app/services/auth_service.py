from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rbac import DEFAULT_ROLE
from app.core.security import hash_password, hash_token, new_session_token, verify_password
from app.db.base import utcnow
from app.models import AuditLog, AuthSession, Role, User


def normalise_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalise_email(email)))


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password: str,
    roles: list[str] | None = None,
    educational_level: str = "undergraduate",
) -> User:
    role_ids = roles or [DEFAULT_ROLE]
    role_rows = list(db.scalars(select(Role).where(Role.id.in_(role_ids))))
    if len(role_rows) != len(set(role_ids)):
        raise ValueError(f"Unknown role in {role_ids}")
    user = User(
        email=normalise_email(email),
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        educational_level=educational_level,
        roles=role_rows,
    )
    db.add(user)
    db.flush()
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    ok = verify_password(password, user.password_hash if user else None)
    if not ok or user is None or not user.is_active:
        return None
    return user


def start_session(
    db: Session, user: User, *, ip: str | None, user_agent: str | None
) -> tuple[str, AuthSession]:
    token = new_session_token()
    now = utcnow()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        created_at=now,
        expires_at=now + timedelta(hours=get_settings().session_ttl_hours),
        ip_address=ip,
        user_agent=(user_agent or "")[:512] or None,
    )
    user.last_login_at = now
    db.add(session)
    return token, session


def resolve_session(db: Session, token: str) -> User | None:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is None or session.revoked_at is not None or session.expires_at <= utcnow():
        return None
    if not session.user.is_active:
        return None
    return session.user


def revoke_session(db: Session, token: str) -> None:
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session and session.revoked_at is None:
        session.revoked_at = utcnow()


def audit(
    db: Session,
    action: str,
    *,
    actor: User | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    ip: str | None = None,
    **details: object,
) -> None:
    db.add(
        AuditLog(
            action=action,
            actor_user_id=actor.id if actor else None,
            target_type=target_type,
            target_id=target_id,
            ip_address=ip,
            details=details,
        )
    )
