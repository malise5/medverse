"use client";

import { Info, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCirculation, useLearningModule, useModels, useStructure } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/client";

import { ProcessStage } from "@/features/biolab/process-stage";

import { useFunctionPlayer } from "./function/use-function-player";
import { SystemPanel } from "./panels/system-panel";
import { cn } from "@/lib/utils";

import { HierarchyPanel } from "./panels/hierarchy-panel";
import { IdentifyQuizBanner, QuizPanelPlaceholder } from "./quiz/identify-quiz";
import { ProcessHud } from "./process-hud";
import { LayersPanel } from "./panels/layers-panel";
import { SearchPanel } from "./panels/search-panel";
import { StructurePanel } from "./panels/structure-panel";
import { BottomToolbar, TopToolbar } from "./panels/toolbars";
import { useWorkspace } from "./store";
import { useAnatomyData } from "./use-anatomy-data";

const HEART = "FMA:7088";

/** Close button for the overlay panels of the embedded workspace. */
function PanelClose({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
}
/** Validated dark-surface categorical palette (fixed order, never cycled). */
const PART_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

function EngineLoading() {
  const { t } = useT();
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">{t("explorer.starting")}</div>;
}

// WebGL only exists in the browser.
const AnatomyCanvas = dynamic(() => import("./engine/anatomy-canvas"), {
  ssr: false,
  loading: () => <EngineLoading />,
});

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

/**
 * The 3D anatomy explorer. `embedded` runs it inside another page (a learning module's
 * lab pane): the explorer and information panels become overlays inside the viewer so
 * the 3D view keeps the room, and the explorer starts closed.
 */
export function AnatomyWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
  const data = useAnatomyData();
  const { t } = useT();
  const selectedId = useWorkspace((s) => s.selectedId);
  const multi = useWorkspace((s) => s.multiSelection);
  const audience = useWorkspace((s) => s.audience);
  const select = useWorkspace((s) => s.select);
  const detail = useStructure(selectedId, audience);
  const desktop = useIsDesktop();
  const [leftOpen, setLeftOpen] = useState(!embedded);
  // Embedded: the information panel opens on request (it would cover a narrow viewer).
  const [rightOpen, setRightOpen] = useState(!embedded);

  // Selection may be a compound structure (e.g. "heart"); its meshes come from the API.
  // Until the detail loads, fall back to meshes owned directly by the structure.
  // Structure detail lists meshes of both bodies; keep those of the body on screen.
  const inBody = useCallback((ids: string[]) => ids.filter((id) => data.manifest?.meshes[id]), [data.manifest]);
  const selectedMeshIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = detail.data?.id === selectedId ? inBody(detail.data.mesh_ids) : data.ownedMeshes.get(selectedId);
    return new Set(ids ?? []);
  }, [selectedId, detail.data, data.ownedMeshes, inBody]);

  const multiMeshIds = useMemo(
    () => new Set(multi.flatMap((id) => data.ownedMeshes.get(id) ?? [])),
    [multi, data.ownedMeshes],
  );

  const selectAndFocus = useCallback(
    (id: string) => {
      select(id);
      if (!desktop && !embedded) setRightOpen(true);
    },
    [select, desktop, embedded],
  );

  // All meshes of a structure, including its parts (for playback bindings).
  const { children, ownedMeshes } = data;
  const resolveMeshes = useCallback(
    (id: string) => {
      const out: string[] = [];
      const seen = new Set<string>();
      const stack = [id];
      while (stack.length) {
        const s = stack.pop()!;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(...(ownedMeshes.get(s) ?? []));
        stack.push(...(children.get(s) ?? []));
      }
      return out;
    },
    [children, ownedMeshes],
  );

  // Head layer presets frame a structure (first one present in this body) without
  // starting function playback, unlike choosing it from search.
  const focusFirst = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        const meshes = resolveMeshes(id);
        if (meshes.length) {
          select(id);
          useWorkspace.getState().requestFocus(meshes);
          return;
        }
      }
    },
    [resolveMeshes, select],
  );

  // Body map: colour the selected structure's direct parts (largest first, up to the
  // validated categorical palette length) and trace its blood-vessel routes.
  const { names } = data;
  const partsHidden = useWorkspace((s) => !!s.quiz && !s.quiz.answered);
  const activeProcess = useWorkspace((s) => s.activeProcess);
  useEffect(() => {
    const parts = selectedId && !partsHidden
      ? (children.get(selectedId) ?? [])
          .map((id) => ({ id, name: names.get(id) ?? id, meshIds: resolveMeshes(id) }))
          .filter((p) => p.meshIds.length)
          .sort((a, b) => b.meshIds.length - a.meshIds.length)
          .slice(0, PART_COLORS.length)
          .map((p, i) => ({ ...p, color: PART_COLORS[i] }))
      : [];
    useWorkspace.getState().setParts(parts);
  }, [selectedId, children, names, resolveMeshes, partsHidden]);

  const showCirculation = useWorkspace((s) => s.showCirculation);
  const systemFocus = useWorkspace((s) => s.systemFocus);
  const circulationTarget = selectedId ?? (systemFocus === "cardiovascular" ? HEART : null);
  const routesAvailable = data.bodyModel === "male";
  const circ = useCirculation(circulationTarget, showCirculation && routesAvailable);
  useEffect(() => {
    const c = circ.data;
    const ws = useWorkspace.getState();
    if (!routesAvailable || !showCirculation || !c || c.structure_id !== circulationTarget || c.mode === "none") {
      ws.setCirculation(null);
      return;
    }
    const arteries = new Map(Object.entries(c.arteries));
    const veins = new Map(Object.entries(c.veins));
    ws.setCirculation({
      structureId: c.structure_id,
      mode: c.mode,
      arteries,
      veins,
      maxArteryHop: Math.max(0, ...arteries.values()),
      maxVeinHop: Math.max(0, ...veins.values()),
    });
  }, [circ.data, circulationTarget, showCirculation, routesAvailable]);

  // Choosing a structure from search/hierarchy/links shows it: once its meshes are known
  // the camera focuses, the rest of the body fades (spotlight) and, if a documented
  // function model is linked, its simulation plays in 3D.
  const { play } = useFunctionPlayer();
  const pendingFocus = useRef<string | null>(null);
  const pendingPlay = useRef<{ id: string; modelId: string | null } | null>(null);
  const selectFromList = useCallback(
    (id: string) => {
      // A structure chosen by name must be visible even if its layer was switched off.
      const sys = data.systemOf.get(id);
      const ws0 = useWorkspace.getState();
      if (sys && ws0.systemVisible[sys] === false) ws0.setSystemVisible(sys, true);
      if (sys && (ws0.systemOpacity[sys] ?? 1) < 0.3) ws0.setSystemOpacity(sys, 1);
      selectAndFocus(id);
      pendingFocus.current = id;
      pendingPlay.current = { id, modelId: null };
      useWorkspace.getState().setSpotlight(true);
      if (!desktop) setLeftOpen(false);
    },
    [selectAndFocus, desktop, data.systemOf],
  );
  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data;
    if (pendingFocus.current === d.id) {
      const own = inBody(d.mesh_ids);
      if (own.length) useWorkspace.getState().requestFocus(own);
      pendingFocus.current = null;
    }
    if (pendingPlay.current?.id === d.id) {
      const ws = useWorkspace.getState();
      const modelId = pendingPlay.current.modelId ?? d.simulations[0]?.model_id;
      pendingPlay.current = null;
      if (modelId && ws.autoPlay) {
        if (ws.playback?.modelId !== modelId) void play(modelId);
      } else if (!modelId) {
        ws.stopPlayback();
      }
    }
  }, [detail.data, play, inBody]);

  // Deep links: /anatomy?structure=FMA:3734&highlight=FMA:3734,FMA:3736&play=cv.windkessel3
  const params = useSearchParams();
  useEffect(() => {
    const s = params.get("structure");
    if (s) {
      select(s); // external (zustand) store
      pendingFocus.current = s;
      const modelId = params.get("play");
      if (modelId) pendingPlay.current = { id: s, modelId };
    }
  }, [params, select]);
  // After switching body, frame the selected structure again in the new body.
  const bodyOnScreen = data.manifest?.body_model;
  const framedBody = useRef(bodyOnScreen);
  useEffect(() => {
    if (!bodyOnScreen || framedBody.current === bodyOnScreen) return;
    framedBody.current = bodyOnScreen;
    const d = detail.data;
    if (d && d.id === useWorkspace.getState().selectedId) {
      const own = inBody(d.mesh_ids);
      if (own.length) useWorkspace.getState().requestFocus(own);
    }
  }, [bodyOnScreen, detail.data, inBody]);

  // Body: /anatomy?model=female (otherwise the body chosen earlier stays).
  const modelParam = params.get("model");
  useEffect(() => {
    if (modelParam === "male" || modelParam === "female") useWorkspace.getState().setBodyModel(modelParam);
  }, [modelParam]);

  // Region study modes: /anatomy?region=head | neck
  const regionParam = params.get("region");
  useEffect(() => {
    if (regionParam === "head" || regionParam === "neck" || regionParam === "body")
      useWorkspace.getState().setRegion(regionParam);
  }, [regionParam]);

  // Layer builder: /anatomy?systems=skeletal,muscular shows only the listed systems.
  const systemsParam = params.get("systems");
  useEffect(() => {
    if (!systemsParam || !data.systems.length) return;
    const wanted = new Set(systemsParam.split(","));
    const ws = useWorkspace.getState();
    for (const sys of data.systems) ws.setSystemVisible(sys.id, wanted.has(sys.id));
    const shallowest = Math.min(...data.systems.filter((x) => wanted.has(x.id)).map((x) => x.dissection_depth));
    if (Number.isFinite(shallowest) && shallowest < ws.dissectionDepth) ws.setDissectionDepth(shallowest);
  }, [systemsParam, data.systems]);

  // "Find it in 3D" quiz: /anatomy?quiz=<question id>&module=<module id>. The module's
  // own layer is exposed (its targets belong to that system) without spotlighting it.
  const quizId = params.get("quiz");
  const quizModule = useLearningModule(quizId ? params.get("module") : null);
  useEffect(() => {
    const q = quizModule.data?.questions.find((x) => x.id === quizId && x.kind === "identify");
    const ws = useWorkspace.getState();
    if (!q || !quizModule.data) {
      if (!quizId) ws.setQuiz(null);
      return;
    }
    const moduleId = quizModule.data.id;
    ws.select(null);
    ws.setSystemFocus(null);
    ws.setSpotlight(false);
    ws.stopPlayback();
    ws.setSystemVisible(moduleId, true);
    const depth = data.systems.find((x) => x.id === moduleId)?.dissection_depth;
    if (depth !== undefined && depth < ws.dissectionDepth) ws.setDissectionDepth(depth);
    ws.setQuiz({ questionId: q.id, moduleId, stem: q.stem, answered: false });
    return () => useWorkspace.getState().setQuiz(null);
  }, [quizId, quizModule.data, data.systems]);
  const quizHidesNames = partsHidden;

  useEffect(() => {
    const h = params.get("highlight");
    const ids = h ? h.split(",").flatMap((id) => ownedMeshes.get(id) ?? []) : [];
    useWorkspace.getState().setHighlighted(ids);
  }, [params, ownedMeshes]);

  // Choosing a whole system from search: spotlight all of it, frame it, and play the
  // system's function model if one exists (matched by model domain).
  const models = useModels();
  const { manifest } = data;
  const selectSystem = useCallback(
    (systemId: string) => {
      const ws = useWorkspace.getState();
      select(null);
      ws.setSystemFocus(systemId);
      ws.setSpotlight(true);
      ws.setSystemVisible(systemId, true);
      const depth = data.systems.find((x) => x.id === systemId)?.dissection_depth ?? 0;
      if (depth < ws.dissectionDepth) ws.setDissectionDepth(depth);
      if (manifest) {
        const bundles = new Set(manifest.bundles.filter((b) => b.system_id === systemId).map((b) => b.id));
        ws.requestFocus(Object.entries(manifest.meshes).filter(([, [b]]) => bundles.has(b)).map(([m]) => m));
      }
      const model = models.data?.find((m) => m.domain === systemId && m.animations.length);
      if (model && ws.autoPlay) void play(model.id);
      else if (!model) ws.stopPlayback();
      if (!desktop) {
        setLeftOpen(false);
        if (!embedded) setRightOpen(true);
      }
    },
    [select, data.systems, manifest, models.data, play, desktop, embedded],
  );

  // /anatomy?system=<id> opens a whole system in spotlight (links from learning modules).
  const systemParam = params.get("system");
  const openedSystem = useRef<string | null>(null);
  useEffect(() => {
    if (!systemParam || !manifest || !data.systems.some((x) => x.id === systemParam)) return;
    if (openedSystem.current === systemParam) return;
    openedSystem.current = systemParam;
    selectSystem(systemParam);
  }, [systemParam, manifest, data.systems, selectSystem]);

  const onPick = useCallback(
    (structureId: string, additive: boolean) => {
      if (!structureId) {
        if (!additive) select(null);
        return;
      }
      select(structureId, { additive });
    },
    [select],
  );

  const left = (
    <Tabs defaultValue="search" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-3 w-[calc(100%-1.5rem)]">
        <TabsTrigger value="search">{t("explorer.tabs.search")}</TabsTrigger>
        <TabsTrigger value="layers">{t("explorer.tabs.layers")}</TabsTrigger>
        <TabsTrigger value="hierarchy">{t("explorer.tabs.hierarchy")}</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <TabsContent value="search">
          <SearchPanel onSelect={selectFromList} systems={data.systems} onSelectSystem={selectSystem} />
        </TabsContent>
        <TabsContent value="layers">
          <LayersPanel systems={data.systems} onFocus={focusFirst} />
        </TabsContent>
        <TabsContent value="hierarchy">
          <HierarchyPanel
            systems={data.systems}
            index={data.index}
            names={data.names}
            childMap={data.children}
            onSelect={selectFromList}
          />
        </TabsContent>
      </div>
    </Tabs>
  );

  const right = (
    <div className="h-full overflow-y-auto">
      {quizHidesNames ? (
        <QuizPanelPlaceholder />
      ) : systemFocus && !selectedId ? (
        <SystemPanel systemId={systemFocus} systems={data.systems} index={data.index} onSelect={selectFromList} />
      ) : (
        <StructurePanel structureId={selectedId} meshIds={[...selectedMeshIds]} onSelect={selectFromList} />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopToolbar
        compact={embedded}
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => setRightOpen((o) => !o)}
      />
      <div className="relative flex min-h-0 flex-1">
        {/* Cell-scale labs take over the whole workspace; closing returns to the head. */}
        {(activeProcess === "signalling" || activeProcess === "growth") && (
          <ProcessStage id={activeProcess} onClose={() => useWorkspace.getState().setActiveProcess(null)} />
        )}
        {desktop && !embedded ? (
          <aside className={cn("w-72 shrink-0 border-r bg-card/40", !leftOpen && "hidden")} aria-label={t("explorer.explorer")}>
            {left}
          </aside>
        ) : desktop && embedded ? (
          leftOpen && (
            <aside
              aria-label={t("explorer.explorer")}
              className="absolute inset-y-0 left-0 z-20 w-72 max-w-[85%] border-r bg-background/95 pt-8 shadow-xl backdrop-blur"
            >
              <PanelClose label={t("explorer.closeExplorer")} onClick={() => setLeftOpen(false)} />
              {left}
            </aside>
          )
        ) : (
          <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetTitle className="sr-only">{t("explorer.explorer")}</SheetTitle>
              {left}
            </SheetContent>
          </Sheet>
        )}
        <section className="relative min-w-0 flex-1" aria-label={t("explorer.viewer")}>
          {data.error ? (
            <p role="alert" className="p-6 text-sm text-destructive">
              {t("explorer.loadError", { error: data.error.message })}
            </p>
          ) : data.manifest && data.systems.length ? (
            <AnatomyCanvas
              compactCredits={embedded}
              manifest={data.manifest}
              systems={data.systems}
              names={data.names}
              selectedMeshIds={selectedMeshIds}
              multiMeshIds={multiMeshIds}
              onPick={onPick}
              resolveMeshes={resolveMeshes}
            />
          ) : (
            <Skeleton className="m-4 h-[calc(100%-2rem)]" />
          )}
          <IdentifyQuizBanner onShow={selectFromList} />
          {embedded && !rightOpen && !quizHidesNames && (selectedId || systemFocus) && (
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              className="absolute bottom-3 left-3 z-10 flex max-w-[70%] items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors hover:border-primary/60"
            >
              <Info className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="block truncate first-letter:uppercase">
                {selectedId
                  ? (detail.data?.id === selectedId ? detail.data.name : data.names.get(selectedId)) ?? t("explorer.structureFallback")
                  : (data.systems.find((x) => x.id === systemFocus)?.name ?? t("explorer.systemFallback"))}
              </span>
              <span className="shrink-0 text-muted-foreground">· {t("explorer.details")}</span>
            </button>
          )}
          <ProcessHud />
        </section>
        {desktop && !embedded ? (
          <aside className={cn("w-[22rem] shrink-0 border-l bg-card/40", !rightOpen && "hidden")} aria-label={t("explorer.structureInfo")}>
            {right}
          </aside>
        ) : desktop && embedded ? (
          rightOpen &&
          !quizHidesNames &&
          (!!selectedId || !!systemFocus) && (
            <aside
              aria-label={t("explorer.structureInfo")}
              className="absolute inset-y-0 right-0 z-20 w-80 max-w-[85%] border-l bg-background/95 pt-8 shadow-xl backdrop-blur"
            >
              <PanelClose label={t("explorer.closeInfo")} onClick={() => setRightOpen(false)} />
              {right}
            </aside>
          )
        ) : (
          <Sheet open={rightOpen && !quizHidesNames && (!!selectedId || !!systemFocus)} onOpenChange={setRightOpen}>
            <SheetContent side="bottom" className="h-[70dvh] p-0">
              <SheetTitle className="sr-only">{t("explorer.structureInfo")}</SheetTitle>
              {right}
            </SheetContent>
          </Sheet>
        )}
      </div>
      <BottomToolbar />
    </div>
  );
}
