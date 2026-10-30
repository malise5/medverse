# Scientific validation and content governance

## Evidence classes (spec §18)

| Class | Meaning | Current use |
|---|---|---|
| A | Anatomically validated | none yet (requires expert review) |
| B | Evidence-supported educational explanation | curated content sections, pathology narratives |
| C | Simplified educational simulation | `cv.windkessel3` and its pathology scenarios |
| D | Experimental / unvalidated | none |

## Verification status lifecycle

```
source_imported ─┐
draft ──────────▶ in_review ──▶ expert_reviewed ──▶ deprecated
   ▲                  │
   └──── changes ─────┘
```

- `source_imported`: copied from a cited external dataset (BodyParts3D names/hierarchy).
- `draft`: written in-house from cited references. **All curated content is currently draft.**
- `expert_reviewed`: requires `reviewed_by`, `reviewed_at` (enforced by test); reviewer credentials will be held on the reviewer's user profile (Phase 3).

The UI shows the status on every content section, relationship set and condition.

## Authoring rules

1. Cite a reference from `content/references.json` for every statement; add the reference first.
2. Only add references that can be traced to a real publication (DOI/PMID/ISBN preferred).
   Citation metadata in the initial set should be checked by a librarian before release.
3. State simplifications as such; never present a model output as a prediction for a person.
4. Treatment content is limited to *principles* and defers to current clinical guidelines.
5. Changes go through pull requests; CI runs the integrity tests.

## Phase 1 content inventory

| Item | Count | Status |
|---|---|---|
| Structures (BodyParts3D/FMA) | 1,368 | source_imported |
| PART-OF relationships | 1,367 | source_imported |
| Curated relationships | 18 | draft |
| Curated content sections | 17 (heart, LV, aorta, femoral arteries, femur, lungs, liver) | draft |
| Pathology conditions | 2 (arterial stiffening; raised peripheral resistance) | draft, class B text + class C scenarios |
| References | 8 | citation metadata needs librarian check |

## Required before any public release

- Credentialed anatomist review of all curated content.
- Physiologist review of the Windkessel model card and default parameters.
- Clinician review of the pathology narratives.
- Legal confirmation of the BodyParts3D licence (CC BY 4.0 vs CC BY-SA 2.1 JP in file headers).
