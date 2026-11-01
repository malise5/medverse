import { describe, expect, it } from "vitest";

import { NECK_PRESETS } from "../anatomy/panels/neck-layers";
import { localizePathways, localizeProcesses } from "./localized";
import { PATHWAYS } from "./pathways";
import { PROCESSES } from "./processes";
import { PATHWAYS_SW } from "./text.sw";

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

  it("has Kiswahili wording for every pathway step, keeping structures and order", () => {
    for (const pw of PATHWAYS) expect(PATHWAYS_SW[pw.id]?.steps.length, pw.id).toBe(pw.steps.length);
    const sw = localizePathways("sw");
    sw.forEach((pw, i) => {
      expect(pw.title).not.toBe(PATHWAYS[i].title);
      pw.steps.forEach((st, j) => expect(st.structures).toEqual(PATHWAYS[i].steps[j].structures));
    });
    expect(localizePathways("en")).toBe(PATHWAYS);
    localizeProcesses("sw").forEach((p, i) => expect(p.basis).not.toBe(PROCESSES[i].basis));
  });
});
