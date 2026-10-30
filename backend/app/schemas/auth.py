import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import AudienceLevel


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=12, max_length=256)
    educational_level: AudienceLevel = AudienceLevel.UNDERGRADUATE

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        classes = sum(
            [
                any(c.islower() for c in v),
                any(c.isupper() for c in v),
                any(c.isdigit() for c in v),
                any(not c.isalnum() for c in v),
            ]
        )
        if classes < 3:
            raise ValueError(
                "Password must contain at least three of: lowercase, uppercase, digit, symbol"
            )
        return v


class LoginRequest(BaseModel):
    # Plain string: login only has to match an existing account, so registration-time
    # deliverability rules (e.g. rejecting special-use domains) must not apply here.
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    educational_level: AudienceLevel
    roles: list[str] = Field(validation_alias="role_ids")
    permissions: list[str] = Field(validation_alias="permission_ids")
    institution_id: uuid.UUID | None
    mfa_enabled: bool


class SessionOut(BaseModel):
    user: UserOut
    # Returned for non-browser API clients; browsers use the httpOnly cookie.
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - token type label, not a secret
    expires_in: int
