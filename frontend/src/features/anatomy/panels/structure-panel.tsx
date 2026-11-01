"use client";

import { Activity, Crosshair, EyeOff, Focus, HeartPulse, Lightbulb, MousePointerClick } from "lucide-react";
import { Link } from "@/lib/i18n/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvidenceBadge, ReferenceList, VerificationBadge } from "@/features/governance/badges";
import { useStructure } from "@/lib/api/queries";
import { type MessageKey, useT } from "@/lib/i18n/client";
import type { AudienceLevel, Relation, StructureDetail, StructureSummary } from "@/lib/api/types";

import { SYSTEM_COLORS } from "../engine/palette";
import { FunctionPanel } from "../function/function-panel";
import { BodyMapPanel } from "./body-map-panel";
import { useWorkspace } from "../store";

const AUDIENCES: AudienceLevel[] = ["basic", "undergraduate", "clinical", "postgraduate", "specialist"];

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
  const { t } = useT();
  // Unknown keys come back unchanged, so an unlisted section or source shows its raw id.
  const tk = (key: string) => t(key as MessageKey);
  if (!d.content.length) {
    return (
      <div className="grid gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        <p>
          {t("explorer.structure.noContent", {
            source: tk(`explorer.structure.sources.${d.identity_source}`).replace(/^explorer\.structure\.sources\./, ""),
          })}
        </p>
        <p className="text-xs">{t("explorer.structure.workflow")}</p>
      </div>
    );
  }
  const refIndex = new Map(d.references.map((r, i) => [r.id, i + 1]));
  return (
    <div className="grid gap-4">
      {d.content.map((c) => (
        <section key={c.section} className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-semibold">{tk(`explorer.structure.sections.${c.section}`).replace(/^explorer\.structure\.sections\./, "")}</h4>
            <VerificationBadge status={c.verification_status} />
            {c.audience !== useWorkspace.getState().audience && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {t("explorer.structure.shownAtLevel", { level: t(`explorer.structure.audiences.${c.audience}`) })}
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

/** The selected structure exists only in the other body (e.g. uterus, prostate). */
function OtherBodyNotice() {
  const bodyModel = useWorkspace((s) => s.bodyModel);
  const other = bodyModel === "male" ? "female" : "male";
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
      <span className="flex-1">
        {bodyModel === "male" ? t("explorer.structure.notInMale") : t("explorer.structure.notInFemale")}
      </span>
      <Button size="xs" variant="secondary" onClick={() => useWorkspace.getState().setBodyModel(other)}>
        {other === "male" ? t("explorer.structure.showInMale") : t("explorer.structure.showInFemale")}
      </Button>
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
  const spotlight = useWorkspace((s) => s.spotlight);
  const q = useStructure(structureId, audience);
  const { t } = useT();

  if (!structureId) {
    return (
      <div className="grid gap-3 p-4 text-sm text-muted-foreground">
        <MousePointerClick className="size-6 text-primary" />
        <p className="font-medium text-foreground">{t("explorer.structure.noneSelected")}</p>
        <p>{t("explorer.structure.noneSelectedHint")}</p>
        <ul className="list-inside list-disc text-xs">
          <li>{t("explorer.structure.tipCompare")}</li>
          <li>{t("explorer.structure.tipNavigate")}</li>
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
    return <p className="p-4 text-sm text-destructive">{t("explorer.structure.loadError")}</p>;
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
            <Badge variant="outline" className="text-[10px]">{t(`explorer.structure.laterality.${d.laterality}`)}</Badge>
          )}
          <VerificationBadge status={d.verification_status} />
        </div>
        {!meshIds.length && d.mesh_ids.length > 0 && <OtherBodyNotice />}
        {meshIds.some((m) => m.startsWith("ZAF-") || m.startsWith("FIT-")) && (
          <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
            {t("explorer.structure.fitted", {
              source: meshIds.some((m) => m.startsWith("ZAF-")) ? "Z-Anatomy (CC BY-SA 4.0)" : "BodyParts3D (CC BY 4.0)",
            })}
          </p>
        )}
        {meshIds.some((m) => m.startsWith("ZAM-")) && (
          <p className="text-[11px] text-muted-foreground">{t("explorer.structure.zAnatomy")}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.requestFocus(meshIds)}>
            <Crosshair /> {t("explorer.structure.focus")}
          </Button>
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.isolateMeshes(meshIds)}>
            <Focus /> {t("explorer.structure.isolate")}
          </Button>
          <Button
            size="sm"
            variant={spotlight ? "default" : "secondary"}
            aria-pressed={spotlight}
            disabled={!meshIds.length}
            onClick={() => ws.setSpotlight(!spotlight)}
            title={t("explorer.structure.spotlightTitle")}
          >
            <Lightbulb /> {t("explorer.structure.spotlight")}
          </Button>
          <Button size="sm" variant="secondary" disabled={!meshIds.length} onClick={() => ws.hideMeshes(meshIds)}>
            <EyeOff /> {t("explorer.structure.hide")}
          </Button>
        </div>
        {!d.has_geometry && (
          <p className="text-xs text-muted-foreground">{t("explorer.structure.noMesh")}</p>
        )}
        {multi.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("explorer.structure.moreInComparison", { count: multi.length })}
          </p>
        )}
      </header>

      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {t("explorer.structure.contentLevel")}
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as AudienceLevel)}
          className="h-7 rounded-md border border-input bg-input/30 px-1.5 text-xs text-foreground"
        >
          {AUDIENCES.map((v) => (
            <option key={v} value={v} className="bg-popover">
              {t(`explorer.structure.audiences.${v}`)}
            </option>
          ))}
        </select>
      </label>

      <Tabs key={d.id} defaultValue={d.simulations.length ? "function" : "bodymap"}>
        <TabsList className="h-auto w-full flex-wrap">
          <TabsTrigger value="function">{t("explorer.structure.tabs.function")}</TabsTrigger>
          <TabsTrigger value="bodymap">{t("explorer.structure.tabs.bodymap")}</TabsTrigger>
          <TabsTrigger value="overview">{t("explorer.structure.tabs.anatomy")}</TabsTrigger>
          <TabsTrigger value="relations">{t("explorer.structure.tabs.relations")}</TabsTrigger>
          <TabsTrigger value="clinical">{t("explorer.structure.tabs.clinical")}</TabsTrigger>
          <TabsTrigger value="sources">{t("explorer.structure.tabs.sources")}</TabsTrigger>
        </TabsList>

        <TabsContent value="function" className="pt-3">
          <FunctionPanel d={d} onSelect={onSelect} />
        </TabsContent>

        <TabsContent value="bodymap" className="pt-3">
          <BodyMapPanel structureId={d.id} onSelect={onSelect} />
        </TabsContent>

        <TabsContent value="overview" className="pt-3">
          <Overview d={d} />
        </TabsContent>

        <TabsContent value="relations" className="grid gap-4 pt-3">
          {d.parents.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("explorer.structure.partOf")}</h4>
              <div className="flex flex-wrap">{d.parents.map((p) => <StructureLink key={p.id} s={p} onSelect={onSelect} />)}</div>
            </section>
          )}
          {d.children.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("explorer.structure.parts", { count: d.children.length })}
              </h4>
              <div className="flex max-h-48 flex-wrap overflow-auto">
                {d.children.map((c) => <StructureLink key={c.id} s={c} onSelect={onSelect} />)}
              </div>
            </section>
          )}
          <RelationGroup title={t("explorer.structure.structural")} items={structural} onSelect={onSelect} />
          <RelationGroup title={t("explorer.structure.functional")} items={functional} onSelect={onSelect} />
          {!d.parents.length && !d.children.length && !d.relations.length && (
            <p className="text-sm text-muted-foreground">{t("explorer.structure.noRelations")}</p>
          )}
          {d.relations.some((r) => r.verification_status === "draft") && (
            <p className="text-[11px] text-muted-foreground">
              {t("explorer.structure.relationsDraft")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="clinical" className="grid gap-4 pt-3">
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("explorer.structure.pathology")}</h4>
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
              <p className="text-sm text-muted-foreground">{t("explorer.structure.noPathology")}</p>
            )}
          </section>
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("explorer.structure.simulations")}</h4>
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
              <p className="text-sm text-muted-foreground">{t("explorer.structure.noSimulations")}</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="sources" className="grid gap-4 pt-3">
          <section className="grid gap-1 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground">{t("explorer.structure.identitySource")}</span> {d.identity_source}
            </p>
            {d.xrefs.map((x) => (
              <p key={x.source}>
                <span className="text-foreground">{x.source}:</span> {x.code}
                {x.license && <> · {x.license}</>}
              </p>
            ))}
            {d.synonyms.length > 0 && (
              <p>
                <span className="text-foreground">{t("explorer.structure.synonyms")}</span>{" "}
                {d.synonyms.map((s) => `${s.synonym} (${s.kind})`).join("; ")}
              </p>
            )}
            <p>
              <span className="text-foreground">{t("explorer.structure.meshes")}</span> {d.mesh_ids.length}
            </p>
          </section>
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("explorer.structure.references")}</h4>
            <ReferenceList references={d.references} />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
