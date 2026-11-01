/**
 * Presentation colours. These are rendering conventions only (not anatomical data);
 * vascular `group` tags come from the asset pipeline, derived from the FMA lineage.
 */
export const SYSTEM_COLORS: Record<string, string> = {
  integumentary: "#d9a98a",
  muscular: "#b4574d",
  cardiovascular: "#c3363d",
  nervous: "#e2c34f",
  respiratory: "#d892a3",
  digestive: "#c98a5c",
  urinary: "#caa64c",
  reproductive: "#b882aa",
  endocrine: "#8fbf6a",
  skeletal: "#e4d8bf",
  lymphatic: "#7fc4b8",
  special_senses: "#9aa6e0",
  unclassified: "#8c939c",
};

const GROUP_COLORS: Record<string, string> = {
  artery: "#c8343a",
  vein: "#3f66c9",
  heart: "#a8343b",
  // schematic meninges (pipeline/meninges), translucent so the layers read as nested
  dura: "#c9b49b",
  arachnoid: "#d9d4ea",
  pia: "#e49a8f",
};

/** Opacity of each meningeal layer; they are shown only on request (head preset). */
export const MENINGES_OPACITY: Record<string, number> = {
  dura: 0.35,
  arachnoid: 0.3,
  pia: 0.55,
};

export function meshColor(systemId: string, group?: string): string {
  return (group && GROUP_COLORS[group]) || SYSTEM_COLORS[systemId] || SYSTEM_COLORS.unclassified;
}

export const SELECT_EMISSIVE = "#2ec4d6";
export const HOVER_EMISSIVE = "#6b7c8f";
export const HIGHLIGHT_EMISSIVE = "#f2a93b";
export const MULTI_EMISSIVE = "#9b7cf0";
