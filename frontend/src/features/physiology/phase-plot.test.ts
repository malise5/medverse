import { describe, expect, it } from "vitest";

import { arrowIndices, clipLine, nearestIndex, phaseDomain, pointAt, resolvePhasePlot } from "./phase-plot";

describe("phaseDomain", () => {
  it("spans all curves and keeps a requested origin exactly", () => {
    const d = phaseDomain(
      [
        { xs: [50, 120], ys: [5, 120] },
        { xs: [40, 100], ys: [8, 140] },
      ],
      0,
      0,
    );
    expect(d.x0).toBe(0);
    expect(d.y0).toBe(0);
    expect(d.x1).toBeGreaterThan(120);
    expect(d.y1).toBeGreaterThan(140);
  });

  it("pads both sides when no minimum is given", () => {
    const d = phaseDomain([{ xs: [10, 20], ys: [1, 2] }]);
    expect(d.x0).toBeLessThan(10);
    expect(d.y0).toBeLessThan(1);
  });
});

describe("clipLine", () => {
  const d = { x0: 0, x1: 150, y0: 0, y1: 150 };

  it("starts at the x-intercept and stops at the top edge", () => {
    // ESPVR: P = 3·(V − 10) leaves the box at V = 60
    const seg = clipLine(3, 10, d)!;
    expect(seg[0]).toEqual([10, 0]);
    expect(seg[1][0]).toBeCloseTo(60);
    expect(seg[1][1]).toBeCloseTo(150);
  });

  it("runs to the right edge when shallow", () => {
    const seg = clipLine(0.07, 10, d)!;
    expect(seg[1][0]).toBe(150);
    expect(seg[1][1]).toBeCloseTo(9.8);
  });

  it("returns null when the line misses the domain", () => {
    expect(clipLine(1, 500, d)).toBeNull();
  });
});

describe("nearestIndex", () => {
  it("measures distance in screen space", () => {
    // y is stretched 100× on screen, so the point closest in data units is not nearest
    const toScreen = (x: number, y: number): [number, number] => [x, y * 100];
    expect(nearestIndex([0, 5], [1, 0], 0, 0, toScreen)).toBe(1);
  });
});

describe("pointAt", () => {
  it("interpolates and clamps on a uniform time base", () => {
    const time = [0, 1, 2];
    expect(pointAt(time, [0, 10, 20], [5, 5, 15], 1.5)).toEqual([15, 10]);
    expect(pointAt(time, [0, 10, 20], [5, 5, 15], 9)).toEqual([20, 15]);
    expect(pointAt(time, [0, 10, 20], [5, 5, 15], -1)).toEqual([0, 5]);
  });
});

describe("arrowIndices", () => {
  // three laps of a 100 × 100 square, 40 samples per lap
  const lap = Array.from({ length: 40 }, (_, i) => {
    const side = Math.floor(i / 10);
    const f = (i % 10) * 10;
    return [[f, 0], [100, f], [100 - f, 100], [0, 100 - f]][side];
  });
  const pts = [...lap, ...lap, ...lap];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);

  it("spreads arrows over retraced cycles instead of stacking them", () => {
    const idx = arrowIndices(xs, ys, 3, 60);
    expect(idx).toHaveLength(3);
    for (const a of idx)
      for (const b of idx)
        if (a !== b) expect(Math.hypot(xs[a] - xs[b], ys[a] - ys[b])).toBeGreaterThanOrEqual(60);
  });

  it("skips stationary stretches", () => {
    const flat = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2];
    for (const i of arrowIndices(flat, flat.map(() => 0), 2, 0)) expect(flat[i + 3]).not.toBe(flat[i]);
  });
});

describe("resolvePhasePlot", () => {
  const plot = {
    id: "pv",
    title: "PV",
    x: "v",
    y: "p",
    description: "",
    x_min: 0,
    y_min: 0,
    lines: [
      { label: "ESPVR", slope_parameter: "e_max", x_intercept_parameter: "v0", description: "d1" },
      { label: "EDPVR", slope_parameter: "e_min", x_intercept_parameter: "v0", description: "d2" },
    ],
  };
  const run = (id: string, e_max: number) => ({
    id,
    label: id,
    parameters: { e_max, e_min: 0.07, v0: 10 },
    series: { v: [1, 2], p: [3, 4] },
  });

  it("draws lines from the run's parameters", () => {
    const { curves, lines } = resolvePhasePlot(plot, [run("current", 3)]);
    expect(curves[0]).toMatchObject({ xs: [1, 2], ys: [3, 4] });
    expect(lines.map((l) => [l.label, l.slope, l.x0])).toEqual([
      ["ESPVR", 3, 10],
      ["EDPVR", 0.07, 10],
    ]);
  });

  it("adds a comparison run's line only where its parameters differ", () => {
    const { lines } = resolvePhasePlot(plot, [run("baseline", 3), run("current", 5)]);
    expect(lines.map((l) => l.label)).toEqual(["ESPVR", "EDPVR", "ESPVR (current)"]);
    expect(lines[2]).toMatchObject({ slope: 5, curve: 1 });
  });
});
