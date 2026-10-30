"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, FlaskConical } from "lucide-react";
import Link from "next/link";
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
import { useCondition, useConditions, useModels } from "@/lib/api/queries";
import type { ConditionDetail, RunResult, Scenario } from "@/lib/api/types";
import { cn } from "@/lib/utils";

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
          <FlaskConical className="size-4 text-primary" /> Simulation: {scenario.title}
          <EvidenceBadge evidence="C" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          {scenario.description} Model: {model?.name ?? scenario.model_id}.
        </p>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {healthy && disease && model ? (
          <>
            <TimeSeriesChart
              title="Aortic pressure: reference vs scenario"
              unit="mmHg"
              time={healthy.time}
              series={[
                { id: "healthy", label: "Reference (model defaults)", values: healthy.series.aortic_pressure },
                { id: "scenario", label: "Scenario", values: disease.series.aortic_pressure, dashed: true },
              ]}
            />
            <MetricsGrid
              specs={model.metrics}
              primary={healthy}
              comparison={disease}
              primaryLabel="Reference"
              comparisonLabel="Scenario"
            />
          </>
        ) : (
          <Skeleton className="h-64" />
        )}
        <section className="grid gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenario assumptions</h4>
          <ul className="grid list-disc gap-1 pl-4 text-sm">
            {scenario.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/physiology?model=${encodeURIComponent(scenario.model_id)}`}>Explore the model</Link>
          </Button>
        </div>
        <EducationalDisclaimer text="Illustrates the direction and approximate size of change under the stated assumptions. It does not predict the course of disease in any individual." />
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
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">{c.category}</Badge>
            <EvidenceBadge evidence={c.evidence_class} />
            <VerificationBadge status={c.verification_status} />
          </div>
          <CardTitle className="text-lg">{c.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{c.summary}</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <section className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affected structures</h4>
            <div className="flex flex-wrap gap-1.5">
              {c.affected_structures.map((a) => (
                <Link
                  key={a.structure_id}
                  href={`/anatomy?structure=${encodeURIComponent(a.structure_id)}`}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  {a.name} <span className="text-muted-foreground">· {a.role}</span>
                </Link>
              ))}
            </div>
            {anatomyHref && (
              <Button asChild size="sm" className="justify-self-start">
                <Link href={anatomyHref}>
                  <Box /> Highlight affected anatomy in 3D
                </Link>
              </Button>
            )}
          </section>
          <Field title="Mechanism" text={c.mechanism} />
          <Field title="Anatomical changes" text={c.anatomical_changes} />
          <Field title="Physiological consequences" text={c.physiological_consequences} />
          <Field title="Clinical manifestations" text={c.clinical_manifestations} />
          <Field title="Complications" text={c.complications} />
          <Field title="Investigations" text={c.investigations} />
          <Field title="Management principles" text={c.management_principles} />
          <section className="grid gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">References</h4>
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
  const selected = params.get("condition") ?? list.data?.[0]?.id ?? null;
  const detail = useCondition(selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <nav aria-label="Conditions" className="grid h-fit gap-1">
        {list.isLoading && <Skeleton className="h-24" />}
        {list.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => router.replace(`/pathology?condition=${encodeURIComponent(c.id)}`)}
            aria-current={c.id === selected ? "true" : undefined}
            className={cn(
              "grid gap-0.5 rounded-md border p-3 text-left hover:bg-accent",
              c.id === selected && "border-primary/60 bg-primary/10",
            )}
          >
            <span className="text-sm font-medium">{c.name}</span>
            <span className="text-xs capitalize text-muted-foreground">{c.category}</span>
          </button>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          {list.data?.length ?? 0} educational models available. The full pathology catalogue
          (trauma, respiratory, neurological and more) is planned for Phase 5.
        </p>
      </nav>
      <div className="min-w-0">
        {detail.isLoading && <Skeleton className="h-96" />}
        {detail.isError && <p className="text-sm text-destructive">Could not load this condition.</p>}
        {detail.data && <ConditionView c={detail.data} />}
      </div>
    </div>
  );
}
