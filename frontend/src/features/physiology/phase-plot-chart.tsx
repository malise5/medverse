"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { ModelDefinition, PhasePlot } from "@/lib/api/types";

import { arrowIndices, clipLine, nearestIndex, phaseDomain, pointAt, resolvePhasePlot, type PhaseRun } from "./phase-plot";
import { fmt, niceTicks, SERIES_COLORS, type PlaybackClock } from "./time-series-chart";

export interface PhaseCurve {
  id: string;
  label: string;
  xs: number[];
  ys: number[];
  dashed?: boolean;
}

/** y = slope · (x − x0), drawn thin and dashed in the colour of the curve it belongs to. */
export interface PhaseLine {
  id: string;
  label: string;
  slope: number;
  x0: number;
  /** Index of the curve whose colour the line takes. */
  curve: number;
  /** Shown under the chart; lines sharing a description are explained once. */
  description?: string;
}

export interface Axis {
  label: string;
  unit: string;
}

const M = { top: 14, right: 18, bottom: 34, left: 50 };

/**
 * One series against another (e.g. LV pressure against LV volume), drawn as a
 * parametric curve in time order with direction arrows. Reference lines are straight
 * relationships declared by the model. Curve colours follow the time-series charts.
 */
export function PhasePlotChart({
  title,
  description,
  x,
  y,
  time,
  timeUnit = "s",
  curves,
  lines = [],
  xMin = null,
  yMin = null,
  clock,
  compact = false,
}: {
  title: string;
  description: string;
  x: Axis;
  y: Axis;
  time: number[];
  timeUnit?: "s" | "ms";
  curves: PhaseCurve[];
  lines?: PhaseLine[];
  xMin?: number | null;
  yMin?: number | null;
  /** When given, a dot follows the clock along the first curve (3D function playback). */
  clock?: PlaybackClock;
  compact?: boolean;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const [hover, setHover] = useState<{ curve: number; i: number } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const W = compact ? 400 : 640;
  const H = compact ? 300 : 360;

  const g = useMemo(() => {
    const d = phaseDomain(curves, xMin, yMin);
    const xt = niceTicks(d.x0, d.x1, compact ? 4 : 6);
    const yt = niceTicks(d.y0, d.y1, 5);
    const sx = (v: number) => M.left + ((v - d.x0) / (d.x1 - d.x0 || 1)) * (W - M.left - M.right);
    const sy = (v: number) => H - M.bottom - ((v - d.y0) / (d.y1 - d.y0 || 1)) * (H - M.top - M.bottom);
    const paths = curves.map((c) =>
      c.xs.map((v, i) => `${i ? "L" : "M"}${sx(v).toFixed(1)},${sy(c.ys[i]).toFixed(1)}`).join(""),
    );
    const arrows = curves.map((c) => {
      const px = c.xs.map(sx);
      const py = c.ys.map(sy);
      return arrowIndices(px, py, 3, compact ? 40 : 60).map((i) => ({
        x: px[i],
        y: py[i],
        deg: (Math.atan2(py[i + 3] - py[i], px[i + 3] - px[i]) * 180) / Math.PI,
      }));
    });
    const segs = lines.flatMap((l) => {
      const s = clipLine(l.slope, l.x0, d);
      return s ? [{ line: l, a: [sx(s[0][0]), sy(s[0][1])], b: [sx(s[1][0]), sy(s[1][1])] }] : [];
    });
    return { d, sx, sy, xt: xt.filter((t) => t >= d.x0 && t <= d.x1), yt: yt.filter((t) => t >= d.y0 && t <= d.y1), paths, arrows, segs };
  }, [curves, lines, xMin, yMin, W, H, compact]);

  // Move the playback dot outside React rendering: it updates every animation frame.
  useEffect(() => {
    if (!clock || !curves.length) return;
    let raf = 0;
    const c = curves[0];
    const tick = () => {
      const t = clock.now();
      const el = dotRef.current;
      if (el) {
        el.style.display = t === null ? "none" : "";
        if (t !== null) {
          const [px, py] = pointAt(time, c.xs, c.ys, t);
          el.setAttribute("cx", String(g.sx(px)));
          el.setAttribute("cy", String(g.sy(py)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, curves, time, g]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    if (px < M.left || px > W - M.right || py < M.top || py > H - M.bottom) return setHover(null);
    let best: { curve: number; i: number; dist: number } | null = null;
    curves.forEach((c, ci) => {
      const i = nearestIndex(c.xs, c.ys, px, py, (a, b) => [g.sx(a), g.sy(b)]);
      if (i < 0) return;
      const dist = (g.sx(c.xs[i]) - px) ** 2 + (g.sy(c.ys[i]) - py) ** 2;
      if (!best || dist < best.dist) best = { curve: ci, i, dist };
    });
    setHover(best);
  }

  const hc = hover ? curves[hover.curve] : null;
  const hx = hover && hc ? g.sx(hc.xs[hover.i]) : null;
  const hy = hover && hc ? g.sy(hc.ys[hover.i]) : null;
  const notes = [
    ...new Map(lines.filter((l) => l.description).map((l) => [l.description!, l.label.split(" (")[0]])),
  ].map(([text, name]) => [name, text] as const);
  const labelFor = (c: PhaseCurve) => (curves.length > 1 ? c.label : title);

  return (
    <figure className="grid gap-2" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-sm font-medium">
          {title}
        </figcaption>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
          {curves.length > 1 &&
            curves.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="18" y2="3" stroke={SERIES_COLORS[i]} strokeWidth="2"
                    strokeDasharray={c.dashed ? "4 3" : undefined} />
                </svg>
                {c.label}
              </li>
            ))}
          {lines.length > 0 && (
            <li className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="1 3" />
              </svg>
              Reference lines (from parameters)
            </li>
          )}
        </ul>
      </div>
      <p id={`${id}-d`} className="text-xs text-muted-foreground">{description}</p>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={`${y.label} against ${x.label}. Use the data table for exact values.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
            </clipPath>
          </defs>
          {g.yt.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={W - M.right} y1={g.sy(t)} y2={g.sy(t)} stroke="currentColor" className="text-border" />
              <text x={M.left - 6} y={g.sy(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px]">
                {t}
              </text>
            </g>
          ))}
          {g.xt.map((t) => (
            <g key={`x${t}`}>
              <line x1={g.sx(t)} x2={g.sx(t)} y1={M.top} y2={H - M.bottom} stroke="currentColor" className="text-border/60" />
              <text x={g.sx(t)} y={H - M.bottom + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {t}
              </text>
            </g>
          ))}
          <text x={W - M.right} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {x.label} ({x.unit})
          </text>
          <text x={M.left} y={M.top - 4} className="fill-muted-foreground text-[10px]">
            {y.label} ({y.unit})
          </text>

          <g clipPath={`url(#${id}-clip)`}>
            {g.segs.map(({ line, a, b }) => (
              <g key={line.id} style={{ color: SERIES_COLORS[line.curve] }}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth="1.25"
                  strokeDasharray="1 3" strokeLinecap="round" opacity={0.85} />
                <text x={b[0] - 4} y={b[1] + (b[1] < M.top + 12 ? 12 : -5)} textAnchor="end"
                  className="text-[10px] font-medium" fill="currentColor">
                  {line.label}
                </text>
              </g>
            ))}
            {g.paths.map((d, i) => (
              <path key={curves[i].id} d={d} fill="none" stroke={SERIES_COLORS[i]} strokeWidth="2"
                strokeLinejoin="round" strokeDasharray={curves[i].dashed ? "6 4" : undefined} />
            ))}
            {g.arrows.map((list, ci) =>
              list.map((a) => (
                <path key={`${curves[ci].id}-${a.x}-${a.y}`} d="M-5,-4 L3,0 L-5,4 Z" fill={SERIES_COLORS[ci]}
                  transform={`translate(${a.x},${a.y}) rotate(${a.deg})`} aria-hidden />
              )),
            )}
          </g>
          {clock && (
            <circle ref={dotRef} r="5" fill="var(--foreground)" stroke={SERIES_COLORS[0]} strokeWidth="2.5"
              style={{ display: "none" }} />
          )}
          {hover && hc && hx !== null && hy !== null && (
            <circle cx={hx} cy={hy} r="4" fill={SERIES_COLORS[hover.curve]} stroke="var(--card)" strokeWidth="2"
              pointerEvents="none" />
          )}
        </svg>
        {hover && hc && hx !== null && hy !== null && (
          <div
            className="pointer-events-none absolute rounded-md border bg-popover/95 px-2 py-1 text-xs shadow"
            style={{
              left: `${(hx / W) * 100}%`,
              top: `${(hy / H) * 100}%`,
              transform: `translate(${hx > W * 0.6 ? "calc(-100% - 10px)" : "10px"}, ${hy > H * 0.5 ? "calc(-100% - 6px)" : "6px"})`,
            }}
          >
            <p className="text-muted-foreground">
              {labelFor(hc)} · t = {time[hover.i].toFixed(3)} {timeUnit}
            </p>
            <p className="tabular-nums">{x.label}: {fmt(hc.xs[hover.i])} {x.unit}</p>
            <p className="tabular-nums">{y.label}: {fmt(hc.ys[hover.i])} {y.unit}</p>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} className="justify-self-start text-xs text-primary hover:underline">
        {showTable ? "Hide" : "Show"} data table
      </button>
      {showTable && (
        <div className="max-h-48 overflow-auto rounded border">
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">{title}, every tenth sample</caption>
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-2 py-1 text-left">t ({timeUnit})</th>
                {curves.map((c) => (
                  <th key={c.id} colSpan={2} className="px-2 py-1 text-right">
                    {curves.length > 1 ? `${c.label}: ` : ""}{x.label} ({x.unit}), {y.label} ({y.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {time.map((t, i) =>
                i % 10 === 0 ? (
                  <tr key={i} className="odd:bg-muted/30">
                    <td className="px-2">{t.toFixed(3)}</td>
                    {curves.map((c) => [
                      <td key={`${c.id}x`} className="px-2 text-right">{fmt(c.xs[i])}</td>,
                      <td key={`${c.id}y`} className="px-2 text-right">{fmt(c.ys[i])}</td>,
                    ])}
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}
      {!compact && notes.length > 0 && (
        <dl className="grid gap-1 text-xs text-muted-foreground">
          {notes.map(([name, text]) => (
            <div key={name}>
              <dt className="inline font-medium text-foreground">{name}: </dt>
              <dd className="inline">{text}</dd>
            </div>
          ))}
        </dl>
      )}
    </figure>
  );
}

/** A model-declared phase plot over one run, or a baseline and a current run. */
export function ModelPhasePlot({
  model,
  plot,
  time,
  runs,
  clock,
  compact,
}: {
  model: Pick<ModelDefinition, "series" | "time_unit">;
  plot: PhasePlot;
  time: number[];
  runs: PhaseRun[];
  clock?: PlaybackClock;
  compact?: boolean;
}) {
  const { curves, lines } = useMemo(() => resolvePhasePlot(plot, runs), [plot, runs]);
  const spec = (sid: string) => model.series.find((s) => s.id === sid);
  const axis = (sid: string): Axis => ({ label: spec(sid)?.label ?? sid, unit: spec(sid)?.unit ?? "" });
  return (
    <PhasePlotChart
      title={plot.title}
      description={plot.description}
      x={axis(plot.x)}
      y={axis(plot.y)}
      time={time}
      timeUnit={model.time_unit}
      curves={curves}
      lines={lines}
      xMin={plot.x_min}
      yMin={plot.y_min}
      clock={clock}
      compact={compact}
    />
  );
}
