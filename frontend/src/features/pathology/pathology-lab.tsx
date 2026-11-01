"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, FlaskConical } from "lucide-react";
import { Link, useLocalePath } from "@/lib/i18n/client";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EducationalDisclaimer,
  EvidenceBadge,
  ReferenceList,
  VerificationBadge,
} from "@/features/governance/badges";
import { MetricsGrid } from "@/features/physiology/model-docs";
import { TimeSeriesChart } from "@/features/physiology/time-series-chart";
import { api } from "@/lib/api/client";
import { useCondition, useConditions, useModels, useSystems } from "@/lib/api/queries";
import type { ConditionDetail, RunResult, Scenario } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** A condition's category is a body-system id; show the system's (translated) name. */
function useCategoryName(): (category: string) => string {
  const systems = useSystems();
  return (category) => systems.data?.find((s) => s.id === category)?.name ?? category;
}

function Field({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="grid gap-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="text-sm leading-relaxed">{text}</p>
    </section>
  );
}

function ScenarioComparison({ scenario }: { scenario: Scenario }) {
  const models = useModels();
  const { t } = useT();
  const model = models.data?.find((m) => m.id === scenario.model_id);
  // Two independent runs (reference and scenario); deterministic, so cache per scenario.
  const runQuery = (scenarioId: string | null) => ({
    queryKey: ["simulation-run", scenario.model_id, scenarioId] as const,
    queryFn: () =>
      api<RunResult>(`/simulations/models/${encodeURIComponent(scenario.model_id)}/run`, {
        method: "POST",
        json: { parameters: {}, scenario_id: scenarioId },
      }),
    staleTime: Infinity,
  });
  const reference = useQuery(runQuery(null));
  const altered = useQuery(runQuery(scenario.id));
  const healthy = reference.data;
  const disease = altered.data;
  const error = reference.error ?? altered.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <FlaskConical className="size-4 text-primary" /> {t("labs.pathology.simulation", { title: scenario.title })}
          <EvidenceBadge evidence="C" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          {scenario.description} {t("labs.pathology.model", { name: model?.name ?? scenario.model_id })}
        </p>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {healthy && disease && model ? (
          <>
            <TimeSeriesChart
              title={t("labs.pathology.aorticTitle")}
              unit="mmHg"
              time={healthy.time}
              series={[
                { id: "healthy", label: t("labs.pathology.referenceDefaults"), values: healthy.series.aortic_pressure },
                { id: "scenario", label: t("labs.pathology.scenario"), values: disease.series.aortic_pressure, dashed: true },
              ]}
            />
            <MetricsGrid
              specs={model.metrics}
              primary={healthy}
              comparison={disease}
              primaryLabel={t("labs.pathology.reference")}
              comparisonLabel={t("labs.pathology.scenario")}
            />
          </>
        ) : (
          <Skeleton className="h-64" />
        )}
        <section className="grid gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.pathology.assumptions")}</h4>
          <ul className="grid list-disc gap-1 pl-4 text-sm">
            {scenario.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/physiology?model=${encodeURIComponent(scenario.model_id)}`}>{t("labs.pathology.explore")}</Link>
          </Button>
        </div>
        <EducationalDisclaimer text={t("labs.pathology.disclaimer")} />
      </CardContent>
    </Card>
  );
}

function ConditionView({ c }: { c: ConditionDetail }) {
  const primary = c.affected_structures.find((a) => a.role === "primary") ?? c.affected_structures[0];
  const anatomyHref = primary
    ? `/anatomy?structure=${encodeURIComponent(primary.structure_id)}&highlight=${encodeURIComponent(
        c.affected_structures.map((a) => a.structure_id).join(","),
      )}`
    : null;
  const { t } = useT();
  const categoryName = useCategoryName();
  const role = (r: string) => (r === "primary" || r === "secondary" ? t(`labs.pathology.roles.${r}`) : r);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{categoryName(c.category)}</Badge>
            <EvidenceBadge evidence={c.evidence_class} />
            <VerificationBadge status={c.verification_status} />
          </div>
          <CardTitle className="text-lg">{c.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{c.summary}</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.pathology.affected")}</h4>
            <div className="flex flex-wrap gap-1.5">
              {c.affected_structures.map((a) => (
                <Link
                  key={a.structure_id}
                  href={`/anatomy?structure=${encodeURIComponent(a.structure_id)}`}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  {a.name} <span className="text-muted-foreground">· {role(a.role)}</span>
                </Link>
              ))}
            </div>
            {anatomyHref && (
              <Button asChild size="sm" className="justify-self-start">
                <Link href={anatomyHref}>
                  <Box /> {t("labs.pathology.highlight")}
                </Link>
              </Button>
            )}
          </section>
          <Field title={t("labs.pathology.fields.mechanism")} text={c.mechanism} />
          <Field title={t("labs.pathology.fields.anatomical_changes")} text={c.anatomical_changes} />
          <Field title={t("labs.pathology.fields.physiological_consequences")} text={c.physiological_consequences} />
          <Field title={t("labs.pathology.fields.clinical_manifestations")} text={c.clinical_manifestations} />
          <Field title={t("labs.pathology.fields.complications")} text={c.complications} />
          <Field title={t("labs.pathology.fields.investigations")} text={c.investigations} />
          <Field title={t("labs.pathology.fields.management_principles")} text={c.management_principles} />
          <section className="grid gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.pathology.references")}</h4>
            <ReferenceList references={c.references} />
          </section>
        </CardContent>
      </Card>
      {c.scenarios.map((s) => (
        <ScenarioComparison key={s.id} scenario={s} />
      ))}
    </div>
  );
}

export function PathologyLab() {
  const list = useConditions();
  const params = useSearchParams();
  const router = useRouter();
  const lp = useLocalePath();
  const selected = params.get("condition") ?? list.data?.[0]?.id ?? null;
  const detail = useCondition(selected);
  const { t, tp } = useT();
  const categoryName = useCategoryName();

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <nav aria-label={t("labs.pathology.conditions")} className="grid h-fit gap-1">
        {list.isLoading && <Skeleton className="h-24" />}
        {list.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => router.replace(lp(`/pathology?condition=${encodeURIComponent(c.id)}`))}
            aria-current={c.id === selected ? "true" : undefined}
            className={cn(
              "grid gap-0.5 rounded-md border p-3 text-left hover:bg-accent",
              c.id === selected && "border-primary/60 bg-primary/10",
            )}
          >
            <span className="text-sm font-medium">{c.name}</span>
            <span className="text-xs text-muted-foreground">{categoryName(c.category)}</span>
          </button>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          {tp("labs.pathology.catalogue", list.data?.length ?? 0)}
        </p>
      </nav>
      <div className="min-w-0">
        {detail.isLoading && <Skeleton className="h-96" />}
        {detail.isError && <p className="text-sm text-destructive">{t("labs.pathology.loadError")}</p>}
        {detail.data && <ConditionView c={detail.data} />}
      </div>
    </div>
  );
}
