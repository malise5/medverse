import { describe, expect, it } from "vitest";

import { NECK_PRESETS } from "../anatomy/panels/neck-layers";
import { PATHWAYS } from "./pathways";

describe("pathways", () => {
  it("each pathway belongs to a region and names structures for every step", () => {
    for (const pw of PATHWAYS) {
      expect(["head", "neck"]).toContain(pw.region);
      expect(pw.steps.length).toBeGreaterThan(2);
      for (const st of pw.steps) {
        expect(st.structures.length).toBeGreaterThan(0);
        for (const id of st.structures) expect(id).toMatch(/^FMA:\d+$/);
        expect(st.note.length).toBeGreaterThan(20);
      }
    }
  });

  it("offers the neck functions in neck mode, with their own layers", () => {
    const neck = PATHWAYS.filter((pw) => pw.region === "neck").map((pw) => pw.id);
    expect(neck).toEqual(expect.arrayContaining(["swallowing", "baroreflex", "airflow", "voice"]));
    for (const pw of PATHWAYS.filter((p) => p.region === "neck")) expect(pw.view?.systems.length).toBeGreaterThan(0);
  });

  it("neck presets have unique ids and valid depths", () => {
    const ids = NECK_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of NECK_PRESETS) expect(p.depth).toBeGreaterThanOrEqual(0);
  });
});
