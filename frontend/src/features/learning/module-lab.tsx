"use client";

import { Activity, ArrowLeft, Box, ExternalLink, Maximize2, Minimize2, Sprout, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Link, useT } from "@/lib/i18n/client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbedContext, type EmbedHost } from "@/features/anatomy/embed-context";
import { ProcessStage } from "@/features/biolab/process-stage";
import { type LinkedAnatomy, ModelRunner } from "@/features/physiology/physiology-lab";
import { useModels } from "@/lib/api/queries";
import type { ModelDefinition } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// The 3D explorer needs WebGL and is large: load it only when the 3D tab opens.
const AnatomyWorkspace = dynamic(() => import("@/features/anatomy/workspace").then((m) => m.AnatomyWorkspace), {
  ssr: false,
  loading: () => <Starting3d />,
});

function Starting3d() {
  const { t } = useT();
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">{t("lab.starting3d")}</div>;
}

export type LabTab = "3d" | "sim";

/** Lab parameters kept in the URL (shared with the 3D explorer's deep-link parameters). */
const LAB_KEYS = ["lab", "sim", "structure", "system", "highlight", "play", "quiz", "module", "model", "region"];

/**
 * Lab state lives in the module page's URL (?lab=3d&structure=… or ?lab=sim&sim=…), so a
 * lab view can be shared or reloaded and the browser's Back button closes it. Opening
 * pushes one history entry; changes inside the lab replace it.
 */
let pushedByLab = false;

