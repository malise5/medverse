/** Wire types mirroring the FastAPI schemas (see /api/v1/openapi.json). */

export type VerificationStatus =
  | "source_imported"
  | "draft"
  | "in_review"
  | "expert_reviewed"
  | "deprecated";
export type EvidenceClass = "A" | "B" | "C" | "D";
export type AudienceLevel = "basic" | "undergraduate" | "clinical" | "postgraduate" | "specialist";
export type Laterality = "left" | "right" | "unpaired" | "unspecified";

export interface User {
  id: string;
  email: string;
  full_name: string;
  educational_level: AudienceLevel;
  roles: string[];
  permissions: string[];
  institution_id: string | null;
  mfa_enabled: boolean;
}

export interface AnatomicalSystem {
  id: string;
  name: string;
  fma_id: string | null;
  description: string | null;
  display_order: number;
  dissection_depth: number;
  structure_count: number;
  mesh_count: number;
}

export interface StructureSummary {
  id: string;
  name: string;
  system_id: string | null;
  laterality: Laterality;
  is_compound: boolean;
  has_geometry: boolean;
}

export interface SearchHit extends StructureSummary {
  score: number;
  matched_text: string;
}

export interface StructureIndex {
  ids: string[];
  names: string[];
  systems: (string | null)[];
  parents: number[];
}

export interface Reference {
  id: string;
  citation: string;
  kind: string;
  year: number | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
}

export interface ContentSection {
  section: string;
  audience: AudienceLevel;
  body: string;
  evidence_class: EvidenceClass;
  verification_status: VerificationStatus;
  version: number;
  author: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reference_ids: string[];
}

export interface Relation {
  predicate: string;
  label: string;
  direction: "outgoing" | "incoming";
  relation_class: "structural" | "functional";
  target: StructureSummary;
  source: string;
  verification_status: VerificationStatus;
  notes: string | null;
}

export interface StructureDetail extends StructureSummary {
  latin_name: string | null;
  region: string | null;
  identity_source: string;
  verification_status: VerificationStatus;
  system_name: string | null;
  synonyms: { synonym: string; kind: string; source: string }[];
  xrefs: { source: string; code: string; license: string | null }[];
  parents: StructureSummary[];
  children: StructureSummary[];
  mesh_ids: string[];
  content: ContentSection[];
  relations: Relation[];
  conditions: { id: string; name: string; category: string; role: string }[];
  simulations: { model_id: string; name: string }[];
  references: Reference[];
}

export interface AssetBundle {
  id: string;
  uri: string;
  system_id: string | null;
  source_dataset: string;
  license: string;
  attribution: string;
  version: string;
  sha256: string;
  byte_size: number;
  mesh_count: number;
  is_placeholder: boolean;
}

export interface AssetManifest {
  bundles: AssetBundle[];
  meshes: Record<string, [bundleId: string, structureId: string]>;
}

export interface ParameterSpec {
  id: string;
  label: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  description: string;
  step: number | null;
}

export interface OutputSpec {
  id: string;
  label: string;
  unit: string;
  description: string;
}

export interface ModelDefinition {
  id: string;
  version: string;
  name: string;
  domain: string;
  summary: string;
  purpose: string;
  equations: string[];
  solver: string;
  initial_conditions: string;
  assumptions: string[];
  limitations: string[];
  validation: string[];
  evidence_class: EvidenceClass;
  reference_ids: string[];
  parameters: ParameterSpec[];
  series: OutputSpec[];
  metrics: OutputSpec[];
  linked_structure_ids: string[];
  visual_mappings: Record<string, string[]>;
  disclaimer: string;
}

export interface RunResult {
  run_id: string | null;
  model_id: string;
  model_version: string;
  scenario_id: string | null;
  parameters: Record<string, number>;
  time: number[];
  series: Record<string, number[]>;
  metrics: Record<string, number>;
  warnings: string[];
  disclaimer: string;
}

export interface ConditionSummary {
  id: string;
  name: string;
  category: string;
  summary: string;
  evidence_class: EvidenceClass;
  verification_status: VerificationStatus;
}

export interface Scenario {
  id: string;
  model_id: string;
  title: string;
  description: string;
  parameter_overrides: Record<string, number>;
  assumptions: string[];
}

export interface ConditionDetail extends ConditionSummary {
  mechanism: string;
  anatomical_changes: string;
  physiological_consequences: string;
  clinical_manifestations: string | null;
  complications: string | null;
  investigations: string | null;
  management_principles: string | null;
  affected_structures: { structure_id: string; name: string; role: string }[];
  scenarios: Scenario[];
  references: Reference[];
}
