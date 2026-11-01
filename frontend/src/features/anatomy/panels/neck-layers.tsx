"use client";

import type { AnatomicalSystem } from "@/lib/api/types";

import { FittedNotice, type HeadPreset, LayerPresets } from "./head-layers";

const THYROID_GLAND = "FMA:9603";
const THYROID_CARTILAGE = "FMA:55099";
const CERVICAL_SPINE = "FMA:24138";
const RIGHT_COMMON_CAROTID = "FMA:3941";
const BRACHIAL_PLEXUS_TRUNK = "FMA:65216"; // superior trunk

/**
 * Layer presets for neck study mode (same mechanics as the head presets: they choose
 * systems, context opacities and dissection depth, and may frame a structure).
 */
export const NECK_PRESETS: HeadPreset[] = [
  { id: "external", label: "External", hint: "Skin of the neck", systems: "all", depth: 0 },
  {
    id: "see-through",
    label: "See-through skin",
    hint: "Everything, skin at 25 %",
    systems: "all",
    depth: 0,
    opacity: { integumentary: 0.25 },
  },
  {
    id: "neck-muscles",
    label: "Muscles",
    hint: "Platysma, sternocleidomastoid, infrahyoid, scalenes",
    systems: ["muscular", "skeletal"],
    depth: 10,
  },
  {
    id: "neck-larynx",
    label: "Larynx and hyoid",
    hint: "Cartilages, laryngeal and infrahyoid muscles",
    systems: ["respiratory", "muscular", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.4 },
    focus: [THYROID_CARTILAGE],
  },
  {
    id: "neck-skeleton",
    label: "Cervical spine",
    hint: "Vertebrae C1–C7, discs, hyoid, ligaments",
    systems: ["skeletal"],
    depth: 10,
    focus: [CERVICAL_SPINE],
  },
  {
    id: "neck-vessels",
    label: "Blood vessels",
    hint: "Carotid and vertebral arteries, jugular veins",
    systems: ["cardiovascular", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.18 },
    focus: [RIGHT_COMMON_CAROTID],
  },
  {
    id: "neck-nerves",
    label: "Nerves",
    hint: "Vagus, accessory, brachial plexus, sympathetic trunk",
    systems: ["nervous", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.18 },
    focus: [BRACHIAL_PLEXUS_TRUNK],
  },
  {
    id: "neck-viscera",
    label: "Viscera",
    hint: "Pharynx, larynx, trachea, oesophagus, thyroid",
    systems: ["respiratory", "digestive", "endocrine", "skeletal"],
    depth: 10,
    opacity: { skeletal: 0.15 },
    focus: [THYROID_GLAND],
  },
  {
    id: "neck-lymph",
    label: "Lymph nodes",
    hint: "Cervical node groups along the vessels",
    systems: ["lymphatic", "cardiovascular", "skeletal"],
    depth: 10,
    opacity: { cardiovascular: 0.35, skeletal: 0.15 },
  },
];

export function NeckLayers({
  systems,
  onFocus,
}: {
  systems: AnatomicalSystem[];
  onFocus: (structureIds: string[]) => void;
}) {
  return (
    <LayerPresets id="neck-layers" title="Neck layers" presets={NECK_PRESETS} systems={systems} onFocus={onFocus}>
      <FittedNotice>
        The larynx, trachea, cervical spinal cord, intervertebral discs and the left carotid and subclavian
        arteries of this neck come from a female donor. The cervical vertebrae, neck muscles, thyroid gland,
        most neck vessels, nerves and lymph nodes are Z-Anatomy models of a male body fitted to this neck (CC
        BY-SA 4.0): an approximation, not female anatomy.
      </FittedNotice>
    </LayerPresets>
  );
}
