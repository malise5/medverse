"use client";

import { Activity, Brain, Droplets, Sprout, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePathways, useProcesses } from "@/features/biolab/localized";
import type { Pathway } from "@/features/biolab/pathways";
import type { ProcessId } from "@/features/biolab/processes";
import { useT } from "@/lib/i18n/client";
import type { AnatomicalSystem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useWorkspace } from "../store";
import { applyHeadPreset, HEAD_PRESETS } from "./head-layers";
import { NECK_PRESETS } from "./neck-layers";

const ICONS: Record<ProcessId, typeof Activity> = { signalling: Activity, growth: Sprout, blood: Droplets, pathways: Brain };
const BRAIN = "FMA:50801";

/** Living processes of the head: cell-scale labs and animations on the 3D head. */
export function HeadProcessesPanel({
  systems,
  onFocus,
}: {
  systems: AnatomicalSystem[];
  onFocus: (structureIds: string[]) => void;
}) {
  const active = useWorkspace((s) => s.activeProcess);
  const pathwayId = useWorkspace((s) => s.pathwayId);
  const region = useWorkspace((s) => s.region);
  const vesselsPreset = region === "neck" ? NECK_PRESETS.find((p) => p.id === "neck-vessels")! : HEAD_PRESETS.find((p) => p.id === "vessels")!;
  const ws = useWorkspace.getState();
  const { t } = useT();
  const processes = useProcesses();
  const allPathways = usePathways();

  const start = (id: ProcessId) => {
    ws.select(null); // a selection's overlay and part labels would hide the animation
    if (id === "blood") {
      // Vessels translucent so the cells inside them show; faint skull for orientation.
      applyHeadPreset(vesselsPreset, systems, () => {});
      ws.setSystemOpacity("cardiovascular", 0.3);
      ws.setHeadPreset(vesselsPreset.id);
    }
    ws.setActiveProcess(id);
  };

  const startPathway = (pw: Pathway) => {
    if (pw.view) {
      applyHeadPreset({ id: pw.id, label: pw.title, hint: "", systems: pw.view.systems, depth: 10, opacity: pw.view.opacity }, systems, () => {});
      ws.setHeadPreset(null);
    } else {
      applyHeadPreset(HEAD_PRESETS.find((p) => p.id === "nerves")!, systems, () => {});
      for (const s of ["special_senses", "nervous"]) ws.setSystemVisible(s, true);
      ws.setSystemOpacity("nervous", 0.35); // deep relays (thalamus) show through the cortex
      ws.setHeadPreset("nerves");
    }
    ws.setPathway(pw.id);
    ws.setActiveProcess("pathways");
    if (pw.view?.camera) ws.requestView(pw.view.camera);
    else onFocus(pw.view?.focus ?? [BRAIN]); // frames the structures the pathway runs through
    ws.select(null); // keep the pathway's own highlighting unobstructed
  };
  const pathways = allPathways.filter((pw) => pw.region === region);

  return (
    <section aria-labelledby="head-processes-h" className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 id="head-processes-h" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("explorer.processes.title")}
        </h3>
        {active && (
          <Button size="xs" variant="ghost" onClick={() => (ws.setActiveProcess(null), ws.setHighlighted([]))}>
            <Square /> {t("explorer.processes.stop")}
          </Button>
        )}
      </div>
      <div className="grid gap-1.5">
        {processes.filter((p) => p.id !== "pathways").map((p) => {
          const Icon = ICONS[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active === p.id}
              onClick={() => start(p.id)}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                active === p.id ? "border-primary/60 bg-primary/10" : "hover:bg-accent/50",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="grid">
                <span className="text-sm font-medium">{p.title}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{p.summary}</span>
              </span>
            </button>
          );
        })}
        <div className={cn("grid gap-1 rounded-md border px-2 py-1.5", active === "pathways" && "border-primary/60 bg-primary/10")}>
          <span className="flex items-center gap-2 text-sm font-medium">
            <Brain className="size-4 text-primary" aria-hidden /> {t(region === "neck" ? "explorer.processes.neckSteps" : "explorer.processes.brainPathways")}
          </span>
          <div className="flex flex-wrap gap-1">
            {pathways.map((pw) => (
              <Button
                key={pw.id}
                size="xs"
                variant={active === "pathways" && pathwayId === pw.id ? "default" : "secondary"}
                onClick={() => startPathway(pw)}
                className="h-auto min-h-6 max-w-full whitespace-normal py-0.5 text-left"
              >
                {pw.title}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
