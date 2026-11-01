"use client";

import { ChevronRight, Pause, Play, RotateCcw, X, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { RunResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { createGrowth, STAGES } from "./growth";
import { PROCESSES, type ProcessId } from "./processes";
import {
  advance,
  type CircuitState,
  DEMO_CIRCUIT,
  extractSpikeShape,
  initialState,
  stimulate,
  V_THRESHOLD,
} from "./signalling";

const SignallingScene = dynamic(() => import("./signalling-scene").then((m) => m.SignallingScene), { ssr: false });
const GrowthScene = dynamic(() => import("./growth-scene").then((m) => m.GrowthScene), { ssr: false });

/** Simulated milliseconds per real second at 1× (neural signalling): slowed 200×. */
const SIGNAL_MS_PER_S = 5;
const SPEEDS = [0.25, 0.5, 1, 2];

function Trace({ points, label, color }: { points: { t: number; v: number }[]; label: string; color: string }) {
  const W = 220;
  const H = 46;
  if (points.length < 2) return null;
  const t1 = points[points.length - 1].t;
  const t0 = t1 - 60;
  const x = (t: number) => ((t - t0) / 60) * W;
  const y = (v: number) => H - ((Math.min(40, Math.max(-80, v)) + 80) / 120) * H;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  return (
    <figure className="grid gap-0.5">
      <figcaption className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{points[points.length - 1].v.toFixed(0)} mV</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label} membrane potential, last 60 ms`}>
        <line x1={0} x2={W} y1={y(V_THRESHOLD)} y2={y(V_THRESHOLD)} stroke="currentColor" strokeDasharray="2 3" className="text-muted-foreground/50" />
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    </figure>
  );
}

interface Snapshot {
  t: number;
  traces: Record<string, { t: number; v: number }[]>;
}

function snapshot(s: CircuitState): Snapshot {
  return { t: s.t, traces: Object.fromEntries(Object.entries(s.neurons).map(([k, n]) => [k, [...n.trace]])) };
}

function SignallingStage({ playing, speed }: { playing: boolean; speed: number }) {
  const state = useRef<CircuitState>(initialState(DEMO_CIRCUIT));
  const [myelinated, setMyelinated] = useState(true);
  const [background, setBackground] = useState(true);
  const [snap, setSnap] = useState<Snapshot>(() => ({ t: 0, traces: {} }));
  const [hovered, setHovered] = useState<string | null>(null);
  const shape = useRef<{ t: number[]; v: number[] } | null>(null);

  // Spike waveform from the server-side Hodgkin–Huxley model (a real model output).
  useEffect(() => {
    api<RunResult>("/simulations/models/neuro.hodgkin_huxley/run", { method: "POST", json: { parameters: {} } })
      .then((r) => (shape.current = extractSpikeShape(r.time, r.series.membrane_potential)))
      .catch(() => (shape.current = null));
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        advance(DEMO_CIRCUIT, state.current, dt * SIGNAL_MS_PER_S * speed, {
          myelinated: myelinated ? undefined : false,
          background,
          spikeShape: shape.current,
        });
      }
      if (now - lastUi > 80) {
        lastUi = now;
        setSnap(snapshot(state.current));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, myelinated, background]);

  const fire = useCallback((id: string) => stimulate(state.current, id), []);
  const colors: Record<string, string> = { a: "#5ea8ff", b: "#5ea8ff", i: "#f2a93b", c: "#7fe6f0", d: "#9b7cf0" };

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[1fr_17rem]">
      <div className="relative min-h-[18rem]">
        <SignallingScene circuit={DEMO_CIRCUIT} state={state} myelinated={myelinated} onStimulate={fire} onHover={setHovered} />
        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/80 px-2 py-1 text-xs">{hovered} · click to fire</div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
          Click a cell body to stimulate it · drag to rotate · t = {snap.t.toFixed(1)} ms (slowed {Math.round(1000 / (SIGNAL_MS_PER_S * speed))}×)
        </div>
      </div>
      <aside className="grid content-start gap-3 overflow-auto border-t p-3 lg:border-l lg:border-t-0">
        <div className="flex flex-wrap gap-1.5">
          <Button size="xs" variant="secondary" onClick={() => (fire("a"), fire("b"))}>
            <Zap /> Fire A + B together
          </Button>
          <Button size="xs" variant="ghost" onClick={() => fire("a")}>
            Fire A only
          </Button>
          <Button size="xs" variant="ghost" onClick={() => (fire("i"), setTimeout(() => (fire("a"), fire("b")), 150))}>
            Inhibit, then A + B
          </Button>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs">
          Myelinated axons
          <input type="checkbox" checked={myelinated} onChange={(e) => setMyelinated(e.target.checked)} className="accent-primary" />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          Background activity
          <input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} className="accent-primary" />
        </label>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]" aria-label="Cells">
          {DEMO_CIRCUIT.neurons.map((n) => (
            <li key={n.id} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: colors[n.id] }} aria-hidden />
              {n.label}
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          {DEMO_CIRCUIT.neurons.map((n) => (
            <Trace key={n.id} label={n.label} color={colors[n.id]} points={snap.traces[n.id] ?? []} />
          ))}
          <p className="text-[10px] text-muted-foreground">Dashed line: firing threshold (−55 mV).</p>
        </div>
        <ul className="grid gap-1 text-[11px] text-muted-foreground">
          <li><span className="text-[#fff3b0]">●</span> action potential travelling along the axon (jumps node to node when myelinated)</li>
          <li><span className="text-[#7cf29a]">●</span> excitatory transmitter · <span className="text-[#f27c7c]">●</span> inhibitory transmitter</li>
        </ul>
      </aside>
    </div>
  );
}

function GrowthStage({ playing, speed, seed }: { playing: boolean; speed: number; seed: number }) {
  const [grower] = useState(() => createGrowth(seed));
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (grower.state.stage === "mature" && grower.state.step > 200) return;
      grower.step();
      setVersion((v) => v + 1);
    }, 90 / speed);
    return () => clearInterval(id);
  }, [playing, speed, grower]);
  const st = grower.state;
  const stageIndex = STAGES.findIndex((x) => x.id === st.stage);
  const live = st.synapses.filter((x) => !x.pruned).length;
  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[1fr_17rem]">
      <div className="relative min-h-[18rem]">
        <GrowthScene state={st} version={version} />
      </div>
      <aside className="grid content-start gap-3 overflow-auto border-t p-3 lg:border-l lg:border-t-0">
        <ol className="grid gap-1.5">
          {STAGES.map((x, i) => (
            <li key={x.id} className={cn("rounded-md border p-2", i === stageIndex ? "border-primary/60 bg-primary/10" : i < stageIndex ? "opacity-60" : "opacity-40")}>
              <p className="text-xs font-medium">{x.label}</p>
              {i === stageIndex && <p className="text-[11px] text-muted-foreground">{x.detail}</p>}
            </li>
          ))}
        </ol>
        <p className="text-xs tabular-nums text-muted-foreground">
          Synapses: {live} active{st.synapses.length - live ? `, ${st.synapses.length - live} pruned` : ""}
        </p>
        <ul className="grid gap-1 text-[11px] text-muted-foreground">
          <li><span className="text-[#fff3b0]">●</span> growth cone · thick line: axon · thin lines: dendrites</li>
          <li><span className="text-[#7cf29a]">●</span> synapse · grey: pruned</li>
        </ul>
      </aside>
    </div>
  );
}

/** Full-viewer overlay for a cell-scale process, keeping the place in the head on screen. */
export function ProcessStage({ id, onClose }: { id: ProcessId; onClose: () => void }) {
  const meta = useMemo(() => PROCESSES.find((p) => p.id === id)!, [id]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  return (
    <section aria-label={meta.title} className="absolute inset-0 z-20 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <nav aria-label="Location" className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
          {meta.breadcrumb.map((b) => (
            <span key={b} className="flex items-center gap-1">
              {b}
              <ChevronRight className="size-3" aria-hidden />
            </span>
          ))}
          <span className="truncate font-medium text-foreground">{meta.title}</span>
        </nav>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setResetKey((k) => k + 1)}>
            <RotateCcw /> Reset
          </Button>
          <select
            aria-label="Speed"
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
          <Button size="icon-sm" variant="ghost" aria-label="Back to the head" onClick={onClose}>
            <X />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {/* Reset remounts the lab with fresh state. */}
        {id === "signalling" ? (
          <SignallingStage key={resetKey} playing={playing} speed={speed} />
        ) : (
          <GrowthStage key={resetKey} seed={resetKey + 1} playing={playing} speed={speed} />
        )}
      </div>
      <footer className="border-t px-3 py-2 text-[11px] text-muted-foreground">{meta.basis}</footer>
    </section>
  );
}
