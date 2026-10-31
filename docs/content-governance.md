# Scientific validation and content governance

## Evidence classes (spec §18)

| Class | Meaning | Current use |
|---|---|---|
| A | Anatomically validated | none yet (requires expert review) |
| B | Evidence-supported educational explanation | curated content sections, pathology narratives |
| C | Simplified educational simulation | `cv.windkessel3`, `cv.cardiac_cycle`, `resp.single_compartment`, `neuro.hodgkin_huxley`, pathology scenarios |
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
| Curated structures with content | 85 (67 entries; paired organs share one text) across all 12 systems | draft |
| Curated content sections | basic (beginner) overview for every curated structure, plus undergraduate sections (gross anatomy, blood supply, innervation, physiology, clinical anatomy) | draft |
| Body-system learning modules | 12 (`content/learning/modules.json`) | draft, class B |
| Quiz questions | 80 (59 multiple choice, 21 "find it in 3D") | draft |
| Pathology conditions | 2 (arterial stiffening; raised peripheral resistance) | draft, class B text + class C scenarios |
| References | 13 | citation metadata needs librarian check |

## Learning modules and quizzes

- Text is original, written from the cited textbooks; no text, images or assets are copied from
  other educational platforms. External platforms (for example LabXchange's "Interactive Human
  Body") informed only the *structure* of the hub: one module per organ system, systems shown
  one at a time or combined.
- **Terminology:** English Terminologia Anatomica 2 term first, Latin in `latin`; common and
  regional variants are named in the text and loaded as search synonyms (e.g. oesophagus /
  esophagus, suprarenal / adrenal gland, faeces / feces).
- **Units:** SI throughout; where clinical practice differs between countries the conventional
  unit is given alongside (mmHg with kPa, glucose mmol/L with mg/dL, creatinine µmol/L with
  mg/dL). A test rejects imperial units and mmHg without kPa.
- **Levels:** every module overview exists at basic, undergraduate and clinical level; each is
  self-contained. Quiz items are tagged with a level and learners see items up to their level.
- **Validation:** the seed loader validates modules and questions with Pydantic models
  (`app/schemas/learning.py`) and reports unknown structures, systems or references as
  integrity problems. Identify answers must be structures with 3D geometry.
- **Honesty about assets:** organs missing from the 3D source (thyroid, spleen, gonads,
  lymph nodes, ...) are listed with `structure_id: null` and shown as "Not in the 3D model yet".

## Required before any public release

- Credentialed anatomist review of all curated content.
- Physiologist review of the Windkessel model card and default parameters.
- Clinician review of the pathology narratives.
- Legal confirmation of the BodyParts3D licence (CC BY 4.0 vs CC BY-SA 2.1 JP in file headers).
