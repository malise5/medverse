"use client";

import { Eye, EyeOff } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AnatomicalSystem } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";

import { SYSTEM_COLORS } from "../engine/palette";
import { useWorkspace } from "../store";
import { HeadLayers } from "./head-layers";
import { NeckLayers } from "./neck-layers";
import { HeadProcessesPanel } from "./head-processes-panel";

const LAYER_STOPS = [
  { depth: 0, label: "skin" },
  { depth: 10, label: "muscles" },
  { depth: 30, label: "vessels" },
  { depth: 50, label: "organs" },
  { depth: 70, label: "skeleton" },
] as const;

export function DissectionControl({ systems }: { systems: AnatomicalSystem[] }) {
  const depth = useWorkspace((s) => s.dissectionDepth);
  const ghost = useWorkspace((s) => s.ghostRemovedLayer);
  const xray = useWorkspace((s) => s.xraySelection);
  const setXray = useWorkspace((s) => s.setXraySelection);
  const setDepth = useWorkspace((s) => s.setDissectionDepth);
  const setGhost = useWorkspace((s) => s.setGhostRemovedLayer);
  const { t } = useT();
  const removed = systems.filter((s) => s.dissection_depth < depth && s.mesh_count > 0);
  return (
    <section aria-labelledby="dissection-h" className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex items-baseline justify-between">
        <h3 id="dissection-h" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("explorer.layers.dissection")}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{depth}</span>
      </div>
      <Slider
        aria-label={t("explorer.layers.depth")}
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
            {t(`explorer.layers.stops.${s.label}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {removed.length
          ? t("explorer.layers.removed", {
              list: removed.map((s) => s.name.replace(/ system$/, "").replace(/^Mfumo wa /, "")).join(", "),
            })
          : t("explorer.layers.allPresent")}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="ghost" className="text-xs font-normal">
          {t("explorer.layers.ghost")}
        </Label>
        <Switch id="ghost" checked={ghost} onCheckedChange={setGhost} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="xray" className="text-xs font-normal">
          {t("explorer.layers.xray")}
        </Label>
        <Switch id="xray" checked={xray} onCheckedChange={setXray} />
      </div>
    </section>
  );
}

export function LayersPanel({
  systems,
  onFocus,
}: {
  systems: AnatomicalSystem[];
  onFocus: (structureIds: string[]) => void;
}) {
  const region = useWorkspace((s) => s.region);
  const visible = useWorkspace((s) => s.systemVisible);
  const opacity = useWorkspace((s) => s.systemOpacity);
  const setVisible = useWorkspace((s) => s.setSystemVisible);
  const setOpacity = useWorkspace((s) => s.setSystemOpacity);
  const bodyModel = useWorkspace((s) => s.bodyModel);
  const { t } = useT();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {region === "head" && <HeadLayers systems={systems} onFocus={onFocus} />}
      {region === "neck" && <NeckLayers systems={systems} onFocus={onFocus} />}
      {region !== "body" && <HeadProcessesPanel systems={systems} onFocus={onFocus} />}
      <DissectionControl systems={systems} />
      <section aria-labelledby="systems-h" className="grid grid-cols-[minmax(0,1fr)] gap-1">
        <h3 id="systems-h" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("explorer.layers.systems")}
        </h3>
        {systems.map((s) => {
          if (s.id === "unclassified" && !s.mesh_count) return null;
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
                  <span className="block text-sm leading-snug">{s.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {hasMeshes
                      ? t("explorer.layers.counts", { structures: s.structure_count, meshes: s.mesh_count })
                      : t(bodyModel === "male" ? "explorer.layers.notInMale" : "explorer.layers.notInFemale")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!hasMeshes}
                  aria-pressed={on}
                  aria-label={t(on ? "explorer.layers.hide" : "explorer.layers.show", { name: s.name })}
                  onClick={() => setVisible(s.id, !on)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  {on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
              {hasMeshes && on && (
                <Slider
                  aria-label={t("explorer.layers.opacity", { name: s.name })}
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
