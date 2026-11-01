"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EducationalDisclaimer } from "@/features/governance/badges";
import { api, errorDetails } from "@/lib/api/client";
import { useModels, useRunSimulation } from "@/lib/api/queries";
import type { ModelDefinition, Reference, RunResult } from "@/lib/api/types";

import { MetricsGrid, ModelDocs } from "./model-docs";
import { chartGroups, type ChartGroup } from "./chart-groups";
import type { PhaseRun } from "./phase-plot";
import { ModelPhasePlot } from "./phase-plot-chart";
import { TimeSeriesChart, type ChartSeries } from "./time-series-chart";

export function useReferences() {
  return useQuery({
    queryKey: ["references"],
    queryFn: () => api<Reference[]>("/references"),
    staleTime: 5 * 60_000,
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Where "Linked anatomy in 3D" points: the structure to frame, others to highlight and
 * the model to play (when it drives a 3D animation). */
export interface LinkedAnatomy {
  structure: string;
  highlight: string[];
  play: string | null;
}

export function linkedAnatomy(model: ModelDefinition): LinkedAnatomy | null {
  if (!model.linked_structure_ids.length) return null;
  return {
    structure: model.linked_structure_ids[0],
    highlight: model.linked_structure_ids,
    play: model.animations.length ? model.id : null,
  };
}

export function ModelRunner({
  model,
  onLinkedAnatomy,
}: {
  model: ModelDefinition;
  /** Show the linked anatomy in place (lab pane) instead of opening the 3D explorer. */
  onLinkedAnatomy?: (link: LinkedAnatomy) => void;
}) {
  const defaults = useMemo(
    () => Object.fromEntries(model.parameters.map((p) => [p.id, p.default])),
    [model],
  );
  const [params, setParams] = useState<Record<string, number>>(defaults);
  const [baseline, setBaseline] = useState<RunResult | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const run = useRunSimulation();
  const debounced = useDebounced(params, 250);
  const refs = useReferences();

  useEffect(() => {
    run.mutate(
      { modelId: model.id, parameters: debounced },
      { onSuccess: setResult },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run is stable per mutation
  }, [debounced, model.id]);

  const phaseRuns = useMemo<PhaseRun[]>(() => {
    if (!result) return [];
    const current = { id: "current", label: "current", parameters: result.parameters, series: result.series };
    return baseline
      ? [{ id: "baseline", label: "baseline", parameters: baseline.parameters, series: baseline.series },
         { ...current, dashed: true }]
      : [current];
  }, [result, baseline]);

  const changed = model.parameters.filter((p) => params[p.id] !== p.default);
  const groups = useMemo(() => chartGroups(model), [model]);
  const link = linkedAnatomy(model);
  // With a pinned baseline, each chart compares the baseline and current run of its
  // first series (two series per chart keeps the comparison readable).
  const seriesFor = (g: ChartGroup, r: RunResult): ChartSeries[] =>
    baseline
      ? [
          { id: "baseline", label: `${g.series[0].label}: baseline`, values: baseline.series[g.series[0].id] },
          { id: "current", label: `${g.series[0].label}: current`, values: r.series[g.series[0].id], dashed: true },
        ]
      : g.series.map((s) => ({ id: s.id, label: s.label, values: r.series[s.id] }));

  return (
    // Container queries: the runner lays out by the space it is given (full page or a
    // learning module's lab pane), not by the window width.
    <div className="@container">
    <div className="grid gap-4 @4xl:grid-cols-[20rem_1fr]">
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Parameters</CardTitle>
          <Button size="xs" variant="ghost" onClick={() => setParams(defaults)} disabled={!changed.length}>
            <RotateCcw /> Defaults
          </Button>
        </CardHeader>
        {/* Stacked above the output (narrow host): sliders flow in two columns. */}
        <CardContent className="grid gap-4 @lg:@max-4xl:grid-cols-2 @lg:@max-4xl:gap-x-6">
          {model.parameters.map((p) => (
            <div key={p.id} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <label htmlFor={`p-${p.id}`} title={p.description}>
                  {p.label}
                </label>
                <span className="tabular-nums text-muted-foreground">
                  {params[p.id]} <span className="text-xs">{p.unit}</span>
                </span>
              </div>
              <Slider
                id={`p-${p.id}`}
                aria-label={`${p.label} (${p.unit})`}
                min={p.min}
                max={p.max}
                step={p.step ?? (p.max - p.min) / 100}
                value={[params[p.id]]}
                onValueChange={([v]) => setParams((s) => ({ ...s, [p.id]: +v.toFixed(4) }))}
              />
            </div>
          ))}
          {run.error && (
            <p role="alert" className="col-span-full rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {run.error.message}
              {errorDetails(run.error).map((m) => (
                <span key={m} className="block">{m}</span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">Model output</CardTitle>
            <div className="flex gap-2">
              {baseline ? (
                <Button size="sm" variant="ghost" onClick={() => setBaseline(null)}>Clear baseline</Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={!result} onClick={() => setBaseline(result)}>
                  Pin as baseline
                </Button>
              )}
              {link && onLinkedAnatomy && (
                <Button size="sm" variant="ghost" onClick={() => onLinkedAnatomy(link)}>
                  <Box /> {link.play ? "Watch it in 3D" : "Linked anatomy in 3D"}
                </Button>
              )}
              {link && !onLinkedAnatomy && (
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    href={`/anatomy?structure=${encodeURIComponent(link.structure)}&highlight=${encodeURIComponent(link.highlight.join(","))}${link.play ? `&play=${encodeURIComponent(link.play)}` : ""}`}
                  >
                    <Box /> Linked anatomy in 3D
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            {!result ? (
              <Skeleton className="h-64" />
            ) : (
              <>
                {groups.map((g) => (
                  <TimeSeriesChart
                    key={g.key}
                    title={g.title}
                    unit={g.unit}
                    time={result.time}
                    timeUnit={model.time_unit}
                    series={seriesFor(g, result)}
                  />
                ))}
                {model.phase_plots.map((p) => (
                  <ModelPhasePlot key={p.id} model={model} plot={p} time={result.time} runs={phaseRuns} />
                ))}
                {result.warnings.map((w) => (
                  <p key={w} role="status" className="text-xs text-warning">{w}</p>
                ))}
                <MetricsGrid
                  specs={model.metrics}
                  primary={baseline ?? result}
                  comparison={baseline ? result : undefined}
                  primaryLabel={baseline ? "Baseline" : "Value"}
                  comparisonLabel="Current"
                />
              </>
            )}
            <EducationalDisclaimer text={model.disclaimer} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Model documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelDocs
              model={model}
              references={(refs.data ?? []).filter((r) => model.reference_ids.includes(r.id))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}

export function PhysiologyLab() {
  const models = useModels();
  const params = useSearchParams();
  const requested = params.get("model");
  if (models.isLoading) return <Skeleton className="h-96" />;
  if (models.isError || !models.data?.length) {
    return <p className="text-sm text-destructive">Could not load simulation models.</p>;
  }
  const initial = models.data.find((m) => m.id === requested)?.id ?? models.data[0].id;
  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        {models.data.map((m) => (
          <TabsTrigger key={m.id} value={m.id}>{m.name}</TabsTrigger>
        ))}
      </TabsList>
      {models.data.map((m) => (
        <TabsContent key={m.id} value={m.id} className="pt-4">
          <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{m.summary}</p>
          <ModelRunner model={m} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
