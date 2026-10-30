# MEDVERSE

Interactive 3D human anatomy, physiology and pathology for medical education.

> **Educational use only.** MEDVERSE is not a diagnostic or treatment tool. Curated content
> is marked *draft* until reviewed by a credentialed expert; simulations are simplified
> educational models.

**Status:** Phase 1 (foundation) of 9. See [docs/roadmap.md](docs/roadmap.md) for what works
and what does not.

## What works today

- Sign-up and sign-in with server-side sessions, role-based permissions, rate limiting and an audit log.
- A 3D workspace showing **1,258 independently selectable meshes** across 12 body systems
  (BodyParts3D 4.0, FMA-identified, adult male). It supports search, a hierarchy tree,
  per-system visibility and opacity, progressive dissection, sagittal/coronal/transverse
  section planes, view presets, focus/isolate/hide, multi-select, screenshots, and seeing
  the selection through overlying structures.
- An information panel with cited, draft-status content (9 structures so far),
  navigable relationships, linked pathology and simulations, and provenance.
- A Physiology Lab running a documented and tested three-element Windkessel model.
- A Pathology Lab comparing healthy and abnormal states for arterial stiffening and for
  raised peripheral resistance.

## Quick start

Prerequisites: Docker, Python ≥ 3.12, Node 22.

```bash
docker compose up -d db redis

cd backend
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed --demo-users     # loads content/, creates demo accounts
.venv/bin/uvicorn app.main:app --reload --port 8000

cd ../frontend
npm ci
npm run dev                                   # http://localhost:3000
```

Demo accounts (development only; the seeder refuses to create them in production):
`student.demo@example.org`, `doctor.demo@example.org`, `lecturer.demo@example.org`,
`institution.admin.demo@example.org`, `content.expert.demo@example.org`,
`platform.admin.demo@example.org`. Password: `Medverse-Demo-2026!`

API docs: http://localhost:8000/api/v1/docs

## Tests

```bash
cd backend && .venv/bin/pytest && .venv/bin/ruff check app tests ../pipeline   # 57 tests (uses medverse_test DB)
cd frontend && npm test && npm run lint && npm run typecheck && npm run build   # 15 tests
```

## Repository

| Path | Contents |
|---|---|
| `backend/` | FastAPI service: auth, knowledge graph, simulation engine, pathology |
| `frontend/` | Next.js 16 app: shell, 3D anatomy engine, labs |
| `pipeline/` | BodyParts3D → knowledge records + GLB bundles |
| `content/` | Version-controlled references, systems, curated anatomy, pathology, generated data |
| `docs/` | [Architecture](docs/architecture.md) · [Database](docs/database.md) · [Knowledge graph](docs/knowledge-graph.md) · [3D assets](docs/3d-asset-pipeline.md) · [Simulation](docs/simulation-engine.md) · [API](docs/api.md) · [Security](docs/security.md) · [Governance](docs/content-governance.md) · [Roadmap](docs/roadmap.md) |

## Attribution

3D anatomical data: *BodyParts3D, © The Database Center for Life Science licensed under CC
Attribution 4.0 International*. See
[frontend/public/assets/anatomy/bp3d-4.0/LICENSE.md](frontend/public/assets/anatomy/bp3d-4.0/LICENSE.md)
for a licence note that needs resolving before commercial release.
