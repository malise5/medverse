import { beforeEach, describe, expect, it } from "vitest";

import { flowLevel, ghostDepth, meshVisibility, useWorkspace } from "./store";

const base = {
  systemVisible: {},
  hiddenMeshes: new Set<string>(),
  isolatedMeshes: null,
  dissectionDepth: 10,
  ghostRemovedLayer: true,
};
const skin = { meshId: "FJ1", systemId: "integumentary", systemDepth: 0, removedGhostDepth: 0 };
const bone = { meshId: "FJ2", systemId: "skeletal", systemDepth: 80, removedGhostDepth: 0 };

describe("meshVisibility", () => {
  it("removes layers shallower than the dissection depth, ghosting the deepest removed", () => {
    expect(meshVisibility(base, skin)).toBe("ghost");
    expect(meshVisibility({ ...base, ghostRemovedLayer: false }, skin)).toBe("hidden");
    expect(meshVisibility(base, bone)).toBe("visible");
  });

  it("only ghosts the most recently removed layer", () => {
    const s = { ...base, dissectionDepth: 50 };
    const removed = ghostDepth([0, 20, 40, 80], 50);
    expect(removed).toBe(40);
    expect(meshVisibility(s, { ...skin, removedGhostDepth: removed })).toBe("hidden");
    expect(
      meshVisibility(s, { meshId: "FJ3", systemId: "cardiovascular", systemDepth: 40, removedGhostDepth: removed }),
    ).toBe("ghost");
  });

  it("respects system toggles and hidden meshes", () => {
    expect(meshVisibility({ ...base, systemVisible: { skeletal: false } }, bone)).toBe("hidden");
    expect(meshVisibility({ ...base, hiddenMeshes: new Set(["FJ2"]) }, bone)).toBe("hidden");
  });

  it("isolation overrides everything else", () => {
    const iso = { ...base, isolatedMeshes: new Set(["FJ1"]), systemVisible: { integumentary: false } };
    expect(meshVisibility(iso, skin)).toBe("visible");
    expect(meshVisibility(iso, bone)).toBe("hidden");
  });

  it("returns null ghost depth when nothing is removed", () => {
    expect(ghostDepth([0, 20], 0)).toBeNull();
  });
});

describe("workspace store", () => {
  beforeEach(() => useWorkspace.getState().reset());

  it("selects, and toggles additive multi-selection", () => {
    const s = useWorkspace.getState();
    s.select("FMA:1");
    s.select("FMA:2", { additive: true });
    s.select("FMA:3", { additive: true });
    expect(useWorkspace.getState().multiSelection).toEqual(["FMA:2", "FMA:3"]);
    s.select("FMA:2", { additive: true });
    expect(useWorkspace.getState().multiSelection).toEqual(["FMA:3"]);
    s.select("FMA:9");
    expect(useWorkspace.getState()).toMatchObject({ selectedId: "FMA:9", multiSelection: [] });
  });

  it("hide accumulates, isolate replaces, showAll restores", () => {
    const s = useWorkspace.getState();
    s.hideMeshes(["a"]);
    s.hideMeshes(["b"]);
    expect([...useWorkspace.getState().hiddenMeshes]).toEqual(["a", "b"]);
    s.isolateMeshes(["c"]);
    expect(useWorkspace.getState().hiddenMeshes.size).toBe(0);
    expect([...useWorkspace.getState().isolatedMeshes!]).toEqual(["c"]);
    s.showAll();
    expect(useWorkspace.getState().isolatedMeshes).toBeNull();
  });

  it("issues distinct camera commands for repeated requests", () => {
    const s = useWorkspace.getState();
    s.requestView("posterior");
    const first = useWorkspace.getState().viewCommand!.nonce;
    s.requestView("posterior");
    expect(useWorkspace.getState().viewCommand!.nonce).toBeGreaterThan(first);
  });
});

describe("flowLevel", () => {
  it("peaks where the wave is and travels away from the heart in arteries", () => {
    expect(flowLevel(3, 10, 3, false)).toBe(1);
    expect(flowLevel(3, 10, 5, false)).toBeCloseTo(0.5);
    expect(flowLevel(8, 10, 3, false)).toBe(0);
  });
  it("travels toward the heart in veins", () => {
    // At phase 0 the vein wave starts at the far end (hop = maxHop).
    expect(flowLevel(10, 10, 0, true)).toBe(1);
    expect(flowLevel(0, 10, 0, true)).toBe(0);
    expect(flowLevel(0, 10, 10, true)).toBe(1);
  });
});

describe("body model switch", () => {
  it("keeps the selected structure and clears mesh-level state", () => {
    const ws = useWorkspace.getState();
    ws.reset();
    ws.select("FMA:7088");
    ws.hideMeshes(["FJ1"]);
    ws.isolateMeshes(["FJ2"]);
    ws.setBodyModel("female");
    const s = useWorkspace.getState();
    expect(s.bodyModel).toBe("female");
    expect(s.selectedId).toBe("FMA:7088");
    expect(s.hiddenMeshes.size).toBe(0);
    expect(s.isolatedMeshes).toBeNull();
    s.reset();
    expect(useWorkspace.getState().bodyModel).toBe("female"); // reset keeps the chosen body
    useWorkspace.getState().setBodyModel("male");
  });
});
