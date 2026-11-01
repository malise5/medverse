import {
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Plane,
} from "three";

import { HIGHLIGHT_EMISSIVE, HOVER_EMISSIVE, MULTI_EMISSIVE, SELECT_EMISSIVE } from "./palette";

export type MeshState = "normal" | "hovered" | "selected" | "multi" | "highlighted";

/**
 * Surface finish per tissue class: matte bone, moist visceral organs with a thin
 * clearcoat, smoother vessels and eyes. Presentation only; colours stay the system
 * palette so the view remains a legend-readable diagram rather than a photograph.
 */
interface Finish {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
}
const MATTE: Finish = { roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0, sheen: 0 };
const VISCERA: Finish = { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0 };
const FINISH: Record<string, Finish> = {
  skeletal: MATTE,
  integumentary: { roughness: 0.7, clearcoat: 0, clearcoatRoughness: 0, sheen: 0.4 },
  muscular: { roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3 },
  cardiovascular: { roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0 },
  nervous: { roughness: 0.58, clearcoat: 0.1, clearcoatRoughness: 0.6, sheen: 0 },
  special_senses: { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0 },
};
export const finishFor = (systemId: string): Finish => FINISH[systemId] ?? VISCERA;

/** Fresnel rim shader for the x-ray selection overlay; honours clipping planes. */
const XRAY_VERTEX = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mvPosition.xyz);
}`;
const XRAY_FRAGMENT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uBase;
uniform float uRim;
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  #include <clipping_planes_fragment>
  float facing = abs(dot(normalize(vNormalV), normalize(vViewV)));
  float rim = pow(1.0 - facing, 2.2);
  gl_FragColor = vec4(uColor, clamp(uBase + uRim * rim, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

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

  get(color: string, state: MeshState, opacity: number, systemId = ""): MeshStandardMaterial {
    const o = Math.round(opacity * 20) / 20;
    const f = finishFor(systemId);
    const key = `${color}|${state}|${o}|${f.roughness}|${f.clearcoat}|${f.sheen}`;
    let m = this.cache.get(key);
    if (!m) {
      const common = {
        color: new Color(color),
        roughness: f.roughness,
        metalness: 0,
        side: o < 1 ? FrontSide : DoubleSide,
        transparent: o < 1,
        opacity: o,
        depthWrite: o >= 1,
        clippingPlanes: this.clippingPlanes,
        clipShadows: true,
        envMapIntensity: 0.75,
      };
      m =
        f.clearcoat > 0 || f.sheen > 0
          ? new MeshPhysicalMaterial({
              ...common,
              clearcoat: f.clearcoat,
              clearcoatRoughness: f.clearcoatRoughness,
              sheen: f.sheen,
              sheenRoughness: 0.8,
              sheenColor: new Color(color).lerp(new Color("#ffffff"), 0.4),
            })
          : new MeshStandardMaterial(common);
      const emissive = {
        normal: null,
        hovered: HOVER_EMISSIVE,
        selected: SELECT_EMISSIVE,
        multi: MULTI_EMISSIVE,
        highlighted: HIGHLIGHT_EMISSIVE,
      }[state];
      if (emissive) {
        m.emissive = new Color(emissive);
        // Soft tints keep the surface shading readable (the x-ray rim marks selection).
        // Highlights (pathways, pathology) must read clearly against translucent layers.
        m.emissiveIntensity = state === "hovered" ? 0.2 : state === "selected" ? 0.28 : state === "highlighted" ? 0.9 : 0.45;
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
  xray(): ShaderMaterial {
    let m = this.cache.get("xray") as unknown as ShaderMaterial | undefined;
    if (!m) {
      m = new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color("#7fe6f0") },
          uBase: { value: 0.07 },
          uRim: { value: 0.85 },
        },
        vertexShader: XRAY_VERTEX,
        fragmentShader: XRAY_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        clipping: true,
        clippingPlanes: this.clippingPlanes,
      });
      this.cache.set("xray", m as unknown as MeshStandardMaterial);
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

  /** Spotlight context: like a ghost but a little stronger, so surroundings stay legible. */
  context(): MeshStandardMaterial {
    let m = this.cache.get("context");
    if (!m) {
      m = this.ghost().clone();
      m.opacity = 0.12;
      m.clippingPlanes = this.clippingPlanes;
      this.cache.set("context", m);
    }
    return m;
  }

  /**
   * Material owned by a playback binding; its colour/emissive change every frame, so it is
   * keyed by the caller and never shared with static meshes.
   */
  animated(key: string, color: string, opacity: number): MeshStandardMaterial {
    const k = `anim|${key}|${color}|${opacity}`;
    let m = this.cache.get(k);
    if (!m) {
      m = this.get(color, "normal", opacity).clone();
      m.clippingPlanes = this.clippingPlanes;
      m.userData.baseColor = new Color(color);
      this.cache.set(k, m);
    }
    return m;
  }

  disposeAnimated() {
    for (const [k, m] of this.cache) {
      if (k.startsWith("anim|")) {
        m.dispose();
        this.cache.delete(k);
      }
    }
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}
