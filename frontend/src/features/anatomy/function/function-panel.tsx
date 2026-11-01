"use client";

import { Activity, ExternalLink, Loader2, Pause, Play, Square } from "lucide-react";
import { Link } from "@/lib/i18n/client";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EducationalDisclaimer, EvidenceBadge } from "@/features/governance/badges";
import { chartGroups } from "@/features/physiology/chart-groups";
import { ModelPhasePlot } from "@/features/physiology/phase-plot-chart";
import { TimeSeriesChart } from "@/features/physiology/time-series-chart";
import { useModels } from "@/lib/api/queries";
import type { ModelDefinition, StructureDetail } from "@/lib/api/types";

import { useWorkspace } from "../store";
import { playbackClock, sampleAt } from "./animation";
import { slowdown, SPEEDS } from "./playback-bar";
import { useFunctionPlayer } from "./use-function-player";

/** Parameters exposed in the panel; the Physiology Lab has the full set. */
const QUICK_PARAMETERS = 3;

function fmt(v: number): string {
  const a = Math.abs(v);
  return v.toFixed(a !== 0 && a < 1 ? 3 : a < 10 ? 2 : 1);
}

/** Value of a series at the playback clock, updated every frame without re-rendering. */
function LiveValue({ time, values }: { time: number[]; values: number[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = playbackClock.now();
      if (ref.current && t !== null) ref.current.textContent = fmt(sampleAt(time, values, t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [time, values]);
  return <span ref={ref} className="tabular-nums" />;
}

function ActivePlayback({ model }: { model: ModelDefinition }) {
  const playback = useWorkspace((s) => s.playback)!;
  const playing = useWorkspace((s) => s.playing);
  const speed = useWorkspace((s) => s.speed);
  const setPlaying = useWorkspace((s) => s.setPlaying);
  const setSpeed = useWorkspace((s) => s.setSpeed);
  const stop = useWorkspace((s) => s.stopPlayback);
  const { play, pending, error } = useFunctionPlayer();
  const [params, setParams] = useState(playback.parameters);

  // Re-run (debounced) when a quick parameter changes; playback keeps its phase.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void play(model.id, params), 250);
    return () => clearTimeout(t);
  }, [params, model.id, play]);

  const bound = new Set(model.animations.map((b) => b.output));
  const groups = chartGroups(model).filter((g) => g.series.some((s) => bound.has(s.id)));
  const outputs = model.series.filter((s) => bound.has(s.id));
  const slow = slowdown(playback.rate, playback.timeUnit) / speed;
  const phaseRuns = useMemo(
    () => [{ id: "current", label: "current", parameters: playback.parameters, series: playback.series }],
    [playback.parameters, playback.series],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => setPlaying(!playing)}>
          {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="secondary" onClick={stop}>
          <Square /> Stop
        </Button>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-input/30 px-1.5 text-xs"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s} className="bg-popover">
              {s}×
            </option>
          ))}
        </select>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Running model" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {Math.abs(slow - 1) < 0.01
          ? "Playing in real time."
          : slow > 1
            ? `Slowed ${Math.round(slow)}× so you can follow it.`
            : `Sped up ${(1 / slow).toFixed(1)}×.`}
      </p>

      <dl className="grid grid-cols-2 gap-2">
        {outputs.map((o) => (
          <div key={o.id} className="rounded-md border bg-card/60 p-2">
            <dt className="text-[11px] text-muted-foreground">{o.label}</dt>
            <dd className="text-base font-semibold">
              <LiveValue time={playback.time} values={playback.series[o.id] ?? []} />{" "}
              <span className="text-xs font-normal text-muted-foreground">{o.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      {groups.map((g) => (
        <TimeSeriesChart
          key={g.key}
          compact
          title={g.title}
          unit={g.unit}
          time={playback.time}
          timeUnit={playback.timeUnit}
          clock={playbackClock}
          series={g.series.map((s) => ({ id: s.id, label: s.label, values: playback.series[s.id] }))}
        />
      ))}

      {model.phase_plots.map((p) => (
        <ModelPhasePlot key={p.id} compact model={model} plot={p} time={playback.time} runs={phaseRuns}
          clock={playbackClock} />
      ))}

      <section className="grid gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try changing</h4>
        {model.parameters.slice(0, QUICK_PARAMETERS).map((p) => (
          <div key={p.id} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <label htmlFor={`fp-${p.id}`} title={p.description}>
                {p.label}
              </label>
              <span className="tabular-nums text-muted-foreground">
                {params[p.id]} <span className="text-xs">{p.unit}</span>
              </span>
            </div>
            <Slider
              id={`fp-${p.id}`}
              aria-label={`${p.label} (${p.unit})`}
              min={p.min}
              max={p.max}
              step={p.step ?? (p.max - p.min) / 100}
              value={[params[p.id]]}
              onValueChange={([v]) => setParams((s) => ({ ...s, [p.id]: +v.toFixed(4) }))}
            />
          </div>
        ))}
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error.message}
          </p>
        )}
      </section>

      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Results</h4>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {model.metrics.slice(0, 6).map((m) => (
            <div key={m.id} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
              <dt className="text-muted-foreground">{m.label}</dt>
              <dd className="tabular-nums">
                {playback.metrics[m.id] === undefined ? "–" : fmt(playback.metrics[m.id])} {m.unit}
              </dd>
            </div>
          ))}
        </dl>
        {playback.warnings.map((w) => (
          <p key={w} role="status" className="text-xs text-warning">
            {w}
          </p>
        ))}
      </section>
    </div>
  );
}

