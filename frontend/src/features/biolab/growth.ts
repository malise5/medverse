/**
 * Neuron growth and circuit formation: an educational approximation of development.
 *
 * Stages follow the textbook sequence: neurite outgrowth from the soma, axon
 * specification (one neurite grows fastest and becomes the axon), growth-cone
 * guidance up a chemoattractant gradient towards a target field, dendritic branching,
 * synapse formation where an axon tip meets a dendrite of another cell, and activity-
 * dependent pruning that removes a share of the synapses formed.
 *
 * Growth cones move with persistence plus guidance plus random exploration. Lengths are
 * in scene units and time in arbitrary "development steps" (days to weeks in reality).
 */

export type Vec3 = [number, number, number];

export interface Branch {
  id: number;
  cell: number;
  kind: "axon" | "dendrite";
  points: Vec3[];
  dir: Vec3;
  order: number;
  growing: boolean;
}

export interface Synapse {
  from: number; // presynaptic cell (axon owner)
  to: number; // postsynaptic cell
  at: Vec3;
  formedAt: number;
  pruned: boolean;
}

export interface Cell {
  id: number;
  soma: Vec3;
  /** Where this cell's axon is guided (chemoattractant source), or null. */
  target: Vec3 | null;
}

export interface GrowthState {
  step: number;
  cells: Cell[];
  branches: Branch[];
  synapses: Synapse[];
  stage: Stage;
}

export type Stage = "outgrowth" | "polarisation" | "guidance" | "synaptogenesis" | "pruning" | "mature";

export const STAGES: { id: Stage; label: string; detail: string }[] = [
  { id: "outgrowth", label: "Neurite outgrowth", detail: "Several short neurites sprout from each cell body, led by motile growth cones." },
  { id: "polarisation", label: "Axon specification", detail: "One neurite grows fastest and becomes the axon; the others become dendrites." },
  { id: "guidance", label: "Axon guidance", detail: "Growth cones sense attractant gradients and steer the axon towards its target." },
  { id: "synaptogenesis", label: "Synapse formation", detail: "Where an axon meets a dendrite of another neuron, a synapse forms." },
  { id: "pruning", label: "Synaptic pruning", detail: "Weak or unused synapses are eliminated, refining the circuit." },
  { id: "mature", label: "Mature circuit", detail: "The remaining connections form a stable network." },
];

const STEP_LEN = { axon: 0.06, dendrite: 0.025 };
const MAX_DENDRITE_ORDER = 3;
const SYNAPSE_RADIUS = 0.07;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const dist = (a: Vec3, b: Vec3) => len(sub(a, b));

export interface Grower {
  state: GrowthState;
  step: () => void;
}

/** A sheet of neurons whose axons project to the next cell along a loop. */
export function createGrowth(seed = 1, cellCount = 6): Grower {
  const rnd = mulberry32(seed);
  const jitter = (k: number): Vec3 => [(rnd() - 0.5) * k, (rnd() - 0.5) * k, (rnd() - 0.5) * k];
  const cells: Cell[] = Array.from({ length: cellCount }, (_, i) => {
    const a = (i / cellCount) * Math.PI * 2;
    return { id: i, soma: add([Math.cos(a) * 1.2, Math.sin(a) * 0.7, 0], jitter(0.3)), target: null };
  });
  cells.forEach((c, i) => (c.target = cells[(i + 2) % cellCount].soma));
  const state: GrowthState = { step: 0, cells, branches: [], synapses: [], stage: "outgrowth" };
  let nextId = 0;
  const sprout = (cell: Cell, kind: Branch["kind"], from: Vec3, dir: Vec3, order: number) =>
    state.branches.push({ id: nextId++, cell: cell.id, kind, points: [from], dir: norm(dir), order, growing: true });

  for (const c of cells) {
    const n = 4 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) sprout(c, "dendrite", c.soma, jitter(2), 0);
  }

  const step = () => {
    state.step += 1;
    const s = state.step;
    state.stage =
      s < 25 ? "outgrowth" : s < 40 ? "polarisation" : s < 110 ? "guidance" : s < 150 ? "synaptogenesis" : s < 185 ? "pruning" : "mature";

    // Polarisation: the neurite pointing most towards the target becomes the axon.
    if (s === 25) {
      for (const c of cells) {
        const own = state.branches.filter((b) => b.cell === c.id && b.order === 0);
        const best = own.reduce((a, b) => {
          const score = (x: Branch) => -dist(x.points[x.points.length - 1], c.target!);
          return score(b) > score(a) ? b : a;
        });
        best.kind = "axon";
        best.growing = true; // the axon keeps extending after the outgrowth phase
      }
    }

    for (const b of [...state.branches]) {
      if (!b.growing || state.stage === "pruning" || state.stage === "mature") continue;
      const tip = b.points[b.points.length - 1];
      const cell = cells[b.cell];
      let dir = scale(b.dir, 0.75); // persistence
      if (b.kind === "axon" && s >= 40 && cell.target) {
        dir = add(dir, scale(norm(sub(cell.target, tip)), 0.55)); // chemoattraction
      }
      dir = norm(add(dir, jitter(0.6))); // exploration
      const next = add(tip, scale(dir, STEP_LEN[b.kind]));
      b.points.push(next);
      b.dir = dir;

      if (b.kind === "dendrite") {
        if (b.points.length > 6 + b.order * 2 && b.order < MAX_DENDRITE_ORDER && rnd() < 0.05) {
          sprout(cell, "dendrite", next, add(dir, jitter(1.6)), b.order + 1);
          sprout(cell, "dendrite", next, add(dir, jitter(1.6)), b.order + 1);
          b.growing = false;
        } else if (b.points.length > 18 - b.order * 3) {
          b.growing = false;
        }
      } else if (s >= 40) {
        // Synapse when the axon tip reaches a dendrite of another cell.
        for (const d of state.branches) {
          if (d.kind !== "dendrite" || d.cell === b.cell) continue;
          const hit = d.points.find((p) => dist(p, next) < SYNAPSE_RADIUS);
          if (hit && !state.synapses.some((x) => x.from === b.cell && x.to === d.cell)) {
            state.synapses.push({ from: b.cell, to: d.cell, at: hit, formedAt: s, pruned: false });
            if (state.synapses.filter((x) => x.from === b.cell).length >= 2) b.growing = false;
            break;
          }
        }
        if (b.points.length > 90) b.growing = false;
      }
    }

    // Pruning: remove about a third of synapses, the latest-formed (least reinforced) first.
    if (s === 150) {
      const ranked = [...state.synapses].sort((a, b) => b.formedAt - a.formedAt);
      ranked.slice(0, Math.floor(ranked.length / 3)).forEach((x) => (x.pruned = true));
    }
  };

  return { state, step };
}
