"use client";

import { Activity, Crosshair, EyeOff, Focus, HeartPulse, MousePointerClick } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvidenceBadge, ReferenceList, VerificationBadge } from "@/features/governance/badges";
import { useStructure } from "@/lib/api/queries";
import type { AudienceLevel, Relation, StructureDetail, StructureSummary } from "@/lib/api/types";

import { SYSTEM_COLORS } from "../engine/palette";
import { useWorkspace } from "../store";

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  gross_anatomy: "Gross anatomy",
  surface_anatomy: "Surface anatomy",
  microscopic_anatomy: "Microscopic anatomy",
  histology: "Histology",
  physiology: "Physiology",
  blood_supply: "Blood supply",
  venous_drainage: "Venous drainage",
  innervation: "Innervation",
  lymphatic_drainage: "Lymphatic drainage",
  relations: "Relations",
  embryology: "Embryology",
  variations: "Variations",
  clinical_anatomy: "Clinical anatomy",
  pathology: "Pathology",
  injuries: "Injuries",
  investigations: "Investigations",
  management_principles: "Management principles",
  clinical_correlations: "Clinical correlations",
};

const AUDIENCES: [AudienceLevel, string][] = [
  ["basic", "Basic"],
  ["undergraduate", "Undergraduate"],
  ["clinical", "Clinical"],
  ["postgraduate", "Postgraduate"],
  ["specialist", "Specialist"],
];

function StructureLink({ s, onSelect }: { s: StructureSummary; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      className="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm text-primary hover:bg-primary/10"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: SYSTEM_COLORS[s.system_id ?? "unclassified"] }}
      />
      <span className="truncate">{s.name}</span>
    </button>
  );
}

function RelationGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Relation[];
  onSelect: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="grid gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="grid gap-1">
        {items.map((r) => (
          <li key={`${r.direction}-${r.predicate}-${r.target.id}`} className="text-sm">
            <span className="mr-1 text-xs text-muted-foreground">{r.label}</span>
            <StructureLink s={r.target} onSelect={onSelect} />
            {r.notes && <p className="pl-1 text-xs text-muted-foreground">{r.notes}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview({ d }: { d: StructureDetail }) {
  if (!d.content.length) {
    return (
      <div className="grid gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        <p>
          No curated educational content for this structure yet. Its identity, hierarchy and 3D
          geometry come from {d.identity_source === "bodyparts3d-4.0" ? "BodyParts3D 4.0 (FMA)" : d.identity_source}.
        </p>
        <p className="text-xs">Content is added through the expert-reviewed authoring workflow.</p>
      </div>
    );
  }
  const refIndex = new Map(d.references.map((r, i) => [r.id, i + 1]));
  return (
    <div className="grid gap-4">
      {d.content.map((c) => (
        <section key={c.section} className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-semibold">{SECTION_LABELS[c.section] ?? c.section}</h4>
            <VerificationBadge status={c.verification_status} />
            {c.audience !== useWorkspace.getState().audience && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                shown at {c.audience} level
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {c.body}
            {c.reference_ids.map((rid) => (
              <a key={rid} href={`#ref-${rid}`} className="ml-0.5 align-super text-[10px] text-primary">
                [{refIndex.get(rid)}]
              </a>
            ))}
          </p>
        </section>
      ))}
    </div>
  );
}

export function StructurePanel({
  structureId,
  meshIds,
  onSelect,
}: {
  structureId: string | null;
  meshIds: string[];
  onSelect: (id: string) => void;
}) {
  const audience = useWorkspace((s) => s.audience);
  const setAudience = useWorkspace((s) => s.setAudience);
  const multi = useWorkspace((s) => s.multiSelection);
  const q = useStructure(structureId, audience);

  if (!structureId) {
    return (
      <div className="grid gap-3 p-4 text-sm text-muted-foreground">
        <MousePointerClick className="size-6 text-primary" />
        <p className="font-medium text-foreground">No structure selected</p>
        <p>Click a structure in the 3D view, or use search or the hierarchy.</p>
        <ul className="list-inside list-disc text-xs">
          <li>Shift/Ctrl-click to add structures to a comparison selection</li>
          <li>Drag to rotate · right-drag to pan · scroll to zoom</li>
        </ul>
      </div>
    );
  }
  if (q.isLoading) {
    return (
      <div className="grid gap-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <p className="p-4 text-sm text-destructive">Could not load this structure.</p>;
  }
  const d = q.data;
  const ws = useWorkspace.getState();
  const structural = d.relations.filter((r) => r.relation_class === "structural");
  const functional = d.relations.filter((r) => r.relation_class === "functional");

  return (
    <div className="grid gap-4 p-4">
      <header className="grid gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1.5 size-3 shrink-0 rounded-sm"
            style={{ background: SYSTEM_COLORS[d.system_id ?? "unclassified"] }}
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight first-letter:uppercase">{d.name}</h2>
            {d.latin_name && <p className="text-sm italic text-muted-foreground">{d.latin_name}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {d.id}
          </Badge>
          {d.system_name && <Badge variant="outline" className="text-[10px]">{d.system_name}</Badge>}
          {d.laterality !== "unspecified" && (
            <Badge variant="outline" className="text-[10px] capitalize">{d.laterality}</Badge>
          )}
          <VerificationBadge status={d.verification_status} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.requestFocus(meshIds)}>
            <Crosshair /> Focus
          </Button>
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.isolateMeshes(meshIds)}>
            <Focus /> Isolate
          </Button>
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.hideMeshes(meshIds)}>
            <EyeOff /> Hide
          </Button>
        </div>
        {!d.has_geometry && (
          <p className="text-xs text-muted-foreground">No 3D mesh exists for this structure in the current asset set.</p>
        )}
        {multi.length > 0 && (
          <p className="text-xs text-muted-foreground">
            +{multi.length} more in comparison selection (purple).
          </p>
        )}
      </header>

      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        Content level
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as AudienceLevel)}
          className="h-7 rounded-md border border-input bg-input/30 px-1.5 text-xs text-foreground"
        >
          {AUDIENCES.map(([v, l]) => (
            <option key={v} value={v} className="bg-popover">
              {l}
            </option>
          ))}
        </select>
      </label>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Anatomy</TabsTrigger>
          <TabsTrigger value="relations">Relations</TabsTrigger>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-3">
          <Overview d={d} />
        </TabsContent>

        <TabsContent value="relations" className="grid gap-4 pt-3">
          {d.parents.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Part of</h4>
              <div className="flex flex-wrap">{d.parents.map((p) => <StructureLink key={p.id} s={p} onSelect={onSelect} />)}</div>
            </section>
          )}
          {d.children.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parts ({d.children.length})
              </h4>
              <div className="flex max-h-48 flex-wrap overflow-auto">
                {d.children.map((c) => <StructureLink key={c.id} s={c} onSelect={onSelect} />)}
              </div>
            </section>
          )}
          <RelationGroup title="Anatomical relationships" items={structural} onSelect={onSelect} />
          <RelationGroup title="Functional associations" items={functional} onSelect={onSelect} />
          {!d.parents.length && !d.children.length && !d.relations.length && (
            <p className="text-sm text-muted-foreground">No relationships recorded yet.</p>
          )}
          {d.relations.some((r) => r.verification_status === "draft") && (
            <p className="text-[11px] text-muted-foreground">
              Curated (non-hierarchical) relationships are drafts pending expert review.
            </p>
          )}
        </TabsContent>

        <TabsContent value="clinical" className="grid gap-4 pt-3">
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pathology</h4>
            {d.conditions.length ? (
              d.conditions.map((c) => (
                <Link
                  key={c.id}
                  href={`/pathology?condition=${encodeURIComponent(c.id)}`}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                >
                  <HeartPulse className="size-4 text-primary" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No pathology models linked yet.</p>
            )}
          </section>
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Simulations</h4>
            {d.simulations.length ? (
              d.simulations.map((s) => (
                <Link
                  key={s.model_id}
                  href={`/physiology?model=${encodeURIComponent(s.model_id)}`}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                >
                  <Activity className="size-4 text-primary" />
                  <span className="flex-1">{s.name}</span>
                  <EvidenceBadge evidence="C" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No compatible simulations yet.</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="sources" className="grid gap-4 pt-3">
          <section className="grid gap-1 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground">Identity source:</span> {d.identity_source}
            </p>
            {d.xrefs.map((x) => (
              <p key={x.source}>
                <span className="text-foreground">{x.source}:</span> {x.code}
                {x.license && <> · {x.license}</>}
              </p>
            ))}
            {d.synonyms.length > 0 && (
              <p>
                <span className="text-foreground">Synonyms:</span>{" "}
                {d.synonyms.map((s) => `${s.synonym} (${s.kind})`).join("; ")}
              </p>
            )}
            <p>
              <span className="text-foreground">Meshes:</span> {d.mesh_ids.length}
            </p>
          </section>
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">References</h4>
            <ReferenceList references={d.references} />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
