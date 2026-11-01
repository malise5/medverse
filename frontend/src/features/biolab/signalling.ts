/**
 * Neural signalling in a small circuit: an educational simulation with physiological
 * parameters, not a fitted model of real cortex.
 *
 * - Membrane: leaky integrate-and-fire (rest −70 mV, threshold −55 mV, τm = 10 ms,
 *   absolute refractory period 2 ms). When a neuron fires, its displayed membrane trace
 *   uses an action-potential waveform from the Hodgkin–Huxley model (when supplied), so
 *   the spike shape is a real model output rather than a drawing.
 * - Axon: the spike travels at a conduction velocity (myelinated ≈ 20 m/s, saltatory,
 *   node to node; unmyelinated ≈ 0.5 m/s, continuous) over a physical axon length.
 * - Synapse: 0.5 ms synaptic delay (vesicle release, diffusion, receptor binding), then a
 *   postsynaptic current with exponential decay (τ = 5 ms). Excitatory synapses
 *   depolarise (EPSP), inhibitory ones hyperpolarise (IPSP). One EPSP alone stays below
 *   threshold; near-simultaneous EPSPs summate and fire the cell.
 *
 * Time is in milliseconds of simulated time; the scene plays it back in slow motion.
 */

export const V_REST = -70;
export const V_THRESHOLD = -55;
export const V_RESET = -75;
export const TAU_M = 10;
export const REFRACTORY_MS = 2;
export const SYNAPTIC_DELAY_MS = 0.5;
export const TAU_SYN = 5;
export const DT = 0.025;
export const VELOCITY_MYELINATED = 20; // m/s = mm/ms
export const VELOCITY_UNMYELINATED = 0.5;
const TRACE_MS = 60;

/**
 * Peak membrane deflection produced by a unit step of exponentially decaying synaptic
 * drive (τsyn) on a leaky membrane (τm): weights are given as peak PSPs in mV and
 * converted to drive with this factor.
 */
export const PSP_PEAK_FACTOR = (() => {
  const r = TAU_SYN / TAU_M;
  return (TAU_SYN / (TAU_M - TAU_SYN)) * (r ** (TAU_SYN / (TAU_M - TAU_SYN)) - r ** (TAU_M / (TAU_M - TAU_SYN)));
})();

export interface NeuronSpec {
  id: string;
  label: string;
  /** Physical axon length (mm), used with the conduction velocity. */
  axonMm: number;
  myelinated: boolean;
  /** Spontaneous (Poisson) firing drive when "background activity" is on, in Hz. */
  backgroundHz?: number;
}

export interface SynapseSpec {
  from: string;
  to: string;
  /** Peak postsynaptic potential (mV): positive excitatory, negative inhibitory. */
  weightMv: number;
}

export interface Pulse {
  neuron: string;
  /** Simulated time the spike left the soma. */
  t0: number;
  /** Transit time along the axon (ms). */
  transit: number;
}

export interface Release {
  synapse: number;
  /** Simulated time transmitter release began (spike arrival at the terminal). */
  t0: number;
}

export interface NeuronState {
  v: number;
  /** Postsynaptic current expressed as the steady-state depolarisation it drives (mV). */
  iSyn: number;
  refractoryUntil: number;
  lastSpike: number | null;
  trace: { t: number; v: number }[];
}

export interface CircuitState {
  t: number;
  neurons: Record<string, NeuronState>;
  pulses: Pulse[];
  releases: Release[];
  /** Synaptic events waiting for their delay: arrival time and target. */
  pending: { t: number; synapse: number }[];
  spikes: { neuron: string; t: number }[];
}

export interface Circuit {
  neurons: NeuronSpec[];
  synapses: SynapseSpec[];
}

/** Two excitatory inputs, one inhibitory interneuron, an integrating cell and its target. */
export const DEMO_CIRCUIT: Circuit = {
  neurons: [
    { id: "a", label: "Input neuron A", axonMm: 2, myelinated: true, backgroundHz: 12 },
    { id: "b", label: "Input neuron B", axonMm: 2, myelinated: true, backgroundHz: 12 },
    { id: "i", label: "Inhibitory interneuron", axonMm: 0.6, myelinated: false, backgroundHz: 4 },
    { id: "c", label: "Pyramidal neuron", axonMm: 3, myelinated: true },
    { id: "d", label: "Target neuron", axonMm: 2, myelinated: true },
  ],
  synapses: [
    { from: "a", to: "c", weightMv: 9 },
    { from: "b", to: "c", weightMv: 9 },
    { from: "i", to: "c", weightMv: -7 },
    { from: "c", to: "d", weightMv: 16 },
  ],
};

export function transitMs(spec: NeuronSpec, myelinOverride?: boolean): number {
  const myelinated = myelinOverride ?? spec.myelinated;
  return spec.axonMm / (myelinated ? VELOCITY_MYELINATED : VELOCITY_UNMYELINATED);
}

