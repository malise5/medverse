"use client";

import { useId, useMemo, useRef, useState } from "react";

/**
 * Single-axis line chart (one measure per chart; compare measures with stacked small
 * multiples, never a dual axis). Series colours were validated for the dark surface
 * with the dataviz palette validator: #3987e5 / #d95926 (CVD ΔE 26.8).
 */
export const SERIES_COLORS = ["#3987e5", "#d95926"] as const;

export interface ChartSeries {
  id: string;
  label: string;
  values: number[];
  dashed?: boolean;
}

const W = 640;
const H = 200;
const M = { top: 12, right: 16, bottom: 28, left: 48 };

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function TimeSeriesChart({
  title,
  unit,
  time,
  series,
  yMin,
}: {
  title: string;
  unit: string;
  time: number[];
  series: ChartSeries[];
  yMin?: number;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { x, y, yTicks, xTicks, paths } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const lo = yMin ?? Math.min(...all);
    const hi = Math.max(...all);
    const yt = niceTicks(lo, hi);
    const y0 = Math.min(lo, yt[0]);
    const y1 = Math.max(hi, yt[yt.length - 1]);
    const t1 = time[time.length - 1] || 1;
    const sx = (t: number) => M.left + (t / t1) * (W - M.left - M.right);
    const sy = (v: number) => H - M.bottom - ((v - y0) / (y1 - y0 || 1)) * (H - M.top - M.bottom);
    return {
      x: sx,
      y: sy,
      yTicks: yt,
      xTicks: niceTicks(0, t1, 6),
      paths: series.map((s) =>
        s.values.map((v, i) => `${i ? "L" : "M"}${sx(time[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(""),
      ),
    };
  }, [series, time, yMin]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t1 = time[time.length - 1] || 1;
    const t = ((px - M.left) / (W - M.left - M.right)) * t1;
    if (t < 0 || t > t1) return setHoverIdx(null);
    // time is uniformly sampled
    setHoverIdx(Math.min(time.length - 1, Math.max(0, Math.round((t / t1) * (time.length - 1)))));
  }

  const hx = hoverIdx !== null ? x(time[hoverIdx]) : null;

  return (
    <figure className="grid gap-2" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-sm font-medium">
          {title} <span className="font-normal text-muted-foreground">({unit})</span>
        </figcaption>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
            {series.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="18" y2="3" stroke={SERIES_COLORS[i]} strokeWidth="2"
                    strokeDasharray={s.dashed ? "4 3" : undefined} />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={`${title} over time. Use the data table for exact values.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px]">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - M.bottom + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {t}
            </text>
          ))}
          <text x={W - M.right} y={H - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
            time (s)
          </text>
          {paths.map((d, i) => (
            <path key={series[i].id} d={d} fill="none" stroke={SERIES_COLORS[i]} strokeWidth="2"
              strokeLinejoin="round" strokeDasharray={series[i].dashed ? "6 4" : undefined} />
          ))}
          {hx !== null && hoverIdx !== null && (
            <g pointerEvents="none">
              <line x1={hx} x2={hx} y1={M.top} y2={H - M.bottom} stroke="currentColor" className="text-muted-foreground" strokeDasharray="2 3" />
              {series.map((s, i) => (
                <circle key={s.id} cx={hx} cy={y(s.values[hoverIdx])} r="4" fill={SERIES_COLORS[i]}
                  stroke="var(--card)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {hx !== null && hoverIdx !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border bg-popover/95 px-2 py-1 text-xs shadow"
            style={{ left: `${(hx / W) * 100}%`, transform: hx > W * 0.6 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <p className="text-muted-foreground">t = {time[hoverIdx].toFixed(3)} s</p>
            {series.map((s, i) => (
              <p key={s.id} className="flex items-center gap-1.5 tabular-nums">
                <span className="size-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                {series.length > 1 && <span className="text-muted-foreground">{s.label}:</span>}
                {s.values[hoverIdx].toFixed(1)} {unit}
              </p>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} className="justify-self-start text-xs text-primary hover:underline">
        {showTable ? "Hide" : "Show"} data table
      </button>
      {showTable && (
        <div className="max-h-48 overflow-auto rounded border">
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">{title}, sampled every 50 ms</caption>
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-2 py-1 text-left">t (s)</th>
                {series.map((s) => <th key={s.id} className="px-2 py-1 text-right">{s.label} ({unit})</th>)}
              </tr>
            </thead>
            <tbody>
              {time.map((t, i) =>
                i % 10 === 0 ? (
                  <tr key={i} className="odd:bg-muted/30">
                    <td className="px-2">{t.toFixed(3)}</td>
                    {series.map((s) => <td key={s.id} className="px-2 text-right">{s.values[i].toFixed(1)}</td>)}
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
