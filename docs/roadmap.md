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
| Function playback: search → focus + spotlight → model-driven 3D animation (heart, lungs, brain/spinal cord, aorta) | ✅ | 3 new class C models with scientific tests; verified in headless Chrome |
| Body-systems learning hub: 12 modules at three levels (beginner / intermediate / advanced), TA2 terminology, SI units, 80 quiz questions incl. "find it in 3D", per-user progress, glossary, layer builder | ✅ | content is draft pending expert review; verified in headless Chrome at desktop and phone widths |
| Male and female 3D bodies with switcher; shared knowledge graph; studio lighting, tissue finishes, rim-lit selection; smoothed male meshes | ✅ | female body from HRA Visible Human Female (CC BY 4.0); verified in headless Chrome |
| Head milestone: head study mode (clip, framing, layer presets), BodyParts3D IS-A head meshes, SPL head-and-neck and inner-ear atlases registered to the skull, Z-Anatomy head supplement (CC BY-SA 4.0) for both bodies, curated head content (location, function, relations, clinical); living processes (neural signalling, neuron growth, blood flow, brain pathways) | 🟡 | see docs/3d-asset-pipeline.md "Head coverage" for what is still missing; female skull, muscles, nerves and vessels are fitted from a male-derived model (labelled) |
| Neck milestone: Neck study mode (clip to the clavicles, framing, 9 layer presets), Z-Anatomy neck structures for both bodies (infrahyoid and deep neck muscles, brachial plexus trunks, sympathetic trunk, neck veins, cervical lymph nodes, ligaments), female neck fit blended with the head fit, curated neck content, neck pathways (swallowing, baroreceptor reflex, breathing in, speaking) | 🟡 | see docs/3d-asset-pipeline.md "Neck"; cervical plexus, phrenic and recurrent laryngeal nerves have no open mesh source |
| Responsive layout (sheets on < 1024 px) | 🟡 | implemented; not tested on real devices |
| Frontend tests (Vitest) | 🟡 | unit/component; no Playwright E2E in repo yet |

## Phase 2: Anatomy engine depth

⬜ Saved views and annotations · ⬜ distance measurement (scene is metric) · ⬜ capped
cross-sections (stencil) · ⬜ keyboard navigation of the 3D scene · ⬜ LOD tier and
low-bandwidth mode · ⬜ IS-A asset set (cranial nerves) · ✅ female body (Human Reference
Atlas, Visible Human Female; muscles, endocrine glands and upper skeleton not in that source) · ⬜ peripheral-nerve assets · ⬜ Playwright E2E incl. 3D selection.

## Phase 3: Knowledge database

⬜ Authoring UI + review workflow (content_expert) · ⬜ revisions/version history ·
⬜ curated relationships for major vessels, nerves, muscles (origins/insertions/actions) ·
⬜ TA2 terms · ⬜ embryology/variations/histology sections · ⬜ i18n of terms.

## Phase 4: Physiology

✅ Cardiac cycle (elastance ventricle) · ✅ action potential (Hodgkin–Huxley, patch) ·
✅ respiratory mechanics (single compartment) · ⬜ gas exchange · ⬜ renal filtration · ⬜ glucose–insulin ·
✅ visual mappings driving 3D (scale/tint/glow bindings) · ✅ PV-loop chart (generic phase plots with ESPVR/EDPVR) · ⬜ propagation along nerves, right heart · ⬜ Celery for heavy models.

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

✅ Body-system modules with quizzes, 3D identification questions and per-user progress (Phase 1 hub) ·
⬜ courses, pathways, spaced repetition, timed assessments, analytics, curriculum mapping, notes, bookmarks.

## Phase 9: Enterprise and international

⬜ Multi-tenancy with RLS · ⬜ MFA · ⬜ subscriptions · ⬜ localisation · ⬜ CDN/object storage ·
⬜ observability (OpenTelemetry, centralised logs) · ⬜ backups/DR drills · ⬜ IaC · ⬜ load and
security testing · ⬜ WCAG audit.
