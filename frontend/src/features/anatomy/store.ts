import { create } from "zustand";

import type { AudienceLevel } from "@/lib/api/types";

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

/**
 * View state of the anatomy workspace. Holds identifiers only: anatomical facts come
 * from the API, geometry from asset bundles. Visibility is tracked per mesh because a
 * mesh is the smallest renderable unit; structure-level actions expand to mesh IDs.
 */
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
  viewCommand: null,
  focusCommand: null,
});

let nonce = 0;

export const useWorkspace = create<WorkspaceState>()((set) => ({
  ...initial(),

  select: (id, opts) =>
    set((s) => {
      if (!opts?.additive || !id) return { selectedId: id, multiSelection: [] };
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
  requestView: (preset) => set({ viewCommand: { preset, nonce: ++nonce } }),
  requestFocus: (meshIds) => set({ focusCommand: { meshIds, nonce: ++nonce } }),
  reset: () => set({ ...initial(), viewCommand: { preset: "anterior", nonce: ++nonce } }),
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
