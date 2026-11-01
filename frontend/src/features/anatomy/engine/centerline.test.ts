import { describe, expect, it } from "vitest";

import { along, centerline, cumulativeLengths, orientFrom, type P3 } from "./centerline";

/** Vertices of a cylinder of radius r along +y from y0 to y1. */
function tube(r: number, y0: number, y1: number): P3[] {
  const pts: P3[] = [];
  for (let k = 0; k <= 20; k++) {
    const y = y0 + ((y1 - y0) * k) / 20;
    for (let a = 0; a < 12; a++) pts.push([r * Math.cos((a / 12) * Math.PI * 2), y, r * Math.sin((a / 12) * Math.PI * 2)]);
  }
  return pts;
}

describe("vessel centre lines", () => {
  it("recovers the axis, length and radius of a tube", () => {
    const c = centerline(tube(0.003, 0, 0.05))!;
    expect(c.length).toBeGreaterThan(0.04);
    expect(c.length).toBeLessThan(0.051);
    expect(c.radius).toBeCloseTo(0.003, 3);
    for (const p of c.points) {
      expect(Math.abs(p[0])).toBeLessThan(1e-6);
      expect(Math.abs(p[2])).toBeLessThan(1e-6);
    }
  });

  it("orients arteries away from the heart and veins towards it", () => {
    const pts: P3[] = [
      [0, 1.6, 0],
      [0, 1.7, 0],
    ];
    const heart: P3 = [0, 1.2, 0];
    expect(orientFrom(pts, heart)[0][1]).toBe(1.6); // artery starts near the heart
    expect(orientFrom(pts, heart, true)[0][1]).toBe(1.7); // vein ends near the heart
  });

  it("interpolates along the polyline by length", () => {
    const pts: P3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ];
    const cum = cumulativeLengths(pts);
    const out: P3 = [0, 0, 0];
    expect(along(pts, cum, 0.75, out)).toEqual([1, 0.5, 0]);
  });
});
