"use client";

import { Pause, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PATHWAYS } from "@/features/biolab/pathways";
import { PROCESSES } from "@/features/biolab/processes";

import { useWorkspace } from "./store";

const SPEEDS = [0.5, 1, 2, 4];

/** Controls and narration for processes animated on the 3D head (blood flow, pathways). */
export function ProcessHud() {
  const active = useWorkspace((s) => s.activeProcess);
  const playing = useWorkspace((s) => s.processPlaying);
  const speed = useWorkspace((s) => s.processSpeed);
  const pathwayId = useWorkspace((s) => s.pathwayId);
  const step = useWorkspace((s) => s.pathwayStep);
  const ws = useWorkspace.getState();
  const meta = PROCESSES.find((p) => p.id === active);
  if (!meta || meta.kind !== "scene") return null;
  const pathway = active === "pathways" ? PATHWAYS.find((p) => p.id === pathwayId) : null;
  const current = pathway?.steps[step];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <section
        aria-label={meta.title}
        aria-live="polite"
        className="pointer-events-auto grid w-full max-w-xl gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur"
      >
        <header className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {pathway ? `${meta.title}: ${pathway.title}` : meta.title}
          </p>
          <Button size="icon-sm" variant="secondary" aria-label={playing ? "Pause" : "Play"} onClick={() => ws.setProcessPlaying(!playing)}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <select
            aria-label="Speed"
            value={speed}
            onChange={(e) => ws.setProcessSpeed(Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-input/30 px-1 text-xs"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-popover">
                {s}×
              </option>
            ))}
          </select>
          <Button size="icon-sm" variant="ghost" aria-label="Stop" onClick={() => (ws.setActiveProcess(null), ws.setHighlighted([]))}>
            <X />
          </Button>
        </header>
        {pathway && current ? (
          <div className="grid gap-1">
            <ol className="flex gap-1" aria-label="Steps">
              {pathway.steps.map((s, i) => (
                <li
                  key={s.label}
                  aria-current={i === step ? "step" : undefined}
                  className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </ol>
            <p className="text-sm font-medium">
              {step + 1}. {current.label}
            </p>
            <p className="text-xs text-muted-foreground">{current.note}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="text-[#ff2b2b]">●</span> oxygen-rich arterial blood · <span className="text-[#4b49c8]">●</span>{" "}
            oxygen-poor venous blood. Cells are shown enlarged.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/80">{meta.basis}</p>
      </section>
    </div>
  );
}
