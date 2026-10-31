"use client";

import { Loader2, Play, X } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCirculation, useModels } from "@/lib/api/queries";
import type { AnatomicalSystem, StructureIndex } from "@/lib/api/types";

import { SYSTEM_COLORS } from "../engine/palette";
import { useWorkspace } from "../store";
import { systemRoots } from "../use-anatomy-data";
import { CirculationSummary, Toggle } from "./body-map-panel";

const HEART = "FMA:7088";

/** Information for a whole body system shown in spotlight. */
export function SystemPanel({
  systemId,
  systems,
  index,
  onSelect,
}: {
  systemId: string;
  systems: AnatomicalSystem[];
  index: StructureIndex | undefined;
  onSelect: (id: string) => void;
}) {
  const system = systems.find((s) => s.id === systemId);
  const showCirculation = useWorkspace((s) => s.showCirculation);
  const flow = useWorkspace((s) => s.flowAnimation);
  const playback = useWorkspace((s) => s.playback);
  const ws = useWorkspace.getState();
  const models = useModels();
  const isCirculatory = systemId === "cardiovascular";
  const routesAvailable = useWorkspace((s) => s.bodyModel === "male");
  const circ = useCirculation(isCirculatory ? HEART : null, showCirculation && routesAvailable);

  const roots = useMemo(() => {
    if (!index) return [];
    const nameOf = new Map(index.ids.map((id, i) => [id, index.names[i]]));
    return systemRoots(systemId, index)
      .map((id) => ({ id, name: nameOf.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, systemId]);
  const model = models.data?.find((m) => m.domain === systemId && m.animations.length);

  if (!system) return null;
  return (
    <div className="grid gap-4 p-4">
      <header className="grid gap-2">
        <div className="flex items-start gap-2">
          <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-sm" style={{ background: SYSTEM_COLORS[system.id] }} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{system.name}</h2>
            <p className="text-xs text-muted-foreground">
              Whole system · {system.structure_count} structures · {system.mesh_count} 3D meshes
            </p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Close system view" onClick={() => ws.setSystemFocus(null)}>
            <X />
          </Button>
        </div>
        {system.description && <p className="text-sm text-muted-foreground">{system.description}</p>}
      </header>

      {model && (
        <section className="grid gap-2 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{model.name}</h3>
          <p className="text-xs text-muted-foreground">{model.summary}</p>
          <Button
            size="sm"
            className="justify-self-start"
            onClick={() => onSelect(model.linked_structure_ids[0])}
          >
            <Play /> {playback?.modelId === model.id ? "Open controls on" : "Simulate on"} the{" "}
            {model.domain === "respiratory" ? "lungs" : model.domain === "nervous" ? "brain" : "heart"}
          </Button>
        </section>
      )}

      {isCirculatory && routesAvailable && (
        <section className="grid gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blood vessels</h4>
          <Toggle id="sys-vessels" label="Show vessel routes from the heart" checked={showCirculation} onChange={ws.setShowCirculation} />
          <Toggle id="sys-flow" label="Animate blood flow" checked={flow} onChange={ws.setFlowAnimation} disabled={!showCirculation} />
          {showCirculation &&
            (circ.isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : circ.data ? (
              <CirculationSummary c={circ.data} onSelect={onSelect} />
            ) : null)}
        </section>
      )}

      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Main groups ({roots.length})
        </h4>
        <div className="flex max-h-72 flex-wrap overflow-auto">
          {roots.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className="rounded px-1 py-0.5 text-left text-sm text-primary hover:bg-primary/10"
            >
              {r.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
