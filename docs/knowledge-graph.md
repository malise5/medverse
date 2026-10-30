# Anatomical knowledge graph

## Model

- **Nodes**: `structures`, identified by CURIE. `FMA:` = Foundational Model of Anatomy ID
  (imported from BodyParts3D, which assigns each 3D concept its FMA ID). Structures without
  an external ID will use the `MV:` namespace (not yet used).
- **Edges**: `structure_relationships (subject, predicate, object)` with provenance.
- **Text**: `structure_content`, one row per (structure, section, audience level).

### Predicates

| Predicate | Class | Inverse label (shown when the structure is the object) |
|---|---|---|
| part_of | structural | has part (rendered as hierarchy) |
| branch_of | structural | has branch |
| arises_from | structural | gives rise to |
| continuous_with | structural, symmetric | continuous with |
| drains_into | structural | receives drainage from |
| supplied_by / drained_by / innervated_by | structural | supplies / drains / innervates |
| adjacent_to, passes_through, articulates_with, attaches_to, connected_to | structural | … |
| functionally_associated_with | **functional** | functionally associated with |

`relation_class` is derived from the predicate and stored, so queries and UI can always
separate direct anatomical relationships from functional associations.

### Example: femoral artery (implemented)

```
right external iliac artery ──continuous_with──▶ right femoral artery ──continuous_with──▶ right popliteal artery
                                                         ▲
                              right deep femoral artery ─┘ branch_of
right femoral artery ──part_of──▶ … (BodyParts3D PART-OF hierarchy)
```

Not yet modelled for this example (needs curated content + references): femoral triangle
boundaries, femoral nerve/vein relations, surrounding muscles.

## Sources and provenance

| Source | What it supplies | `verification_status` | Licence handling |
|---|---|---|---|
| BodyParts3D 4.0 PART-OF tree | 1,368 concepts, names, 1,367 part_of edges, meshes | `source_imported` | CC BY 4.0 per README (see architecture §7) |
| BodyParts3D IS-A tree | used only by the pipeline to classify systems | — | same |
| MEDVERSE curated (`content/anatomy/curated.json`) | Latin names, synonyms, non-hierarchical relations, content sections | `draft` | in-house; every statement cites a reference |
| FMA | identifiers only (`structure_xrefs`) | — | IDs used as cross-references; FMA content not redistributed |

### Terminology licensing strategy

| Terminology | Plan |
|---|---|
| FMA | Identifier cross-references (CC BY 3.0 ontology); safe to store IDs |
| Terminologia Anatomica 2 | Latin/English terms entered by curators with citation; bulk import only after FIPAT permission check |
| UBERON | CC BY 3.0; candidate for cross-species and developmental IDs |
| UMLS / SNOMED CT | **Not bundled.** Require per-institution/per-country licences. Store codes in `structure_xrefs` only where the deploying tenant holds a licence; never ship the release files |

## Curation rules (enforced by tests where possible)

1. Every content section must cite at least one entry in `content/references.json` (test).
2. Every relation's object and reference must exist (seed integrity check fails otherwise).
3. Content cannot be `expert_reviewed` without `reviewed_by` and `reviewed_at` (test).
4. Never add a reference that cannot be traced to a real publication; prefer DOI/PMID.
5. Do not paraphrase beyond what the reference supports; prefer omission to speculation.

## Query patterns

- Detail: one query for relationships in either direction, one for content, one for meshes.
- Hierarchy: `/anatomy/index` returns a compact columnar index (ids, names, systems, first
  parent) used client-side to build trees without N+1 requests.
- Search: union of trigram matches on names and synonyms, scored by
  `max(similarity, word_similarity) + prefix boost + exact boost`.
