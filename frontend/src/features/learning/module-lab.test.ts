import { describe, expect, it } from "vitest";

import type { ModelDefinition } from "@/lib/api/types";

import { labItems } from "./module-lab";

const model = (id: string, domain: string) => ({ id, name: id, domain }) as unknown as ModelDefinition;
const models = [model("cv.cardiac_cycle", "cardiovascular"), model("cv.windkessel3", "cardiovascular"), model("neuro.hodgkin_huxley", "nervous"), model("resp.single", "respiratory")];

describe("module lab simulations", () => {
  it("offers the models of the module's own system", () => {
    expect(labItems("cardiovascular", models).map((i) => i.id)).toEqual(["cv.cardiac_cycle", "cv.windkessel3"]);
    expect(labItems("respiratory", models).every((i) => i.kind === "model")).toBe(true);
  });

  it("adds the cell-scale neuron labs to the nervous system", () => {
    const items = labItems("nervous", models);
    expect(items.map((i) => i.kind)).toEqual(["model", "signalling", "growth"]);
  });

  it("offers nothing for a system without a documented model", () => {
    expect(labItems("skeletal", models)).toEqual([]);
  });
});
