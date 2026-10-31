import { create } from "zustand";

import type { AnimationBinding, AudienceLevel } from "@/lib/api/types";

export type ViewPreset =
  | "anterior"
  | "posterior"
  | "left"
  | "right"
  | "superior"
  | "inferior"
  | "oblique";

export type ClipAxis = "none" | "sagittal" | "coronal" | "transverse";

export interface ClipState {
  axis: ClipAxis;
  /** Normalised position across the scene bounds, 0..1. */
  position: number;
  flip: boolean;
}

export interface Hover {
  meshId: string;
  structureId: string;
  x: number;
  y: number;
}

/** A model run being played back on the 3D anatomy ("function" mode). */
export interface Playback {
  modelId: string;
  modelName: string;
  time: number[];
  series: Record<string, number[]>;
  bindings: AnimationBinding[];
  /** Model time units per real second at speed 1. */
  rate: number;
  timeUnit: "s" | "ms";
  parameters: Record<string, number>;
  metrics: Record<string, number>;
  warnings: string[];
}

/** A direct part of the shown structure, coloured and labelled in 3D. */
export interface PartView {
  id: string;
  name: string;
  color: string;
  meshIds: string[];
}

/** Inferred vessel routes; values are hops from the heart along the route. */
export interface CirculationView {
  structureId: string;
  mode: "whole_circulation" | "organ_route";
  arteries: Map<string, number>;
  veins: Map<string, number>;
  maxArteryHop: number;
  maxVeinHop: number;
}

/**
 * View state of the anatomy workspace. Holds identifiers only: anatomical facts come
 * from the API, geometry from asset bundles. Visibility is tracked per mesh because a
 * mesh is the smallest renderable unit; structure-level actions expand to mesh IDs.
 */
export interface IdentifyQuiz {
  questionId: string;
  moduleId: string;
  stem: string;
  /** Set once the learner has checked an answer; names stay hidden until then. */
  answered: boolean;
}

export interface WorkspaceState {
  selectedId: string | null;
  /** Additional structures selected with Shift/Ctrl for comparison. */
  multiSelection: string[];
  /** Mesh IDs emphasised by an external context (e.g. pathology affected structures). */
  highlightedMeshes: Set<string>;
  hover: Hover | null;

  systemVisible: Record<string, boolean>;
  systemOpacity: Record<string, number>;
  hiddenMeshes: Set<string>;
  isolatedMeshes: Set<string> | null;

  /** Systems whose dissection depth is below this value are removed. */
  dissectionDepth: number;
  ghostRemovedLayer: boolean;
  /** Draw the selection over structures that occlude it (deep structures, e.g. heart). */
  xraySelection: boolean;
  clip: ClipState;
  audience: AudienceLevel;
  /** Fade everything except the selection (and structures driven by playback). */
  spotlight: boolean;
  playback: Playback | null;
  playing: boolean;
  speed: number;
  /** Start function playback automatically when a structure is chosen from search. */
  autoPlay: boolean;
  /** Body map: colour/label the shown structure's parts and show its vessel routes. */
  showParts: boolean;
  showCirculation: boolean;
  flowAnimation: boolean;
  parts: PartView[];
  circulation: CirculationView | null;
  /** A whole body system shown in spotlight (chosen from search). */
  systemFocus: string | null;
  /** "Find it in 3D" quiz question in progress (from the learning modules). */
  quiz: IdentifyQuiz | null;

  /** Monotonic command channels consumed by the 3D engine. */
  viewCommand: { preset: ViewPreset; nonce: number } | null;
  focusCommand: { meshIds: string[]; nonce: number } | null;

  select: (id: string | null, opts?: { additive?: boolean }) => void;
  setHover: (hover: Hover | null) => void;
  setHighlighted: (meshIds: Iterable<string>) => void;
  setSystemVisible: (systemId: string, visible: boolean) => void;
  setSystemOpacity: (systemId: string, opacity: number) => void;
  hideMeshes: (meshIds: string[]) => void;
  isolateMeshes: (meshIds: string[]) => void;
  showAll: () => void;
  setDissectionDepth: (depth: number) => void;
  setGhostRemovedLayer: (on: boolean) => void;
  setXraySelection: (on: boolean) => void;
  setClip: (clip: Partial<ClipState>) => void;
  setAudience: (audience: AudienceLevel) => void;
  setSpotlight: (on: boolean) => void;
  startPlayback: (playback: Playback) => void;
  stopPlayback: () => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setAutoPlay: (on: boolean) => void;
  setShowParts: (on: boolean) => void;
  setShowCirculation: (on: boolean) => void;
  setFlowAnimation: (on: boolean) => void;
  setParts: (parts: PartView[]) => void;
  setCirculation: (circulation: CirculationView | null) => void;
  setSystemFocus: (systemId: string | null) => void;
  setQuiz: (quiz: IdentifyQuiz | null) => void;
  requestView: (preset: ViewPreset) => void;
  requestFocus: (meshIds: string[]) => void;
  reset: () => void;
}

export const DEFAULT_DISSECTION_DEPTH = 10; // skin removed (ghosted), muscles exposed

