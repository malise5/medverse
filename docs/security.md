# Security architecture

## Implemented (Phase 1)

| Control | Implementation |
|---|---|
| Password storage | Argon2id (argon2-cffi defaults, RFC 9106); dummy-hash verification for unknown users (timing equalisation) |
| Password policy | ≥ 12 chars, ≥ 3 character classes (server and client) |
| Sessions | 256-bit random opaque tokens; only SHA-256 stored; expiry (12 h default) and revocation; stale cookies expired on 401 |
| Cookies | `httpOnly`, `SameSite=Lax`, `Secure` in production; same-origin via Next.js rewrite |
| CSRF | SameSite=Lax + JSON bodies; no state change on GET |
| WebSocket | cookie auth + Origin allow-list (prevents cross-site WebSocket hijacking) |
| RBAC | permissions per role (`core/rbac.py`), synced to DB; enforced per router via `require(Perm…)` |
| Rate limiting | login: 10 / 5 min per (IP, email); Redis-backed with in-process fallback |
| Input validation | Pydantic on every body/query; simulation parameters bounds-checked; LIKE wildcards escaped |
| Errors | structured; unhandled exceptions logged server-side, generic message to client |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; HSTS in production |
| Audit log | register, login, failed login, logout |
| Redirects | post-login `next` restricted to same-origin relative paths |
| Containers | non-root users in both Dockerfiles |
| Supply chain | lockfiles; CI `npm audit` + `pip-audit`; pipeline tool versions pinned |

Roles: student, doctor, lecturer, institution_admin, content_expert, platform_admin
(permission matrix in `backend/app/core/rbac.py`, tested in `tests/test_rbac.py`).

## Not yet implemented

| Gap | Plan (phase) |
|---|---|
| MFA | `users.mfa_enabled` exists; TOTP enrolment + WebAuthn (9) |
| Tenant isolation | `institution_id` on users; add service-layer scoping + PostgreSQL RLS before any tenant-owned data ships (8–9) |
| Password reset, email verification | signed single-use tokens via email provider (2) |
| Session listing / revoke-all | UI over `auth_sessions` (2) |
| Content Security Policy | nonce-based CSP once inline styles from third-party libs are audited (2) |
| Encryption at rest | managed PostgreSQL with storage encryption; secrets in a vault (9) |
| Backups / DR | PITR on managed PostgreSQL; restore drills (9) |
| Security testing | OWASP ZAP baseline in CI; periodic penetration tests (9) |

## Data protection

- No real patient data is collected or supported. Clinical cases (Phase 7) will be fictional and labelled as simulated.
- Imaging (Phase 6) accepts only de-identified data; DICOM tags are stripped server-side before storage; PHI detection blocks upload.
- GDPR: minimal personal data (name, email, educational level); export/delete endpoints planned with the LMS (Phase 8).
- AI assistant (Phase 7): prompts stored only with consent and tenant policy; no patient data in prompts.
