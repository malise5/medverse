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
| GET | `/anatomy/systems?model=` | anatomy:read | systems with structure counts; mesh counts for one body (`male`/`female`) or all |
| GET | `/anatomy/index` | anatomy:read | compact columnar index of all structures |
| GET | `/anatomy/structures` | anatomy:read | paginated list (`system`, `with_geometry`) |
| GET | `/anatomy/search?q=` | anatomy:read | ranked fuzzy search over names, synonyms, Latin |
| GET | `/anatomy/hierarchy/roots?system=` | anatomy:read | subtree roots |
| GET | `/anatomy/structures/{id}?audience=` | anatomy:read | full detail |
| GET | `/anatomy/structures/{id}/children` | anatomy:read | part_of children |
| GET | `/anatomy/structures/{id}/circulation` | anatomy:read | inferred artery/vein routes to the heart (mesh → hops); `mode` whole_circulation / organ_route / none |
| GET | `/assets/manifest?model=` | anatomy:read | bundles + mesh→structure map of one body (default `male`) |
| GET | `/assets/models` | anatomy:read | the available bodies with sources, licence and meshes per system |
| GET | `/references`, `/references/{id}` | anatomy:read | citations |
| GET | `/simulations/models[/{id}]` | anatomy:read | model definitions |
| POST | `/simulations/models/{id}/run` | simulation:run | run, persist record |
| WS | `/simulations/ws` | simulation:run | interactive runs |
| GET | `/pathology/conditions[/{id}]` | pathology:read | conditions, scenarios |
| GET | `/learning/modules` | anatomy:read | body-system modules with the caller's quiz progress |
| GET | `/learning/modules/{id}` | anatomy:read | module (three-level overview, organs resolved to 3D, terms, facts) and its questions **without answers** |
| POST | `/learning/questions/{id}/answer` | anatomy:read | `{response}` = option index or selected structure ID; graded server-side (a part of the target counts for identify questions) and recorded per user |
| GET | `/learning/glossary` | anatomy:read | key terms of all modules, sorted |

## Planned contracts

| Area | Endpoints (Phase) |
|---|---|
| Content authoring/review | `POST/PATCH /content/...`, `POST /reviews` (3) |
| Saved views, annotations, bookmarks, notes | `/me/views`, `/me/notes` … (2/8) |
| Clinical cases | `/cases`, `/cases/{id}/attempts` (7) |
| AI assistant | `POST /assistant/messages` (streamed; citations) (7) |
| Education | `/courses`, `/assessments`, `/attempts`, `/analytics` (8) |
| Institutions | `/institutions/{id}/users|groups|reports` (9) |
