import { describe, expect, it } from "vitest";

import { createGrowth, dist } from "./growth";

function grow(seed: number, steps: number) {
  const g = createGrowth(seed);
  for (let i = 0; i < steps; i++) g.step();
  return g.state;
}

describe("neuron growth", () => {
  it("is deterministic for a seed", () => {
    expect(JSON.stringify(grow(3, 60))).toBe(JSON.stringify(grow(3, 60)));
  });

  it("specifies exactly one axon per cell", () => {
    const s = grow(2, 30);
    for (const c of s.cells) expect(s.branches.filter((b) => b.cell === c.id && b.kind === "axon")).toHaveLength(1);
  });

  it("guides axons towards their targets", () => {
    const s = grow(5, 100);
    for (const c of s.cells) {
      const axon = s.branches.find((b) => b.cell === c.id && b.kind === "axon")!;
      const start = dist(axon.points[0], c.target!);
      const end = dist(axon.points[axon.points.length - 1], c.target!);
      expect(end).toBeLessThan(start);
    }
  });

  it("forms synapses between different cells and prunes some", () => {
    const s = grow(1, 200);
    expect(s.synapses.length).toBeGreaterThan(2);
    expect(s.synapses.every((x) => x.from !== x.to)).toBe(true);
    const pruned = s.synapses.filter((x) => x.pruned).length;
    expect(pruned).toBeGreaterThan(0);
    expect(pruned).toBeLessThan(s.synapses.length);
    expect(s.stage).toBe("mature");
  });
});
