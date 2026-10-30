from fastapi import APIRouter, Request, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession, client_ip, extract_token
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.rate_limit import get_rate_limiter
from app.schemas.auth import LoginRequest, RegisterRequest, SessionOut, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user) -> UserOut:
    return UserOut.model_validate(user)


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.session_cookie_name,
        token,
        max_age=s.session_ttl_hours * 3600,
        httponly=True,
        secure=s.cookie_secure or s.is_production,
        samesite="lax",
        path="/",
    )


def _session_response(response: Response, user, token: str) -> SessionOut:
    _set_cookie(response, token)
    return SessionOut(
        user=user_out(user),
        access_token=token,
        expires_in=get_settings().session_ttl_hours * 3600,
    )


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, request: Request, response: Response, db: DbSession):
    if auth_service.get_user_by_email(db, body.email):
        raise ApiError(status.HTTP_409_CONFLICT, "email_taken", "An account with this email exists")
    try:
        user = auth_service.create_user(
            db,
            email=body.email,
            full_name=body.full_name,
            password=body.password,
            educational_level=body.educational_level.value,
        )
        token, _ = auth_service.start_session(
            db, user, ip=client_ip(request), user_agent=request.headers.get("user-agent")
        )
        auth_service.audit(db, "auth.register", actor=user, ip=client_ip(request))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(
            status.HTTP_409_CONFLICT, "email_taken", "An account with this email exists"
        ) from exc
    return _session_response(response, user, token)


@router.post("/login", response_model=SessionOut)
def login(body: LoginRequest, request: Request, response: Response, db: DbSession):
    s = get_settings()
    ip = client_ip(request)
    allowed, retry_after = get_rate_limiter().hit(
        f"rl:login:{ip}:{auth_service.normalise_email(body.email)}",
        s.login_rate_limit,
        s.login_rate_window_seconds,
    )
    if not allowed:
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "rate_limited",
            "Too many login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    user = auth_service.authenticate(db, body.email, body.password)
    if user is None:
        auth_service.audit(db, "auth.login_failed", ip=ip, email=body.email.lower())
        db.commit()
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "invalid_credentials", "Invalid credentials")
    token, _ = auth_service.start_session(
        db, user, ip=ip, user_agent=request.headers.get("user-agent")
    )
    auth_service.audit(db, "auth.login", actor=user, ip=ip)
    db.commit()
    return _session_response(response, user, token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession, user: CurrentUser):
    s = get_settings()
    token = extract_token(request)
    if token:
        auth_service.revoke_session(db, token)
    auth_service.audit(db, "auth.logout", actor=user, ip=client_ip(request))
    db.commit()
    response.delete_cookie(s.session_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user_out(user)
