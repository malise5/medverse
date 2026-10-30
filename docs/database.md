# Database schema

PostgreSQL 16, managed by Alembic (`backend/alembic/versions`). Enums are VARCHAR + CHECK.
Extensions: `pg_trgm` (fuzzy search).

## Entity relationship diagram (implemented)

```mermaid
erDiagram
  institutions ||--o{ users : "tenant of"
  users }o--o{ roles : user_roles
  roles }o--o{ permissions : role_permissions
  users ||--o{ auth_sessions : has
  users ||--o{ audit_logs : "actor of"
  users ||--o{ simulation_runs : runs

  anatomical_systems ||--o{ structures : classifies
  structures ||--o{ structure_synonyms : has
  structures ||--o{ structure_xrefs : "cross-ref"
  structures ||--o{ structure_relationships : subject
  structures ||--o{ structure_relationships : object
  structures ||--o{ structure_content : "described by"
  references ||--o{ structure_relationships : cites
  structures ||--o{ structure_meshes : "rendered by"
  meshes ||--o{ structure_meshes : renders
  asset_bundles ||--o{ meshes : contains
  structures ||--o{ meshes : "owns (atomic)"

  conditions ||--o{ condition_structures : affects
  structures ||--o{ condition_structures : "affected by"
  conditions ||--o{ condition_scenarios : "simulated by"

  structures {
    varchar id PK "FMA:7088"
    varchar name
    varchar latin_name
    varchar system_id FK
    varchar laterality
    bool is_compound
    varchar identity_source
    varchar verification_status
  }
  structure_relationships {
    bigint id PK
    varchar subject_id FK
    varchar predicate "part_of, branch_of, supplied_by ..."
    varchar object_id FK
    varchar relation_class "structural | functional"
    varchar source
    varchar verification_status
    varchar reference_id FK
  }
  structure_content {
    bigint id PK
    varchar structure_id FK
    varchar section "overview, blood_supply ..."
    varchar audience "basic..specialist"
    text body
    varchar evidence_class "A-D"
    varchar verification_status
    int version
    varchar reviewed_by
    timestamptz reviewed_at
    json reference_ids
  }
  meshes {
    varchar id PK "FJ1234"
    varchar bundle_id FK
    varchar structure_id FK
    int triangle_count
  }
  auth_sessions {
    uuid id PK
    uuid user_id FK
    varchar token_hash UK "sha256"
    timestamptz expires_at
    timestamptz revoked_at
  }
```

Also: `simulation_runs (model_id, model_version, parameters JSON, summary JSON, duration_ms)`,
`audit_logs (action, actor, target, ip, details JSON)`.

## Indexes

- `structures.name`, `structure_synonyms.synonym`: GIN trigram (`gin_trgm_ops`) for search.
- FKs on relationship subject/object, structure_content.structure_id, meshes.bundle_id/structure_id.
- Unique: `(subject_id, predicate, object_id)`, `(structure_id, section, audience)`, `users.email`, `auth_sessions.token_hash`.

## Planned entities

| Phase | Entities |
|---|---|
| 3 (knowledge) | `content_revisions`, `reviews` (reviewer, credentials, decision), `tissues`, `cells`, landmark/region tables |
| 5 (pathology) | `injuries`, `clinical_findings`, `investigations` |
| 6 (histology/imaging) | `histology_images`, `imaging_studies/series/instances` (de-identified only) |
| 7 (AI) | `ai_interactions` (prompt, retrieved sources, model, user, feedback) |
| 8 (LMS) | `courses`, `modules`, `assessments`, `questions`, `attempts`, `results`, `notes`, `bookmarks`, `flashcards`, `review_schedule` |
| 9 (enterprise) | `departments`, `groups`, `subscriptions`; row-level security on all tenant tables |

## Migrations

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "describe change"
.venv/bin/alembic upgrade head
```

Tests rebuild the `medverse_test` database from migrations on every run, so a broken
migration fails CI.
