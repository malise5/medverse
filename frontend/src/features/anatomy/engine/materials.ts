import { Color, DoubleSide, FrontSide, MeshStandardMaterial, type Plane } from "three";

import { HIGHLIGHT_EMISSIVE, HOVER_EMISSIVE, MULTI_EMISSIVE, SELECT_EMISSIVE } from "./palette";

export type MeshState = "normal" | "hovered" | "selected" | "multi" | "highlighted";

/**
 * Shares materials between meshes with the same appearance. With ~1,300 meshes, one
 * material per mesh would multiply GPU program state for no visual gain.
 *
 * Transparency policy (spec: avoid misleading overlap):
 *  - opaque structures write depth normally;
 *  - user-dimmed structures are transparent but do not write depth, so they never hide
 *    structures behind them, and they are rendered after opaque geometry;
 *  - "ghost" layers (removed during dissection) are very faint, unlit-looking context
 *    shells that never write depth and are not pickable.
 */
export class MaterialCache {
  private cache = new Map<string, MeshStandardMaterial>();

  constructor(private readonly clippingPlanes: Plane[]) {}

  get(color: string, state: MeshState, opacity: number): MeshStandardMaterial {
    const o = Math.round(opacity * 20) / 20;
    const key = `${color}|${state}|${o}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.62,
        metalness: 0.02,
        side: o < 1 ? FrontSide : DoubleSide,
        transparent: o < 1,
        opacity: o,
        depthWrite: o >= 1,
        clippingPlanes: this.clippingPlanes,
        clipShadows: true,
      });
      const emissive = {
        normal: null,
        hovered: HOVER_EMISSIVE,
        selected: SELECT_EMISSIVE,
        multi: MULTI_EMISSIVE,
        highlighted: HIGHLIGHT_EMISSIVE,
      }[state];
      if (emissive) {
        m.emissive = new Color(emissive);
        m.emissiveIntensity = state === "hovered" ? 0.35 : 0.55;
      }
      this.cache.set(key, m);
    }
    return m;
  }

  /**
   * Selection drawn through occluders (depthTest off, rendered last). Used for deep
   * structures such as the heart; slightly translucent so the occluding anatomy stays
   * perceptible and the overlay is not mistaken for the true depth order.
   */
  xray(): MeshStandardMaterial {
    let m = this.cache.get("xray");
    if (!m) {
      m = this.get(SELECT_EMISSIVE, "selected", 1).clone();
      m.color = new Color("#7fdde8");
      m.transparent = true;
      m.opacity = 0.55;
      m.depthTest = false;
      m.depthWrite = false;
      m.clippingPlanes = this.clippingPlanes;
      this.cache.set("xray", m);
    }
    return m;
  }

  ghost(): MeshStandardMaterial {
    let m = this.cache.get("ghost");
    if (!m) {
      m = new MeshStandardMaterial({
        color: new Color("#c9d6e3"),
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: FrontSide,
        clippingPlanes: this.clippingPlanes,
      });
      this.cache.set("ghost", m);
    }
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}
