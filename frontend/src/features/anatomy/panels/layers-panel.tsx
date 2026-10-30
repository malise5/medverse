"use client";

import { Eye, EyeOff } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AnatomicalSystem } from "@/lib/api/types";

import { SYSTEM_COLORS } from "../engine/palette";
import { useWorkspace } from "../store";

const LAYER_STOPS = [
  { depth: 0, label: "Skin" },
  { depth: 10, label: "Muscles" },
  { depth: 30, label: "Vessels & nerves" },
  { depth: 50, label: "Organs" },
  { depth: 70, label: "Skeleton" },
] as const;

export function DissectionControl({ systems }: { systems: AnatomicalSystem[] }) {
  const depth = useWorkspace((s) => s.dissectionDepth);
  const ghost = useWorkspace((s) => s.ghostRemovedLayer);
  const xray = useWorkspace((s) => s.xraySelection);
  const setXray = useWorkspace((s) => s.setXraySelection);
  const setDepth = useWorkspace((s) => s.setDissectionDepth);
  const setGhost = useWorkspace((s) => s.setGhostRemovedLayer);
  const removed = systems.filter((s) => s.dissection_depth < depth && s.mesh_count > 0);
  return (
    <section aria-labelledby="dissection-h" className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <h3 id="dissection-h" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Progressive dissection
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{depth}</span>
      </div>
      <Slider
        aria-label="Dissection depth"
        min={0}
        max={90}
        step={1}
        value={[depth]}
        onValueChange={([v]) => setDepth(v)}
      />
      <div className="flex flex-wrap gap-1">
        {LAYER_STOPS.map((s) => (
          <button
            key={s.depth}
            type="button"
            onClick={() => setDepth(s.depth)}
            className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {removed.length
          ? `Removed: ${removed.map((s) => s.name.replace(" system", "")).join(", ")}`
          : "All layers present"}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="ghost" className="text-xs font-normal">
          Show last removed layer as outline
        </Label>
        <Switch id="ghost" checked={ghost} onCheckedChange={setGhost} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="xray" className="text-xs font-normal">
          Show selection through overlying structures
        </Label>
        <Switch id="xray" checked={xray} onCheckedChange={setXray} />
      </div>
    </section>
  );
}

export function LayersPanel({ systems }: { systems: AnatomicalSystem[] }) {
  const visible = useWorkspace((s) => s.systemVisible);
  const opacity = useWorkspace((s) => s.systemOpacity);
  const setVisible = useWorkspace((s) => s.setSystemVisible);
  const setOpacity = useWorkspace((s) => s.setSystemOpacity);

  return (
    <div className="grid gap-5">
      <DissectionControl systems={systems} />
      <section aria-labelledby="systems-h" className="grid gap-1">
        <h3 id="systems-h" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Anatomical systems
        </h3>
        {systems.map((s) => {
          const on = visible[s.id] !== false;
          const hasMeshes = s.mesh_count > 0;
          return (
            <div key={s.id} className="rounded-md px-1.5 py-1.5 hover:bg-accent/40">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: SYSTEM_COLORS[s.id] ?? SYSTEM_COLORS.unclassified }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{s.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {hasMeshes
                      ? `${s.structure_count} structures · ${s.mesh_count} meshes`
                      : "Placeholder · no 3D assets yet"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!hasMeshes}
                  aria-pressed={on}
                  aria-label={`${on ? "Hide" : "Show"} ${s.name}`}
                  onClick={() => setVisible(s.id, !on)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  {on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
              {hasMeshes && on && (
                <Slider
                  aria-label={`${s.name} opacity`}
                  className="mt-2 pl-4.5"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[opacity[s.id] ?? 1]}
                  onValueChange={([v]) => setOpacity(s.id, v)}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