export function useModuleLab() {
  const params = useSearchParams();
  const raw = params.get("lab");
  const tab: LabTab | null = raw === "3d" || raw === "sim" ? raw : null;

  const open = useCallback(
    (next: LabTab, values: Record<string, string | null | undefined> = {}, keep = false) => {
      const p = new URLSearchParams();
      if (keep) for (const k of LAB_KEYS) if (params.get(k)) p.set(k, params.get(k)!);
      p.set("lab", next);
      for (const [k, v] of Object.entries(values)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      const url = `${window.location.pathname}?${p.toString()}`;
      if (params.get("lab")) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
        pushedByLab = true;
      }
    },
    [params],
  );

  const close = useCallback((anchor?: string) => {
    if (pushedByLab) {
      pushedByLab = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (anchor) {
      // after the article is back in the layout
      setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, []);

  return { tab, params, open, close };
}

// ---------------------------------------------------------------- layout helpers

function subscribeMedia(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Desktop split from 1024 px; below that the lab is a full-screen layer. */
export function useDesktopSplit(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

const WIDTH_KEY = "medverse.moduleLab.articlePercent";
const DEFAULT_PERCENT = 40;
const clampPercent = (v: number) => Math.min(65, Math.max(28, v));

function readStoredPercent(): number {
  try {
    const v = Number(window.localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(v) && v > 0 ? clampPercent(v) : DEFAULT_PERCENT;
  } catch {
    return DEFAULT_PERCENT;
  }
}

/** Article width as a percentage of the split, remembered per browser (a convenience). */
function useArticlePercent(): [number, (v: number) => void] {
  const stored = useSyncExternalStore(
    () => () => {},
    readStoredPercent,
    () => DEFAULT_PERCENT,
  );
  const [local, setLocal] = useState<number | null>(null);
  const set = useCallback((v: number) => {
    const c = clampPercent(v);
    setLocal(c);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(Math.round(c)));
    } catch {
      /* storage unavailable: keep the width for this visit only */
    }
  }, []);
  return [local ?? stored, set];
}

function Divider({
  percent,
  onChange,
  containerRef,
}: {
  percent: number;
  onChange: (v: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const move = (clientX: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (box) onChange(((clientX - box.left) / box.width) * 100);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("lab.resize")}
      aria-valuemin={28}
      aria-valuemax={65}
      aria-valuenow={Math.round(percent)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => dragging && move(e.clientX)}
      onPointerUp={() => setDragging(false)}
      onDoubleClick={() => onChange(DEFAULT_PERCENT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(percent - 3);
        else if (e.key === "ArrowRight") onChange(percent + 3);
        else if (e.key === "Home") onChange(28);
        else if (e.key === "End") onChange(65);
        else return;
        e.preventDefault();
      }}
      title={t("lab.resizeHint")}
      className={cn(
        "group relative z-10 w-2 shrink-0 cursor-col-resize touch-none bg-border/40 outline-none transition-colors hover:bg-primary/40 focus-visible:bg-primary/60",
        dragging && "bg-primary/60",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-1/2 my-auto h-10 w-1 -translate-x-1/2 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
    </div>
  );
}

// ---------------------------------------------------------------- split shell

/**
 * Module page with its lab: on desktop the explanation stays on the left and the lab
 * opens on the right (resizable, can be maximised); on smaller screens the lab is a
 * full-screen layer over the module, which keeps its reading position underneath.
 */
export function ModuleSplit({
  article,
  lab,
  open,
}: {
  article: React.ReactNode;
  lab: (controls: { maximized: boolean; toggleMaximized: () => void }) => React.ReactNode;
  open: boolean;
}) {
  const desktop = useDesktopSplit();
  const { t } = useT();
  const [percent, setPercent] = useArticlePercent();
  const [maximized, setMaximized] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const controls = { maximized, toggleMaximized: () => setMaximized((m) => !m) };

  if (!open) return <div className="h-full overflow-y-auto">{article}</div>;
  if (!desktop) {
    return (
      <>
        <div className="h-full overflow-y-auto" aria-hidden>
          {article}
        </div>
        <div className="fixed inset-0 z-50 flex flex-col bg-background">{lab({ maximized: true, toggleMaximized: () => {} })}</div>
      </>
    );
  }
  return (
    <div ref={container} className="flex h-full min-h-0">
      <div
        className={cn("min-w-0 overflow-y-auto", maximized && "hidden")}
        style={{ width: `${percent}%` }}
        aria-label={t("lab.explanation")}
        role="region"
      >
        {article}
      </div>
      {!maximized && <Divider percent={percent} onChange={setPercent} containerRef={container} />}
      <div className="flex min-w-0 flex-1 flex-col border-l bg-card/20">{lab(controls)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- lab pane

interface LabItem {
  id: string;
  label: string;
  kind: "model" | "signalling" | "growth";
  model?: ModelDefinition;
}

/** Simulations offered for a module: server models of its system, plus the cell-scale
 * neuron labs for the nervous system. */
export function labItems(moduleId: string, models: ModelDefinition[]): LabItem[] {
  const items: LabItem[] = models
    .filter((m) => m.domain === moduleId)
    .map((m) => ({ id: m.id, label: m.name, kind: "model" as const, model: m }));
  if (moduleId === "nervous") {
    items.push(
      { id: "lab.signalling", label: "Neurons communicating", kind: "signalling" },
      { id: "lab.growth", label: "Neurons growing and connecting", kind: "growth" },
    );
  }
  return items;
}

function SimulationPane({
  moduleId,
  moduleTitle,
  selected,
  onSelect,
  onLinkedAnatomy,
}: {
  moduleId: string;
  moduleTitle: string;
  selected: string | null;
  onSelect: (id: string) => void;
  onLinkedAnatomy: (link: LinkedAnatomy) => void;
}) {
  const models = useModels();
  const { t } = useT();
  const items = useMemo(() => labItems(moduleId, models.data ?? []), [moduleId, models.data]);
  if (models.isLoading) return <Skeleton className="m-4 h-96" />;
  if (!items.length) {
    const withSims = [...new Set((models.data ?? []).map((m) => m.domain))];
    return (
      <div className="m-auto grid max-w-md gap-3 p-6 text-center">
        <Activity className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{t("lab.noSimTitle", { system: moduleTitle.toLowerCase() })}</p>
        <p className="text-sm text-muted-foreground">{t("lab.noSimBody")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {withSims.map((d) => (
            <Button key={d} size="xs" variant="secondary" asChild>
              <Link href={`/learn/${d}?lab=sim`} className="capitalize">
                {t("lab.systemName", { system: d })}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    );
  }
  const current = items.find((i) => i.id === selected) ?? items[0];
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {items.length > 1 && (
        <div role="tablist" aria-label={t("lab.simulations")} className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              role="tab"
              aria-selected={i.id === current.id}
              onClick={() => onSelect(i.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                i.id === current.id ? "border-primary/60 bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {i.kind === "growth" ? <Sprout className="size-3.5" /> : <Activity className="size-3.5" />}
              {i.kind === "model" ? i.label : t(i.kind === "growth" ? "lab.neuronsGrowing" : "lab.neuronsCommunicating")}
            </button>
          ))}
        </div>
      )}
      {current.kind === "model" && current.model ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel" aria-label={current.label}>
          <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{current.model.summary}</p>
          <ModelRunner key={current.model.id} model={current.model} onLinkedAnatomy={onLinkedAnatomy} />
        </div>
      ) : (
        <div className="relative min-h-[28rem] flex-1" role="tabpanel" aria-label={current.label}>
          <ProcessStage
            key={current.id}
            id={current.kind === "growth" ? "growth" : "signalling"}
            onClose={() => onSelect(items[0].id)}
          />
        </div>
      )}
    </div>
  );
}

export function ModuleLab({
  moduleId,
  moduleTitle,
  maximized,
  toggleMaximized,
}: {
  moduleId: string;
  moduleTitle: string;
  maximized: boolean;
  toggleMaximized: () => void;
}) {
  const { tab, params, open, close } = useModuleLab();
  const desktop = useDesktopSplit();
  const { t } = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const models = useModels();
  const simCount = labItems(moduleId, models.data ?? []).length;

  // Move focus into the lab when it opens (screen readers announce it).
  useEffect(() => {
    heading.current?.focus();
  }, []);

  // Esc closes the lab unless something inside (a dialog, a menu) handled it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("[role=dialog]") || t.closest("[role=menu]") || t.tagName === "INPUT")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const embed: EmbedHost = useMemo(() => ({ onExit: (anchor) => close(anchor) }), [close]);

  // Full-page equivalent of what the lab shows, for "Open in full view".
  const fullView = (() => {
    if (tab === "sim") return `/physiology${params.get("sim") && !params.get("sim")!.startsWith("lab.") ? `?model=${encodeURIComponent(params.get("sim")!)}` : ""}`;
    const p = new URLSearchParams();
    for (const k of ["structure", "system", "highlight", "play", "quiz", "module", "model", "region"]) {
      if (params.get(k)) p.set(k, params.get(k)!);
    }
    return `/anatomy${p.size ? `?${p.toString()}` : ""}`;
  })();

  const tabButton = (id: LabTab, label: string, icon: React.ReactNode, extra?: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => tab !== id && open(id, {}, true)}
      className={cn(
        "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3",
        tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      {extra && <span className="rounded bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{extra}</span>}
    </button>
  );

  return (
    <EmbedContext.Provider value={embed}>
      <header className="flex items-center gap-1.5 border-b bg-background/80 px-2 py-2 backdrop-blur sm:gap-2 sm:px-3">
        {!desktop && (
          <Button size="sm" variant="ghost" className="px-2" onClick={() => close()} aria-label={t("lab.backToModule")}>
            <ArrowLeft /> <span className="max-[359px]:sr-only">{t("lab.module")}</span>
          </Button>
        )}
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          {t("lab.heading", { module: moduleTitle })}
        </h2>
        <div role="tablist" aria-label={t("lab.tablist")} className="flex rounded-lg bg-muted/60 p-0.5">
          {tabButton("3d", t("lab.anatomy3d"), <Box className="size-4" />)}
          {tabButton("sim", t("lab.simulation"), <Activity className="size-4" />, simCount ? String(simCount) : undefined)}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {desktop && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={toggleMaximized}
              aria-label={maximized ? t("lab.restore") : t("lab.maximise")}
              title={maximized ? t("lab.restore") : t("lab.maximise")}
            >
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" asChild title={t("lab.openFull")}>
            <Link href={fullView} aria-label={t("lab.openFull")}>
              <ExternalLink />
            </Link>
          </Button>
          {desktop && (
            <Button size="icon-sm" variant="ghost" onClick={() => close()} aria-label={t("lab.close")} title={t("lab.close")}>
              <X />
            </Button>
          )}
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {tab === "3d" ? (
          <AnatomyWorkspace embedded />
        ) : (
          <SimulationPane
            moduleId={moduleId}
            moduleTitle={moduleTitle}
            selected={params.get("sim")}
            onSelect={(id) => open("sim", { sim: id }, true)}
            onLinkedAnatomy={(l) =>
              open("3d", { structure: l.structure, highlight: l.highlight.join(","), play: l.play, system: null, quiz: null })
            }
          />
        )}
      </div>
    </EmbedContext.Provider>
  );
}
