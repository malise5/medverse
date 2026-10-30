# API

Base path `/api/v1`. OpenAPI: `/api/v1/openapi.json`; Swagger UI: `/api/v1/docs`.

## Conventions

- **Versioning**: path (`/api/v1`). Breaking changes → `/api/v2`, old version kept for a deprecation window.
- **Auth**: httpOnly cookie `mv_session` (browsers) or `Authorization: Bearer <token>` (API clients).
- **Errors**: always `{"error": {"code", "message", "details"}}`. Codes include `validation_error` (422), `not_authenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429, with `Retry-After`), `invalid_parameters`, `invalid_scenario`, `email_taken`, `internal_error`.
- **Pagination**: `?page=&page_size=` → `{items, total, page, page_size}` (max 200).
- **Caching**: reference endpoints send `Cache-Control: private, max-age=300`; GLBs are public and cacheable.
- **IDs**: structure IDs are CURIEs; URL-encode them (`FMA%3A7088`).

## Endpoints (implemented)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/health` | none | liveness + DB check |
| POST | `/auth/register` | none | create student account, start session |
| POST | `/auth/login` | none (rate-limited) | start session |
| POST | `/auth/logout` | auth | revoke session |
| GET | `/auth/me` | auth | current user, roles, permissions |
| GET | `/anatomy/systems` | anatomy:read | systems with structure/mesh counts |
| GET | `/anatomy/index` | anatomy:read | compact columnar index of all structures |
| GET | `/anatomy/structures` | anatomy:read | paginated list (`system`, `with_geometry`) |
| GET | `/anatomy/search?q=` | anatomy:read | ranked fuzzy search over names, synonyms, Latin |
| GET | `/anatomy/hierarchy/roots?system=` | anatomy:read | subtree roots |
| GET | `/anatomy/structures/{id}?audience=` | anatomy:read | full detail |
| GET | `/anatomy/structures/{id}/children` | anatomy:read | part_of children |
| GET | `/assets/manifest` | anatomy:read | bundles + mesh→structure map |
| GET | `/references`, `/references/{id}` | anatomy:read | citations |
| GET | `/simulations/models[/{id}]` | anatomy:read | model definitions |
| POST | `/simulations/models/{id}/run` | simulation:run | run, persist record |
| WS | `/simulations/ws` | simulation:run | interactive runs |
| GET | `/pathology/conditions[/{id}]` | pathology:read | conditions, scenarios |

## Planned contracts

| Area | Endpoints (Phase) |
|---|---|
| Content authoring/review | `POST/PATCH /content/...`, `POST /reviews` (3) |
| Saved views, annotations, bookmarks, notes | `/me/views`, `/me/notes` … (2/8) |
| Clinical cases | `/cases`, `/cases/{id}/attempts` (7) |
| AI assistant | `POST /assistant/messages` (streamed; citations) (7) |
| Education | `/courses`, `/assessments`, `/attempts`, `/analytics` (8) |
| Institutions | `/institutions/{id}/users|groups|reports` (9) |
