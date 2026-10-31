import { describe, expect, it } from "vitest";

import { advance, effectStrength, sampleAt, seriesRange } from "./animation";

describe("function animation helpers", () => {
  it("interpolates and clamps", () => {
    const t = [0, 1, 2];
    const v = [0, 10, 20];
    expect(sampleAt(t, v, 0.25)).toBeCloseTo(2.5);
    expect(sampleAt(t, v, -1)).toBe(0);
    expect(sampleAt(t, v, 5)).toBe(20);
  });

  it("maps range and magnitude normalisation to effect strength", () => {
    const r = seriesRange([-2, 0, 4]);
    const scale = { effect: "scale" as const, amplitude: 0.05, normalise: "range" as const };
    expect(effectStrength(scale, -2, r)).toBeCloseTo(0.95);
    expect(effectStrength(scale, 4, r)).toBeCloseTo(1.05);
    const glow = { effect: "glow" as const, amplitude: 1, normalise: "magnitude" as const };
    expect(effectStrength(glow, -2, r)).toBeCloseTo(0.5);
    expect(effectStrength(glow, 0, r)).toBe(0);
  });

  it("treats a flat series as mid-level instead of dividing by zero", () => {
    const r = seriesRange([3, 3]);
    expect(effectStrength({ effect: "scale", amplitude: 0.1, normalise: "range" }, 3, r)).toBe(1);
  });

  it("loops playback time within the window", () => {
    expect(advance(0.9, 0.2, 1, 1, 0, 1)).toBeCloseTo(0.1);
    expect(advance(0, 1, 15, 0.5, 0, 60)).toBeCloseTo(7.5);
  });
});