function ModelCard({ model, primary }: { model: ModelDefinition; primary: boolean }) {
  const playback = useWorkspace((s) => s.playback);
  const active = playback?.modelId === model.id;
  const { play, pending, error } = useFunctionPlayer();
  const animated = model.animations.length > 0;

  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <header className="grid gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{model.name}</h3>
          <EvidenceBadge evidence={model.evidence_class} />
        </div>
        <p className="text-xs text-muted-foreground">{model.summary}</p>
      </header>

      {active ? (
        <ActivePlayback key={model.id} model={model} />
      ) : animated ? (
        <Button size="sm" variant={primary ? "default" : "secondary"} disabled={pending} onClick={() => void play(model.id)}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />} Simulate in 3D
        </Button>
      ) : null}
      {error && !active && (
        <p role="alert" className="text-xs text-destructive">
          {error.message}
        </p>
      )}

      {animated && (
        <section className="grid gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What the 3D view shows</h4>
          <ul className="grid list-disc gap-1 pl-4 text-xs text-muted-foreground">
            {model.animations.map((b) => (
              <li key={`${b.output}-${b.effect}`}>{b.description}</li>
            ))}
          </ul>
        </section>
      )}

      <Button size="sm" variant="ghost" className="justify-self-start" asChild>
        <Link href={`/physiology?model=${encodeURIComponent(model.id)}`}>
          <ExternalLink /> Full model, equations and sources
        </Link>
      </Button>
      {primary && <EducationalDisclaimer text={model.disclaimer} />}
    </section>
  );
}

export function FunctionPanel({ d, onSelect }: { d: StructureDetail; onSelect: (id: string) => void }) {
  const models = useModels();
  const linked = useMemo(
    () =>
      d.simulations
        .map((s) => models.data?.find((m) => m.id === s.model_id))
        .filter((m): m is ModelDefinition => !!m),
    [d.simulations, models.data],
  );
  const entryPoints = useMemo(
    () => (models.data ?? []).filter((m) => m.animations.length && m.linked_structure_ids.length),
    [models.data],
  );

  if (models.isLoading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;

  if (!linked.length) {
    return (
      <div className="grid gap-3 text-sm">
        <div className="grid gap-2 rounded-md border border-dashed p-3 text-muted-foreground">
          <Activity className="size-5 text-primary" />
          <p>
            No function simulation is available for this structure yet. Each one needs a documented,
            tested model before it is shown, so none is invented here.
          </p>
        </div>
        {entryPoints.length > 0 && (
          <section className="grid gap-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available now</h4>
            {entryPoints.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.linked_structure_ids[0])}
                className="flex items-center gap-2 rounded-md border p-2 text-left hover:bg-accent"
              >
                <Play className="size-3.5 text-primary" />
                <span>{m.name}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {linked.map((m, i) => (
        <ModelCard key={m.id} model={m} primary={i === 0} />
      ))}
    </div>
  );
}
