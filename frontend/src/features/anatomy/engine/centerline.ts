/**
 * Approximate centre line of a tubular mesh (a vessel segment): vertices are projected
 * onto their principal axis, binned along it, and each bin's centroid becomes a point.
 * Good for the mostly straight, short segments of segmented vessel models; strongly
 * curved segments are approximated by their chord direction.
 */

export type P3 = [number, number, number];

export interface Centerline {
  points: P3[];
  /** Mean distance of the bin's vertices from its centroid (≈ vessel radius). */
  radius: number;
  length: number;
}

function principalAxis(pts: P3[], mean: P3): P3 {
  // Covariance + power iteration (3x3), enough for the dominant axis.
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pts) {
    const d = [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] += d[i] * d[j];
  }
  let v: P3 = [0.577, 0.577, 0.577];
  for (let k = 0; k < 30; k++) {
    const n: P3 = [
      c[0] * v[0] + c[1] * v[1] + c[2] * v[2],
      c[3] * v[0] + c[4] * v[1] + c[5] * v[2],
      c[6] * v[0] + c[7] * v[1] + c[8] * v[2],
    ];
    const l = Math.hypot(...n) || 1;
    v = [n[0] / l, n[1] / l, n[2] / l];
  }
  return v;
}

export function centerline(pts: P3[], binLength = 0.004, minBins = 3, maxBins = 24): Centerline | null {
  if (pts.length < 6) return null;
  const mean: P3 = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) mean[i] += p[i] / pts.length;
  const axis = principalAxis(pts, mean);
  const t = pts.map((p) => (p[0] - mean[0]) * axis[0] + (p[1] - mean[1]) * axis[1] + (p[2] - mean[2]) * axis[2]);
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of t) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  const span = hi - lo;
  if (span <= 0) return null;
  const bins = Math.min(maxBins, Math.max(minBins, Math.round(span / binLength)));
  const sums = Array.from({ length: bins }, () => ({ x: 0, y: 0, z: 0, n: 0, members: [] as number[] }));
  t.forEach((x, i) => {
    const b = Math.min(bins - 1, Math.floor(((x - lo) / span) * bins));
    const s = sums[b];
    s.x += pts[i][0];
    s.y += pts[i][1];
    s.z += pts[i][2];
    s.n += 1;
    s.members.push(i);
  });
  const points: P3[] = [];
  let rSum = 0;
  let rN = 0;
  for (const s of sums) {
    if (!s.n) continue;
    const c: P3 = [s.x / s.n, s.y / s.n, s.z / s.n];
    points.push(c);
    for (const i of s.members) {
      rSum += Math.hypot(pts[i][0] - c[0], pts[i][1] - c[1], pts[i][2] - c[2]);
      rN += 1;
    }
  }
  if (points.length < 2) return null;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  }
  return { points, radius: rSum / Math.max(1, rN), length };
}

/** Orient a centre line so that it starts at the end nearer to `origin` (or farther, if `towards`). */
export function orientFrom(points: P3[], origin: P3, towards = false): P3[] {
  const d = (p: P3) => Math.hypot(p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]);
  const startNearer = d(points[0]) <= d(points[points.length - 1]);
  const flip = towards ? startNearer : !startNearer;
  return flip ? [...points].reverse() : points;
}

/** Point at fraction u (0..1) of a polyline's length. */
export function along(points: P3[], cumulative: number[], u: number, out: P3): P3 {
  const total = cumulative[cumulative.length - 1];
  const target = Math.min(total, Math.max(0, u * total));
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < target) i++;
  const seg = cumulative[i] - cumulative[i - 1] || 1;
  const f = (target - cumulative[i - 1]) / seg;
  for (let k = 0; k < 3; k++) out[k] = points[i - 1][k] + (points[i][k] - points[i - 1][k]) * f;
  return out;
}

export function cumulativeLengths(points: P3[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]));
  }
  return out;
}