const initial = () => ({
  selectedId: null,
  multiSelection: [] as string[],
  highlightedMeshes: new Set<string>(),
  hover: null,
  systemVisible: {} as Record<string, boolean>,
  systemOpacity: {} as Record<string, number>,
  hiddenMeshes: new Set<string>(),
  isolatedMeshes: null,
  dissectionDepth: DEFAULT_DISSECTION_DEPTH,
  ghostRemovedLayer: true,
  xraySelection: true,
  clip: { axis: "none" as ClipAxis, position: 0.5, flip: false },
  audience: "undergraduate" as AudienceLevel,
  spotlight: false,
  playback: null as Playback | null,
  playing: false,
  speed: 1,
  autoPlay: true,
  showParts: true,
  showCirculation: true,
  flowAnimation: true,
  parts: [] as PartView[],
  circulation: null as CirculationView | null,
  systemFocus: null as string | null,
  quiz: null as IdentifyQuiz | null,
  viewCommand: null,
  focusCommand: null,
});

let nonce = 0;

export const useWorkspace = create<WorkspaceState>()((set) => ({
  ...initial(),

  select: (id, opts) =>
    set((s) => {
      if (!opts?.additive || !id) return { selectedId: id, multiSelection: [], systemFocus: id ? null : s.systemFocus };
      if (s.selectedId === null) return { selectedId: id };
      const others = new Set(s.multiSelection);
      if (id === s.selectedId) return {};
      if (others.has(id)) others.delete(id);
      else others.add(id);
      return { multiSelection: [...others] };
    }),
  setHover: (hover) => set({ hover }),
  setHighlighted: (meshIds) => set({ highlightedMeshes: new Set(meshIds) }),
  setSystemVisible: (systemId, visible) =>
    set((s) => ({ systemVisible: { ...s.systemVisible, [systemId]: visible } })),
  setSystemOpacity: (systemId, opacity) =>
    set((s) => ({ systemOpacity: { ...s.systemOpacity, [systemId]: opacity } })),
  hideMeshes: (meshIds) =>
    set((s) => ({ hiddenMeshes: new Set([...s.hiddenMeshes, ...meshIds]) })),
  isolateMeshes: (meshIds) => set({ isolatedMeshes: new Set(meshIds), hiddenMeshes: new Set() }),
  showAll: () => set({ hiddenMeshes: new Set(), isolatedMeshes: null }),
  setDissectionDepth: (dissectionDepth) => set({ dissectionDepth }),
  setGhostRemovedLayer: (ghostRemovedLayer) => set({ ghostRemovedLayer }),
  setXraySelection: (xraySelection) => set({ xraySelection }),
  setClip: (clip) => set((s) => ({ clip: { ...s.clip, ...clip } })),
  setAudience: (audience) => set({ audience }),
  setSpotlight: (spotlight) => set({ spotlight }),
  startPlayback: (playback) => set({ playback, playing: true }),
  stopPlayback: () => set({ playback: null, playing: false }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setAutoPlay: (autoPlay) => set({ autoPlay }),
  setShowParts: (showParts) => set({ showParts }),
  setShowCirculation: (showCirculation) => set({ showCirculation }),
  setFlowAnimation: (flowAnimation) => set({ flowAnimation }),
  setParts: (parts) => set({ parts }),
  setCirculation: (circulation) => set({ circulation }),
  setSystemFocus: (systemFocus) => set({ systemFocus }),
  setQuiz: (quiz) => set({ quiz }),
  requestView: (preset) => set({ viewCommand: { preset, nonce: ++nonce } }),
  requestFocus: (meshIds) => set({ focusCommand: { meshIds, nonce: ++nonce } }),
  reset: () => set((s) => ({ ...initial(), autoPlay: s.autoPlay, viewCommand: { preset: "anterior", nonce: ++nonce } })),
}));

/** Pure visibility rule shared by the renderer and tests. */
export interface MeshVisibilityInput {
  meshId: string;
  systemId: string;
  systemDepth: number;
  removedGhostDepth: number | null;
}

export type MeshVisibility = "visible" | "ghost" | "hidden";

export function meshVisibility(
  s: Pick<
    WorkspaceState,
    "systemVisible" | "hiddenMeshes" | "isolatedMeshes" | "dissectionDepth" | "ghostRemovedLayer"
  >,
  m: MeshVisibilityInput,
): MeshVisibility {
  if (s.isolatedMeshes) return s.isolatedMeshes.has(m.meshId) ? "visible" : "hidden";
  if (s.systemVisible[m.systemId] === false || s.hiddenMeshes.has(m.meshId)) return "hidden";
  if (m.systemDepth < s.dissectionDepth) {
    return s.ghostRemovedLayer && m.systemDepth === m.removedGhostDepth ? "ghost" : "hidden";
  }
  return "visible";
}

/** The deepest removed layer is the one rendered as a ghost for spatial context. */
export function ghostDepth(depths: number[], dissectionDepth: number): number | null {
  const removed = depths.filter((d) => d < dissectionDepth);
  return removed.length ? Math.max(...removed) : null;
}

/**
 * Spotlight rule: with a selection and spotlight on, visible meshes outside the focus set
 * are drawn as faint context ghosts. Returns the visibility unchanged otherwise.
 */
export function spotlightVisibility(
  vis: MeshVisibility,
  meshId: string,
  focus: Set<string> | null,
): MeshVisibility {
  if (!focus || vis !== "visible") return vis;
  return focus.has(meshId) ? "visible" : "ghost";
}

/**
 * Flow-wave level (0..1) for a vessel `hop` contacts from the heart. The wave leaves the
 * heart along arteries and returns to it along veins; `phase` advances in hops.
 */
export function flowLevel(hop: number, maxHop: number, phase: number, towardHeart: boolean, width = 4): number {
  const period = maxHop + width * 2;
  const x = towardHeart ? maxHop - hop : hop;
  const d = (((phase - x) % period) + period) % period;
  return d < width ? 1 - d / width : 0;
}
