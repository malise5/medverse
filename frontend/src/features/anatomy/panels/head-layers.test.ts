import { describe, expect, it, vi } from "vitest";

import type { AnatomicalSystem } from "@/lib/api/types";

import { useWorkspace } from "../store";
import { applyHeadPreset, HEAD_PRESETS } from "./head-layers";

const sys = (id: string, depth = 50): AnatomicalSystem =>
  ({ id, name: id, fma_id: null, description: null, display_order: 0, dissection_depth: depth, structure_count: 1, mesh_count: 1 }) as AnatomicalSystem;
const systems = [sys("integumentary", 0), sys("muscular", 20), sys("skeletal", 80), sys("cardiovascular", 40), sys("nervous", 45)];
const preset = (id: string) => HEAD_PRESETS.find((p) => p.id === id)!;

describe("head layer presets", () => {
  it("shows only the preset's systems, with context opacity and dissection depth", () => {
    useWorkspace.getState().reset();
    useWorkspace.getState().hideMeshes(["x"]);
    applyHeadPreset(preset("vessels"), systems, () => {});
    const s = useWorkspace.getState();
    expect(s.systemVisible).toMatchObject({ cardiovascular: true, skeletal: true, nervous: false, muscular: false });
    expect(s.systemOpacity.skeletal).toBeCloseTo(0.18);
    expect(s.systemOpacity.cardiovascular).toBe(1);
    expect(s.dissectionDepth).toBe(10);
    expect(s.hiddenMeshes.size).toBe(0); // presets start from a clean view
  });

  it("frames the preferred structures in order", () => {
    const focus = vi.fn();
    applyHeadPreset(preset("ear"), systems, focus);
    expect(focus).toHaveBeenCalledWith(["FMA:60179", "FMA:52738"]);
  });

  it("external restores every system with skin at full opacity", () => {
    applyHeadPreset(preset("external"), systems, () => {});
    const s = useWorkspace.getState();
    expect(Object.values(s.systemVisible).every(Boolean)).toBe(true);
    expect(s.dissectionDepth).toBe(0);
  });

  it("region switch keeps the body model and requests a reframe", () => {
    const before = useWorkspace.getState().viewCommand?.nonce ?? 0;
    useWorkspace.getState().setRegion("head");
    expect(useWorkspace.getState().region).toBe("head");
    expect(useWorkspace.getState().viewCommand?.nonce).toBeGreaterThan(before);
    useWorkspace.getState().setRegion("body");
  });
});
