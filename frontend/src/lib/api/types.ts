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
  body_model: BodyModel;
}

/** The two complete 3D bodies; each comes from its own anatomical source. */
export type BodyModel = "male" | "female";

export interface BodyModelInfo {
  id: BodyModel;
  label: string;
  description: string;
  sources: string[];
  license: string;
  mesh_count: number;
  systems: { system_id: string; mesh_count: number }[];
}

export interface AssetManifest {
  body_model: BodyModel;
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

/** How one output series drives the 3D view (presentation only; see backend core.py). */
export interface AnimationBinding {
  output: string;
  structure_ids: string[];
  effect: "scale" | "tint" | "glow";
  amplitude: number;
  description: string;
  color: string | null;
  /** "range": min→0, max→1; "magnitude": |v| / max|v| (signed quantities). */
  normalise: "range" | "magnitude";
}

/** y = slope · (x − x_intercept); both name model parameters. */
export interface ReferenceLine {
  label: string;
  slope_parameter: string;
  x_intercept_parameter: string;
  description: string;
}

/** One output series plotted against another (e.g. a pressure–volume loop). */
export interface PhasePlot {
  id: string;
  title: string;
  x: string;
  y: string;
  description: string;
  lines: ReferenceLine[];
  x_min: number | null;
  y_min: number | null;
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
  animations: AnimationBinding[];
  time_unit: "s" | "ms";
  /** Model time units per real second during 3D playback. */
  playback_rate: number;
  phase_plots: PhasePlot[];
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

export interface StructureRef {
  id: string;
  name: string;
}

/** Inferred vessel routes (geometric contact of meshes, not curated anatomy). */
export interface Circulation {
  structure_id: string;
  mode: "whole_circulation" | "organ_route" | "none";
  organ_mesh_ids: string[];
  /** mesh ID -> hops from the heart along the route */
  arteries: Record<string, number>;
  veins: Record<string, number>;
  contact_arteries: StructureRef[];
  contact_veins: StructureRef[];
  unrouted_vessels: number;
  method: string;
}

// --- Learning (body-system modules and quizzes) --------------------------------------

export type LearningLevel = "basic" | "undergraduate" | "clinical";

export interface Progress {
  questions: number;
  answered: number;
  correct: number;
}

export interface ModuleSummary {
  id: string;
  title: string;
  tagline: string;
  translation: TranslationState;
  latin_name: string | null;
  display_order: number;
  structure_count: number;
  mesh_count: number;
  progress: Progress;
}

export interface LevelText {
  basic: string;
  undergraduate: string;
  clinical: string;
}

export interface ModuleOrgan {
  name: string;
  latin: string | null;
  structure_id: string | null;
  role: string;
  in_3d: boolean;
  structure_name: string | null;
  /** Bodies whose 3D model contains this organ. */
  body_models: BodyModel[];
}

export interface KeyTerm {
  term: string;
  latin: string | null;
  origin: string | null;
  definition: string;
}

export interface QuizQuestion {
  id: string;
  kind: "mcq" | "identify";
  level: LearningLevel;
  stem: string;
  options: string[] | null;
  /** Result of the learner's most recent attempt, or null if not attempted. */
  last_correct: boolean | null;
  /** Identify questions: bodies in which the answer can be selected. */
  body_models: BodyModel[];
}

/** How much of an item is translated into the requested language. */
export type TranslationState = "source" | "complete" | "partial" | "missing";

export interface ModuleDetail {
  id: string;
  title: string;
  tagline: string;
  translation: TranslationState;
  latin_name: string | null;
  objectives: string[];
  overview: LevelText;
  functions: { title: string; body: string }[];
  organs: ModuleOrgan[];
  works_with: { system: string; body: string }[];
  key_terms: KeyTerm[];
  facts: { label: string; value: string; note: string | null }[];
  clinical_notes: string[];
  asset_note: string | null;
  questions: QuizQuestion[];
  references: Reference[];
  verification_status: VerificationStatus;
  progress: Progress;
}

export interface AnswerResult {
  correct: boolean;
  correct_option: number | null;
  accepted: { id: string; name: string }[];
  explanation: string;
  references: Reference[];
}

export interface GlossaryEntry extends KeyTerm {
  module_id: string;
  module_title: string;
}
