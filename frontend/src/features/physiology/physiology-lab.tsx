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
import { TimeSeriesChart } from "./time-series-chart";

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

function ModelRunner({ model }: { model: ModelDefinition }) {
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

  const changed = model.parameters.filter((p) => params[p.id] !== p.default);
  const series = result
    ? [
        ...(baseline ? [{ id: "baseline", label: "Pinned baseline", values: baseline.series.aortic_pressure }] : []),
        { id: "current", label: "Current", values: result.series.aortic_pressure, dashed: !!baseline },
      ]
    : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Parameters</CardTitle>
          <Button size="xs" variant="ghost" onClick={() => setParams(defaults)} disabled={!changed.length}>
            <RotateCcw /> Defaults
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
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
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
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
            <CardTitle className="text-sm">Output (final three beats at periodic steady state)</CardTitle>
            <div className="flex gap-2">
              {baseline ? (
                <Button size="sm" variant="ghost" onClick={() => setBaseline(null)}>Clear baseline</Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={!result} onClick={() => setBaseline(result)}>
                  Pin as baseline
                </Button>
              )}
              {model.linked_structure_ids.length > 0 && (
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    href={`/anatomy?structure=${encodeURIComponent(model.linked_structure_ids[0])}&highlight=${encodeURIComponent(model.linked_structure_ids.join(","))}`}
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
                <TimeSeriesChart title="Aortic pressure" unit="mmHg" time={result.time} series={series} />
                <TimeSeriesChart
                  title="Ventricular ejection into the aorta"
                  unit="mL/s"
                  time={result.time}
                  yMin={0}
                  series={[{ id: "q", label: "Ejection", values: result.series.aortic_inflow }]}
                />
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
