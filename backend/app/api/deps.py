from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.rbac import Perm
from app.db.session import get_db
from app.models import User
from app.services import auth_service

DbSession = Annotated[Session, Depends(get_db)]


def extract_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return request.cookies.get(get_settings().session_cookie_name)


def get_optional_user(request: Request, db: DbSession) -> User | None:
    token = extract_token(request)
    if not token:
        return None
    return auth_service.resolve_session(db, token)


def get_current_user(
    request: Request, user: Annotated[User | None, Depends(get_optional_user)]
) -> User:
    if user is None:
        headers = {"WWW-Authenticate": "Bearer"}
        name = get_settings().session_cookie_name
        if name in request.cookies:
            # Expire a stale session cookie so the browser stops presenting it.
            headers["Set-Cookie"] = f"{name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            "not_authenticated",
            "Authentication required",
            headers=headers,
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require(permission: Perm) -> Callable[[User], User]:
    def checker(user: CurrentUser) -> User:
        if permission not in user.permission_ids:
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "forbidden",
                f"Missing permission '{permission}'",
            )
        return user

    return checker


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
