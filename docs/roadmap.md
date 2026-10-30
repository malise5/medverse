# Roadmap and development checklist

Legend: ✅ done and tested · 🟡 partial · ⬜ not started

## Phase 1: Foundation (current milestone)

| Item | Status | Notes |
|---|---|---|
| Repository structure, docs | ✅ | `docs/` |
| Docker Compose (Postgres 16 + pg_trgm, Redis 7) | ✅ | app containers: backend image verified; frontend image not yet built in CI |
| CI workflow (lint, types, tests, build, audit) | 🟡 | written; not yet run on a remote runner |
| FastAPI app, structured errors, OpenAPI | ✅ | |
| PostgreSQL schema + Alembic | ✅ | migration exercised by every test run |
| Authentication (register/login/logout/me), sessions, rate limit, audit | ✅ | |
| RBAC (6 roles, 10 permissions) | ✅ | tenant isolation not yet enforced |
| Anatomical knowledge graph model | ✅ | |
| Asset pipeline (BodyParts3D → GLB) | ✅ | 1,258 meshes, 12 bundles, 13 MB |
| Seed loader with integrity checks | ✅ | |
| Search (names, synonyms, Latin; fuzzy) | ✅ | |
| Dashboard | ✅ | |
| 3D workspace: selectable structures, systems, layers, opacity, dissection, section planes, views, focus/isolate/hide, multi-select, screenshot, hover labels | ✅ | verified in headless Chrome (SwiftShader) |
| Information panel (content, relations, clinical, sources, audience level) | ✅ | content exists for 9 structures only |
| Physiology: 3-element Windkessel with model card | ✅ | 14 scientific tests |
| Pathology: 2 educational scenarios with healthy-vs-scenario comparison | ✅ | |
| Responsive layout (sheets on < 1024 px) | 🟡 | implemented; not tested on real devices |
| Frontend tests (Vitest) | 🟡 | unit/component; no Playwright E2E in repo yet |

## Phase 2: Anatomy engine depth

⬜ Saved views and annotations · ⬜ distance measurement (scene is metric) · ⬜ capped
cross-sections (stencil) · ⬜ keyboard navigation of the 3D scene · ⬜ LOD tier and
low-bandwidth mode · ⬜ IS-A asset set (cranial nerves) · ⬜ female and peripheral-nerve
assets (licensed source required) · ⬜ Playwright E2E incl. 3D selection.

## Phase 3: Knowledge database

⬜ Authoring UI + review workflow (content_expert) · ⬜ revisions/version history ·
⬜ curated relationships for major vessels, nerves, muscles (origins/insertions/actions) ·
⬜ TA2 terms · ⬜ embryology/variations/histology sections · ⬜ i18n of terms.

## Phase 4: Physiology

⬜ Cardiac cycle (elastance ventricle) · ⬜ action potential (Hodgkin–Huxley) ·
⬜ respiratory mechanics & gas exchange · ⬜ renal filtration · ⬜ glucose–insulin ·
⬜ visual mappings driving 3D (e.g. pressure → aortic colour) · ⬜ Celery for heavy models.

## Phase 5: Pathology and injury

⬜ Condition catalogue per spec (trauma, CV, respiratory, neuro, other) · ⬜ anatomical
change visualisation (morph targets, overlays) · ⬜ timelines only where evidence supports.

## Phase 6: Histology and imaging

⬜ Virtual microscope (tiled images, licensed datasets) · ⬜ DICOM viewer (Cornerstone),
de-identification pipeline, window/level, 3D correlation.

## Phase 7: AI assistant and clinical cases

⬜ RAG over reviewed content only, citations required, uncertainty flags · ⬜ flashcards and
quiz generation with review · ⬜ fictional virtual patients with decision feedback.

## Phase 8: Learning management

⬜ Courses, pathways, spaced repetition, assessments (incl. 3D identification), analytics,
curriculum mapping, notes, bookmarks.

## Phase 9: Enterprise and international

⬜ Multi-tenancy with RLS · ⬜ MFA · ⬜ subscriptions · ⬜ localisation · ⬜ CDN/object storage ·
⬜ observability (OpenTelemetry, centralised logs) · ⬜ backups/DR drills · ⬜ IaC · ⬜ load and
security testing · ⬜ WCAG audit.
