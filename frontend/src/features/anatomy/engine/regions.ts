import { Box3, Vector3 } from "three";

/** Study regions: the whole body, or a region kept above a floor plane below it. */
export type Region = "body" | "head" | "neck";

/**
 * Floor of each region, measured down from the vertex (top of the scene bounds).
 * Head: 0.40 m keeps the whole head plus the upper neck (hyoid, larynx, thyroid gland).
 * Neck: 0.48 m reaches below the clavicles and manubrium, so the root of the neck
 * (subclavian vessels, brachial plexus trunks, apex of the lungs) is included; the head
 * stays visible above it as context.
 */
export const REGION_SPAN_M: Record<Exclude<Region, "body">, number> = { head: 0.4, neck: 0.48 };

/** Camera target (below the vertex) and distance for framing each region. */
const REGION_FRAME: Record<Exclude<Region, "body">, { below: number; dist: number }> = {
  head: { below: 0.13, dist: 0.85 },
  neck: { below: 0.27, dist: 0.8 },
};

/** Height of the region's floor plane, or null for the whole body / empty scene. */
export function regionFloor(region: Region, box: Box3): number | null {
  if (region === "body" || box.isEmpty()) return null;
  return box.max.y - REGION_SPAN_M[region];
}

/** Camera target and distance for a region, from the loaded scene bounds. */
export function regionView(
  region: Region,
  box: Box3,
  fallback: { target: Vector3; dist: number },
): { target: Vector3; dist: number } {
  if (region === "body" || box.isEmpty()) return { target: fallback.target.clone(), dist: fallback.dist };
  const f = REGION_FRAME[region];
  return { target: new Vector3(0, box.max.y - f.below, 0), dist: f.dist };
}

export const REGION_LABELS: Record<Region, string> = { body: "Body", head: "Head", neck: "Neck" };
