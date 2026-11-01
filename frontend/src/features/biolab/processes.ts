/**
 * Biological processes available in head study mode. "stage" processes open a
 * cell-scale view over the 3D viewer; "scene" processes animate the 3D head itself.
 * `basis` states plainly what is modelled and what is an educational approximation.
 */

export type ProcessId = "signalling" | "growth" | "blood" | "pathways";

export interface ProcessMeta {
  id: ProcessId;
  title: string;
  summary: string;
  kind: "stage" | "scene";
  breadcrumb: string[];
  basis: string;
}

export const PROCESSES: ProcessMeta[] = [
  {
    id: "signalling",
    title: "Neurons communicating",
    summary: "Fire neurons, watch impulses travel along axons and transmitter cross synapses.",
    kind: "stage",
    breadcrumb: ["Head", "Brain", "Cerebral cortex"],
    basis:
      "Model: integrate-and-fire neurons (rest −70 mV, threshold −55 mV, τm 10 ms, refractory 2 ms) with axonal conduction (myelinated 20 m/s, unmyelinated 0.5 m/s), 0.5 ms synaptic delay and summating EPSPs/IPSPs. Spike shape from the Hodgkin–Huxley model. Shown in slow motion; cell geometry is schematic.",
  },
  {
    id: "growth",
    title: "Neurons growing and connecting",
    summary: "Growth cones extend, axons are guided to targets, synapses form and are pruned.",
    kind: "stage",
    breadcrumb: ["Head", "Brain", "Developing cortex"],
    basis:
      "Educational approximation of development: growth cones move with persistence, chemoattractant guidance and random exploration; one neurite becomes the axon; synapses form on contact and about a third are pruned. Months of development are compressed into seconds.",
  },
  {
    id: "blood",
    title: "Blood flow in the head",
    summary: "Red cells stream through the arteries and veins of the head and brain.",
    kind: "scene",
    breadcrumb: ["Head", "Blood vessels"],
    basis:
      "Cells move along the centre lines of the 3D vessel meshes. Direction is inferred from geometry (arteries carry blood away from the heart, veins towards it); speed is illustrative and slowed. Bright red: oxygen-rich arterial blood; dark red-blue: oxygen-poor venous blood.",
  },
  {
    id: "pathways",
    title: "Brain pathways at work",
    summary: "Follow seeing, hearing, moving and touch through the real structures involved.",
    kind: "scene",
    breadcrumb: ["Head", "Brain"],
    basis:
      "Each pathway lights the structures involved in their anatomical order, with an impulse travelling between them. Routes between structures are drawn schematically (straight arcs), and timing is slowed and not to scale.",
  },
];