export function initialState(circuit: Circuit): CircuitState {
  return {
    t: 0,
    neurons: Object.fromEntries(
      circuit.neurons.map((n) => [n.id, { v: V_REST, iSyn: 0, refractoryUntil: 0, lastSpike: null, trace: [] }]),
    ),
    pulses: [],
    releases: [],
    pending: [],
    spikes: [],
  };
}

export interface StepOptions {
  /** Applies to all neurons when set (the "myelin" toggle); otherwise per-neuron. */
  myelinated?: boolean;
  background: boolean;
  /** Random source in [0, 1); injectable for deterministic tests. */
  random?: () => number;
  /** Action-potential waveform (mV over ms from threshold crossing) for displayed traces. */
  spikeShape?: { t: number[]; v: number[] } | null;
}

function shapeAt(shape: StepOptions["spikeShape"], dt: number): number | null {
  if (!shape || !shape.t.length) return null;
  if (dt < 0 || dt > shape.t[shape.t.length - 1]) return null;
  let i = 0;
  while (i < shape.t.length - 1 && shape.t[i + 1] < dt) i++;
  return shape.v[i];
}

/** Inject a brief strong current: the neuron fires on the next step unless refractory. */
export function stimulate(state: CircuitState, id: string): void {
  const n = state.neurons[id];
  if (n && state.t >= n.refractoryUntil) n.v = V_THRESHOLD + 5;
}

/** Advance the circuit by `ms` of simulated time (fixed internal step DT). */
export function advance(circuit: Circuit, state: CircuitState, ms: number, opts: StepOptions): void {
  const random = opts.random ?? Math.random;
  const byId = new Map(circuit.neurons.map((n) => [n.id, n]));
  const steps = Math.max(1, Math.round(ms / DT));
  for (let k = 0; k < steps; k++) {
    const t = state.t + DT;
    // Synaptic events whose delay has elapsed reach the postsynaptic cell.
    state.pending = state.pending.filter((p) => {
      if (p.t > t) return true;
      const syn = circuit.synapses[p.synapse];
      state.neurons[syn.to].iSyn += syn.weightMv / PSP_PEAK_FACTOR;
      return false;
    });
    // Spikes reaching their terminals release transmitter.
    state.pulses = state.pulses.filter((p) => {
      if (p.t0 + p.transit > t) return true;
      circuit.synapses.forEach((s, i) => {
        if (s.from === p.neuron) {
          state.releases.push({ synapse: i, t0: t });
          state.pending.push({ t: t + SYNAPTIC_DELAY_MS, synapse: i });
        }
      });
      return false;
    });
    state.releases = state.releases.filter((r) => t - r.t0 < SYNAPTIC_DELAY_MS + 1.5);

    for (const spec of circuit.neurons) {
      const n = state.neurons[spec.id];
      if (opts.background && spec.backgroundHz && random() < spec.backgroundHz * DT * 1e-3) {
        n.iSyn += 18 / PSP_PEAK_FACTOR; // a burst of unmodelled inputs (fires the cell)
      }
      // dV/dt = (−(V − Vrest) + I) / τm ; synaptic drive decays with τsyn.
      if (t >= n.refractoryUntil) n.v += (DT * (-(n.v - V_REST) + n.iSyn)) / TAU_M;
      n.iSyn -= (DT * n.iSyn) / TAU_SYN;
      if (n.v >= V_THRESHOLD && t >= n.refractoryUntil) {
        n.lastSpike = t;
        n.v = V_RESET;
        n.refractoryUntil = t + REFRACTORY_MS;
        state.spikes.push({ neuron: spec.id, t });
        state.pulses.push({ neuron: spec.id, t0: t, transit: transitMs(byId.get(spec.id)!, opts.myelinated) });
      }
      const shaped = n.lastSpike !== null ? shapeAt(opts.spikeShape, t - n.lastSpike) : null;
      n.trace.push({ t, v: shaped ?? (n.lastSpike !== null && t - n.lastSpike < 1 ? 30 : n.v) });
      while (n.trace.length && n.trace[0].t < t - TRACE_MS) n.trace.shift();
    }
    state.spikes = state.spikes.filter((s) => s.t > t - TRACE_MS);
    state.t = t;
  }
}

/**
 * Fraction of the axon a pulse has covered, for drawing. Myelinated axons conduct
 * saltatorily: the depolarisation jumps from node of Ranvier to node.
 */
export function pulseProgress(p: Pulse, t: number, myelinated: boolean, nodes = 8): number {
  const s = Math.min(1, Math.max(0, (t - p.t0) / p.transit));
  return myelinated ? Math.min(1, Math.ceil(s * nodes) / nodes) : s;
}

/** One action potential from a Hodgkin–Huxley run: from threshold crossing, ~4 ms. */
export function extractSpikeShape(time: number[], v: number[], threshold = -55): { t: number[]; v: number[] } | null {
  const i0 = v.findIndex((x, i) => i > 0 && v[i - 1] < threshold && x >= threshold);
  if (i0 < 0) return null;
  const t: number[] = [];
  const out: number[] = [];
  for (let i = i0; i < v.length && time[i] - time[i0] <= 4; i++) {
    t.push(time[i] - time[i0]);
    out.push(v[i]);
  }
  return { t, v: out };
}
