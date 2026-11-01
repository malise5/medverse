import { describe, expect, it } from "vitest";

import {
  advance,
  DEMO_CIRCUIT,
  extractSpikeShape,
  initialState,
  pulseProgress,
  stimulate,
  transitMs,
  V_REST,
  V_THRESHOLD,
  VELOCITY_MYELINATED,
} from "./signalling";

const opts = { background: false };

describe("neural signalling circuit", () => {
  it("stays at rest without input", () => {
    const s = initialState(DEMO_CIRCUIT);
    advance(DEMO_CIRCUIT, s, 50, opts);
    expect(s.neurons.c.v).toBeCloseTo(V_REST, 5);
    expect(s.spikes).toHaveLength(0);
  });

  it("a stimulated neuron fires and its spike reaches the terminal after the conduction time", () => {
    const s = initialState(DEMO_CIRCUIT);
    stimulate(s, "a");
    advance(DEMO_CIRCUIT, s, 0.05, opts);
    expect(s.spikes.map((x) => x.neuron)).toEqual(["a"]);
    expect(s.pulses[0].transit).toBeCloseTo(2 / VELOCITY_MYELINATED); // 0.1 ms
    advance(DEMO_CIRCUIT, s, 0.2, opts);
    expect(s.releases.length).toBe(1); // transmitter released at the a -> c synapse
  });

  it("one EPSP is subthreshold; two coincident EPSPs summate and fire the cell", () => {
    const one = initialState(DEMO_CIRCUIT);
    stimulate(one, "a");
    advance(DEMO_CIRCUIT, one, 30, opts);
    const peak = Math.max(...one.neurons.c.trace.map((p) => p.v));
    expect(peak).toBeCloseTo(V_REST + 9, 0); // weight = peak EPSP
    expect(peak).toBeLessThan(V_THRESHOLD);
    expect(one.spikes.some((x) => x.neuron === "c")).toBe(false);

    const two = initialState(DEMO_CIRCUIT);
    stimulate(two, "a");
    stimulate(two, "b");
    advance(DEMO_CIRCUIT, two, 30, opts);
    expect(two.spikes.some((x) => x.neuron === "c")).toBe(true);
    // ... and the pyramidal cell's spike drives its target
    expect(two.spikes.some((x) => x.neuron === "d")).toBe(true);
  });

  it("inhibition arriving with the excitation prevents firing", () => {
    const s = initialState(DEMO_CIRCUIT);
    stimulate(s, "i");
    advance(DEMO_CIRCUIT, s, 1.0, opts); // unmyelinated interneuron: slower axon
    stimulate(s, "a");
    stimulate(s, "b");
    advance(DEMO_CIRCUIT, s, 30, opts);
    expect(s.spikes.some((x) => x.neuron === "c")).toBe(false);
  });

  it("myelin speeds conduction about 40-fold and is saltatory", () => {
    const spec = DEMO_CIRCUIT.neurons[3];
    expect(transitMs(spec, false) / transitMs(spec, true)).toBeCloseTo(40);
    const p = { neuron: "c", t0: 0, transit: 1 };
    expect(pulseProgress(p, 0.3, true, 4)).toBe(0.5); // jumps to the next node
    expect(pulseProgress(p, 0.3, false)).toBeCloseTo(0.3); // continuous
  });

  it("extracts one action potential from a Hodgkin–Huxley trace", () => {
    const t = Array.from({ length: 200 }, (_, i) => i * 0.05);
    const v = t.map((x) => (x > 2 && x < 3 ? 30 : -65));
    const shape = extractSpikeShape(t, v)!;
    expect(shape.t[0]).toBe(0);
    expect(Math.max(...shape.v)).toBe(30);
    expect(shape.t[shape.t.length - 1]).toBeLessThanOrEqual(4);
  });
});
