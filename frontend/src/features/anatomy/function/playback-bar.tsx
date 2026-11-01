"use client";

import { Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

import { useWorkspace } from "../store";

export const SPEEDS = [0.25, 0.5, 1, 2] as const;

/** How much slower than real time playback runs at speed 1 (1 = real time). */
export function slowdown(rate: number, timeUnit: "s" | "ms"): number {
  return (timeUnit === "ms" ? 1000 : 1) / rate;
}

/** Floating playback controls over the 3D view while a function simulation is active. */
export function PlaybackBar() {
  const playback = useWorkspace((s) => s.playback);
  const playing = useWorkspace((s) => s.playing);
  const speed = useWorkspace((s) => s.speed);
  const setPlaying = useWorkspace((s) => s.setPlaying);
  const setSpeed = useWorkspace((s) => s.setSpeed);
  const stop = useWorkspace((s) => s.stopPlayback);
  const { t } = useT();
  if (!playback) return null;
  const slow = slowdown(playback.rate, playback.timeUnit) / speed;
  return (
    <div
      role="region"
      aria-label={t("explorer.function.playbackAria")}
      className="absolute left-3 top-3 flex items-center gap-1 rounded-full border bg-background/85 py-1 pl-3 pr-1 text-xs shadow-lg backdrop-blur"
    >
      <span className={playing ? "size-2 animate-pulse rounded-full bg-primary" : "size-2 rounded-full bg-muted-foreground"} aria-hidden />
      <span className="max-w-48 truncate font-medium">{playback.modelName}</span>
      <span className="hidden text-muted-foreground sm:inline">
        ·{" "}
        {Math.abs(slow - 1) < 0.01
          ? t("explorer.function.realTimeShort")
          : slow > 1
            ? t("explorer.function.slower", { n: Math.round(slow) })
            : t("explorer.function.faster", { n: (1 / slow).toFixed(1) })}
      </span>
      <select
        aria-label={t("explorer.function.speed")}
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="ml-1 h-6 rounded-md border border-input bg-transparent px-1 text-xs"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s} className="bg-popover">
            {s}×
          </option>
        ))}
      </select>
      <Button size="icon-xs" variant="ghost" aria-label={playing ? t("explorer.function.pause") : t("explorer.function.play")} onClick={() => setPlaying(!playing)}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button size="icon-xs" variant="ghost" aria-label={t("explorer.function.stopSim")} onClick={stop}>
        <Square />
      </Button>
    </div>
  );
}
