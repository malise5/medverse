"use client";

import { Info, Loader2, ZoomOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCirculation } from "@/lib/api/queries";
import type { Circulation, StructureRef } from "@/lib/api/types";

import { meshColor } from "../engine/palette";
import { useWorkspace } from "../store";

export function Toggle({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm">
      {label}
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function VesselList({
  title,
  color,
  items,
  onSelect,
}: {
  title: string;
  color: string;
  items: StructureRef[];
  onSelect: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="grid gap-1">
      <h5 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        {title} ({items.length})
      </h5>
      <div className="flex max-h-32 flex-wrap overflow-auto">
        {items.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className="rounded px-1 py-0.5 text-left text-sm text-primary hover:bg-primary/10"
          >
            {v.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export function CirculationSummary({ c, onSelect }: { c: Circulation; onSelect: (id: string) => void }) {
  const requestFocus = useWorkspace((s) => s.requestFocus);
  const nArt = Object.keys(c.arteries).length;
  const nVein = Object.keys(c.veins).length;
  const artery = meshColor("cardiovascular", "artery");
  const vein = meshColor("cardiovascular", "vein");

  if (c.mode === "none") {
    return (
      <p className="text-sm text-muted-foreground">
        No blood vessels in the 3D model touch this structure, so no route can be shown. Its blood
        supply may still be described under Anatomy when curated content exists.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {c.mode === "whole_circulation" ? (
          <>
            The heart pumps blood out through <b>{nArt}</b> artery segments (red), and{" "}
            <b>{nVein}</b> vein segments (blue) bring it back. Arteries carry blood away from the
            heart; veins return it.
          </>
        ) : (
          <>
            Blood reaches this structure from the heart through an arterial route of <b>{nArt}</b>{" "}
            segments (red) and returns through a venous route of <b>{nVein}</b> segments (blue).
          </>
        )}
      </p>
      <VesselList
        title={c.mode === "whole_circulation" ? "Arteries leaving the heart" : "Arteries touching it"}
        color={artery}
        items={c.contact_arteries}
        onSelect={onSelect}
      />
      <VesselList
        title={c.mode === "whole_circulation" ? "Veins entering the heart" : "Veins touching it"}
        color={vein}
        items={c.contact_veins}
        onSelect={onSelect}
      />
      {c.unrouted_vessels > 0 && (
        <p className="text-xs text-muted-foreground">
          {c.unrouted_vessels} touching vessel segment(s) could not be traced back to the heart
          (gaps in the 3D meshes).
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="justify-self-start"
        onClick={() => requestFocus([...c.organ_mesh_ids, ...Object.keys(c.arteries), ...Object.keys(c.veins)])}
      >
        <ZoomOut /> Zoom out to the whole route
      </Button>
      <p className="text-xs text-muted-foreground">
        The moving brightness shows the direction of blood flow (away from the heart in arteries,
        back in veins), not its real speed.
      </p>
      <p className="flex gap-1.5 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <Badge variant="outline" className="mr-1 text-[10px]">Inferred from 3D geometry</Badge>
          {c.method}
        </span>
      </p>
    </div>
  );
}

export function BodyMapPanel({ structureId, onSelect }: { structureId: string; onSelect: (id: string) => void }) {
  const parts = useWorkspace((s) => s.parts);
  const showParts = useWorkspace((s) => s.showParts);
  const showCirculation = useWorkspace((s) => s.showCirculation);
  const flow = useWorkspace((s) => s.flowAnimation);
  const spotlight = useWorkspace((s) => s.spotlight);
  const ws = useWorkspace.getState();
  const circ = useCirculation(structureId, showCirculation);

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <Toggle id="bm-spot" label="Spotlight (fade the rest of the body)" checked={spotlight} onChange={ws.setSpotlight} />
        <Toggle id="bm-parts" label="Colour and label parts" checked={showParts} onChange={ws.setShowParts} />
        <Toggle id="bm-vessels" label="Show blood vessel routes" checked={showCirculation} onChange={ws.setShowCirculation} />
        <Toggle id="bm-flow" label="Animate blood flow" checked={flow} onChange={ws.setFlowAnimation} disabled={!showCirculation} />
      </section>

      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parts</h4>
        {parts.length ? (
          <ul className="grid gap-0.5">
            {parts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-accent"
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
                  <span className="flex-1 truncate first-letter:uppercase">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.meshIds.length} mesh{p.meshIds.length === 1 ? "" : "es"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">This structure has no separately modelled parts.</p>
        )}
      </section>

      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blood vessels</h4>
        {!showCirculation ? (
          <p className="text-sm text-muted-foreground">Turn on “Show blood vessel routes” to trace them.</p>
        ) : circ.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : circ.data ? (
          <CirculationSummary c={circ.data} onSelect={onSelect} />
        ) : (
          <p className="text-sm text-destructive">Could not load vessel routes.</p>
        )}
        {showCirculation && !spotlight && (
          <p className="text-xs text-muted-foreground">Turn on Spotlight to see the route clearly.</p>
        )}
      </section>
    </div>
  );
}
