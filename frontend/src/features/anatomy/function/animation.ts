import type { AnimationBinding } from "@/lib/api/types";

/**
 * Pure helpers mapping model output to 3D presentation. The model has already run on the
 * server; nothing here computes physiology, it only samples and normalises the series.
 */

/** Current playback time in model units, shared by the 3D scene and chart playheads. */
export const playbackClock = {
  t: null as number | null,
  now(): number | null {
    return this.t;
  },
};

/** Linear interpolation of a series at time t (clamped to the series' ends). */
export function sampleAt(time: number[], values: number[], t: number): number {
  const n = time.length;
  if (!n) return Number.NaN;
  if (t <= time[0]) return values[0];
  if (t >= time[n - 1]) return values[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (time[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - time[lo]) / (time[hi] - time[lo] || 1);
  return values[lo] + f * (values[hi] - values[lo]);
}

export interface SeriesRange {
  min: number;
  max: number;
  absMax: number;
}

export function seriesRange(values: number[]): SeriesRange {
  let min = Infinity;
  let max = -Infinity;
  let absMax = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    if (Math.abs(v) > absMax) absMax = Math.abs(v);
  }
  return { min, max, absMax };
}

/** Normalised level n in 0..1 according to the binding's normalisation mode. */
export function normalisedLevel(b: Pick<AnimationBinding, "normalise">, v: number, r: SeriesRange): number {
  if (b.normalise === "magnitude") return r.absMax > 0 ? Math.abs(v) / r.absMax : 0;
  return r.max > r.min ? (v - r.min) / (r.max - r.min) : 0.5;
}

/**
 * Effect strength: for "scale" a size factor in [1 − a, 1 + a]; for "tint"/"glow" a blend
 * weight in [0, a].
 */
export function effectStrength(
  b: Pick<AnimationBinding, "effect" | "amplitude" | "normalise">,
  v: number,
  r: SeriesRange,
): number {
  const n = normalisedLevel(b, v, r);
  return b.effect === "scale" ? 1 + b.amplitude * (2 * n - 1) : b.amplitude * n;
}

/** Advance playback time, looping over [t0, t1]. */
export function advance(t: number, deltaSeconds: number, rate: number, speed: number, t0: number, t1: number) {
  const span = t1 - t0;
  if (span <= 0) return t0;
  return t0 + ((((t - t0 + deltaSeconds * rate * speed) % span) + span) % span);
}
