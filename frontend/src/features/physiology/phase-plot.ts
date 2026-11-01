import type { PhasePlot } from "@/lib/api/types";

/**
 * Pure geometry for phase plots (one series against another, e.g. a pressure–volume
 * loop). Nothing here computes physiology; it only lays out values the model returned.
 */

export interface Domain {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Bounds of all curves, extended down to the requested minimums (e.g. the origin). */
export function phaseDomain(
  curves: { xs: number[]; ys: number[] }[],
  xMin: number | null = null,
  yMin: number | null = null,
): Domain {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const { xs, ys } of curves) {
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < x0) x0 = xs[i];
      if (xs[i] > x1) x1 = xs[i];
      if (ys[i] < y0) y0 = ys[i];
      if (ys[i] > y1) y1 = ys[i];
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, x1: 1, y0: 0, y1: 1 };
  if (xMin !== null) x0 = Math.min(x0, xMin);
  if (yMin !== null) y0 = Math.min(y0, yMin);
  // Headroom so the curve does not touch the frame.
  const px = (x1 - x0 || 1) * 0.05;
  const py = (y1 - y0 || 1) * 0.05;
  return {
    x0: xMin !== null && x0 === xMin ? x0 : x0 - px,
    x1: x1 + px,
    y0: yMin !== null && y0 === yMin ? y0 : y0 - py,
    y1: y1 + py,
  };
}

/**
 * The visible part of the line y = slope · (x − xIntercept) inside the domain, as two
 * end points ordered by x, or null when the line misses the domain.
 */
export function clipLine(
  slope: number,
  xIntercept: number,
  d: Domain,
): [[number, number], [number, number]] | null {
  const at = (x: number) => slope * (x - xIntercept);
  let xa = d.x0;
  let xb = d.x1;
  if (slope === 0) {
    return at(xa) >= d.y0 && at(xa) <= d.y1 ? [[xa, 0], [xb, 0]] : null;
  }
  // x where the line crosses the bottom and top edges
  const xAtY0 = xIntercept + d.y0 / slope;
  const xAtY1 = xIntercept + d.y1 / slope;
  xa = Math.max(xa, Math.min(xAtY0, xAtY1));
  xb = Math.min(xb, Math.max(xAtY0, xAtY1));
  if (xa >= xb) return null;
  return [
    [xa, at(xa)],
    [xb, at(xb)],
  ];
}

/** Index of the sample nearest to (px, py), measured in screen units by `toScreen`. */
export function nearestIndex(
  xs: number[],
  ys: number[],
  px: number,
  py: number,
  toScreen: (x: number, y: number) => [number, number],
): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const [sx, sy] = toScreen(xs[i], ys[i]);
    const d = (sx - px) ** 2 + (sy - py) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Interpolated (x, y) at time t on a uniformly sampled time base (clamped to the ends). */
export function pointAt(time: number[], xs: number[], ys: number[], t: number): [number, number] {
  const n = time.length;
  if (!n) return [Number.NaN, Number.NaN];
  const span = time[n - 1] - time[0];
  const f = span > 0 ? Math.min(1, Math.max(0, (t - time[0]) / span)) * (n - 1) : 0;
  const i = Math.min(n - 2, Math.floor(f));
  if (i < 0) return [xs[0], ys[0]];
  const w = f - i;
  return [xs[i] + w * (xs[i + 1] - xs[i]), ys[i] + w * (ys[i + 1] - ys[i])];
}

/**
 * Sample indices where direction arrows are drawn, from screen coordinates. Repeated
 * cycles retrace the same path, so evenly spaced samples would stack every arrow on one
 * spot; instead candidates step through the arc length by the golden ratio and are kept
 * only if they are at least `minGap` (screen units) from arrows already placed and the
 * curve actually moves there.
 */
export function arrowIndices(
  sx: number[],
  sy: number[],
  count = 3,
  minGap = 60,
  lookahead = 3,
): number[] {
  const n = sx.length;
  if (n <= lookahead) return [];
  const arc = [0];
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]));
  const total = arc[n - 1];
  if (total === 0) return [];
  const out: number[] = [];
  for (let k = 1; k <= 64 && out.length < count; k++) {
    const target = ((k * 0.6180339887) % 1) * total;
    // first sample at or past the target arc length
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.min(lo, n - 1 - lookahead);
    if (sx[i + lookahead] === sx[i] && sy[i + lookahead] === sy[i]) continue;
    if (out.every((j) => Math.hypot(sx[j] - sx[i], sy[j] - sy[i]) >= minGap)) out.push(i);
  }
  return out;
}

export interface PhaseRun {
  id: string;
  label: string;
  parameters: Record<string, number>;
  series: Record<string, number[]>;
  dashed?: boolean;
}

/**
 * Curves and reference lines for a declared phase plot over one or more runs. The first
 * run's lines are always drawn; a later run's line only when its parameters differ (two
 * identical lines would hide each other).
 */
export function resolvePhasePlot(plot: PhasePlot, runs: PhaseRun[]) {
  const many = runs.length > 1;
  const curves = runs.map((r) => ({
    id: r.id,
    label: r.label,
    xs: r.series[plot.x] ?? [],
    ys: r.series[plot.y] ?? [],
    dashed: r.dashed,
  }));
  const lines = runs.flatMap((r, ri) =>
    plot.lines.flatMap((l) => {
      const slope = r.parameters[l.slope_parameter];
      const x0 = r.parameters[l.x_intercept_parameter];
      if (slope === undefined || x0 === undefined) return [];
      const first = runs[0].parameters;
      if (ri > 0 && first[l.slope_parameter] === slope && first[l.x_intercept_parameter] === x0) return [];
      return [
        {
          id: `${r.id}-${l.label}`,
          label: many && ri > 0 ? `${l.label} (${r.label})` : l.label,
          slope,
          x0,
          curve: ri,
          description: l.description,
        },
      ];
    }),
  );
  return { curves, lines };
}
