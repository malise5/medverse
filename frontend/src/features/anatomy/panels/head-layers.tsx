"use client";

import type { AnatomicalSystem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useWorkspace } from "../store";

/**
 * Anatomical layer presets for head study mode. Each preset chooses which systems are
 * shown (others hidden), how deep the progressive dissection goes, optional opacities
 * for context layers (e.g. a faint skull around the vessels) and, optionally, a
 * structure to frame. Presets only change view state; they never alter anatomy.
 */
export interface HeadPreset {
  id: string;
  label: string;
  hint: string;
  systems: string[] | "all";
  depth: number;
  opacity?: Record<string, number>;
  /** Structures to frame, in order of preference (first one present in the body). */
  focus?: string[];
}

const BRAIN = "FMA:50801";
const RIGHT_EYEBALL = "FMA:12514";
const BONY_LABYRINTH = "FMA:60179";
const RIGHT_TEMPORAL_BONE = "FMA:52738";
const MANDIBLE = "FMA:52748";
const MOUTH = "FMA:49184";

export const HEAD_PRESETS: HeadPreset[] = [
  { id: "external", label: "External", hint: "Skin and face", systems: "all", depth: 0 },
  {
    id: "see-through",
    label: "See-through skin",
    hint: "Everything, skin at 25 %",
    systems: "all",
    depth: 0,
    opacity: { integumentary: 0.25 },
  },
  { id: "muscles", label: "Muscles", hint: "Skin removed", systems: ["muscular", "skeletal"], depth: 10 },
  { id: "skull", label: "Skull", hint: "Cranial and facial bones", systems: ["skeletal"], depth: 10 },
  {
    id: "vessels",
    label: "Blood vessels",
    hint: "Arteries and veins, faint skull",
    systems: ["cardiovascular", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.18 },
  },
  { id: "brain", label: "Brain", hint: "Brain, brainstem, ventricles", systems: ["nervous"], depth: 10, focus: [BRAIN] },
  {
    // The meninges render only while this preset is active (see anatomy-scene.tsx).
    id: "meninges",
    label: "Meninges",
    hint: "Dura, arachnoid, pia (schematic), venous sinuses",
    systems: ["nervous", "cardiovascular", "skeletal"],
    depth: 10,
    // no focus: selecting the brain would draw its highlight over the meninges
    opacity: { skeletal: 0.12, cardiovascular: 0.6 },
  },
  {
    id: "nerves",
    label: "Nerves",
    hint: "Brain and cranial nerves, faint skull",
    systems: ["nervous", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.18 },
  },
  {
    id: "eye",
    label: "Eye and orbit",
    hint: "Eyeball, extra-ocular muscles, optic nerve",
    systems: ["special_senses", "muscular", "nervous", "skeletal", "cardiovascular"],
    depth: 10,
    opacity: { skeletal: 0.25 },
    focus: [RIGHT_EYEBALL],
  },
  {
    id: "ear",
    label: "Ear",
    hint: "Labyrinth, ossicles, tympanic membrane",
    systems: ["special_senses", "nervous", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.15 },
    focus: [BONY_LABYRINTH, RIGHT_TEMPORAL_BONE],
  },
  {
    id: "mouth",
    label: "Mouth and teeth",
    hint: "Jaws, teeth, tongue, salivary glands",
    systems: ["digestive", "skeletal"],
    depth: 10,
    focus: [MANDIBLE, MOUTH],
  },
  {
    id: "glands",
    label: "Glands",
    hint: "Pituitary, pineal, thyroid, salivary, tonsils",
    systems: ["endocrine", "digestive", "lymphatic", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.15 },
  },
];

export function applyHeadPreset(
  preset: HeadPreset,
  systems: AnatomicalSystem[],
  focus: (structureIds: string[]) => void,
) {
  const ws = useWorkspace.getState();
  ws.select(null); // a previous preset's structure must not stay selected
  ws.showAll();
  for (const s of systems) {
    ws.setSystemVisible(s.id, preset.systems === "all" || preset.systems.includes(s.id));
    ws.setSystemOpacity(s.id, preset.opacity?.[s.id] ?? 1);
  }
  ws.setDissectionDepth(preset.depth);
  if (preset.focus) focus(preset.focus);
}

/** Grid of layer presets for a study region, with an optional note under it. */
export function LayerPresets({
  id,
  title,
  presets,
  systems,
  onFocus,
  children,
}: {
  id: string;
  title: string;
  presets: HeadPreset[];
  systems: AnatomicalSystem[];
  /** Frames the first of the given structures that exists in the body on screen. */
  onFocus: (structureIds: string[]) => void;
  children?: React.ReactNode;
}) {
  const active = useWorkspace((s) => s.headPreset);
  const setActive = useWorkspace((s) => s.setHeadPreset);
  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-2">
      <h3 id={`${id}-h`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={active === p.id}
            onClick={() => {
              applyHeadPreset(p, systems, onFocus);
              setActive(p.id);
            }}
            className={cn(
              "grid rounded-md border px-2 py-1.5 text-left transition-colors",
              active === p.id ? "border-primary/60 bg-primary/10" : "hover:bg-accent/50",
            )}
          >
            <span className="text-sm font-medium">{p.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{p.hint}</span>
          </button>
        ))}
      </div>
      {children}
      <p className="text-[11px] text-muted-foreground">
        Fine-tune below: each system can be hidden or faded, and Section plane (bottom bar) cuts the region
        in any anatomical plane.
      </p>
    </section>
  );
}

/** Note shown on the female body: which parts are female-donor and which are fitted. */
export function FittedNotice({ children }: { children: React.ReactNode }) {
  const bodyModel = useWorkspace((s) => s.bodyModel);
  if (bodyModel !== "female") return null;
  return (
    <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
      {children}{" "}
      <button type="button" className="text-primary hover:underline" onClick={() => useWorkspace.getState().setBodyModel("male")}>
        Switch to the male body
      </button>{" "}
      to compare.
    </p>
  );
}

export function HeadLayers({
  systems,
  onFocus,
}: {
  systems: AnatomicalSystem[];
  onFocus: (structureIds: string[]) => void;
}) {
  return (
    <LayerPresets id="head-layers" title="Head layers" presets={HEAD_PRESETS} systems={systems} onFocus={onFocus}>
      <FittedNotice>
        The brain, eyes, mouth, teeth, salivary glands, larynx, tonsils and skin of this head come from a
        female donor (Human Reference Atlas, Visible Human Female). The skull, ossicles, muscles, cranial
        nerves, head vessels and lymph nodes are Z-Anatomy models of a male body fitted to this head (CC
        BY-SA 4.0), and the meninges are schematic: an approximation, not female anatomy.
      </FittedNotice>
    </LayerPresets>
  );
}
