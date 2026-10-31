"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCirculation, useModels, useStructure } from "@/lib/api/queries";

import { useFunctionPlayer } from "./function/use-function-player";
import { SystemPanel } from "./panels/system-panel";
import { cn } from "@/lib/utils";

import { HierarchyPanel } from "./panels/hierarchy-panel";
import { LayersPanel } from "./panels/layers-panel";
import { SearchPanel } from "./panels/search-panel";
import { StructurePanel } from "./panels/structure-panel";
import { BottomToolbar, TopToolbar } from "./panels/toolbars";
import { useWorkspace } from "./store";
import { useAnatomyData } from "./use-anatomy-data";

const HEART = "FMA:7088";
/** Validated dark-surface categorical palette (fixed order, never cycled). */
const PART_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

// WebGL only exists in the browser.
const AnatomyCanvas = dynamic(() => import("./engine/anatomy-canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Starting 3D engine…</div>,
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

export function AnatomyWorkspace() {
  const data = useAnatomyData();
  const selectedId = useWorkspace((s) => s.selectedId);
  const multi = useWorkspace((s) => s.multiSelection);
  const audience = useWorkspace((s) => s.audience);
  const select = useWorkspace((s) => s.select);
  const detail = useStructure(selectedId, audience);
  const desktop = useIsDesktop();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Selection may be a compound structure (e.g. "heart"); its meshes come from the API.
  // Until the detail loads, fall back to meshes owned directly by the structure.
  const selectedMeshIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = detail.data?.id === selectedId ? detail.data.mesh_ids : data.ownedMeshes.get(selectedId);
    return new Set(ids ?? []);
  }, [selectedId, detail.data, data.ownedMeshes]);

  const multiMeshIds = useMemo(
    () => new Set(multi.flatMap((id) => data.ownedMeshes.get(id) ?? [])),
    [multi, data.ownedMeshes],
  );

  const selectAndFocus = useCallback(
    (id: string) => {
      select(id);
      if (!desktop) setRightOpen(true);
    },
    [select, desktop],
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

  // Body map: colour the selected structure's direct parts (largest first, up to the
  // validated categorical palette length) and trace its blood-vessel routes.
  const { names } = data;
  useEffect(() => {
    const parts = selectedId
      ? (children.get(selectedId) ?? [])
          .map((id) => ({ id, name: names.get(id) ?? id, meshIds: resolveMeshes(id) }))
          .filter((p) => p.meshIds.length)
          .sort((a, b) => b.meshIds.length - a.meshIds.length)
          .slice(0, PART_COLORS.length)
          .map((p, i) => ({ ...p, color: PART_COLORS[i] }))
      : [];
    useWorkspace.getState().setParts(parts);
  }, [selectedId, children, names, resolveMeshes]);

  const showCirculation = useWorkspace((s) => s.showCirculation);
  const systemFocus = useWorkspace((s) => s.systemFocus);
  const circulationTarget = selectedId ?? (systemFocus === "cardiovascular" ? HEART : null);
  const circ = useCirculation(circulationTarget, showCirculation);
  useEffect(() => {
    const c = circ.data;
    const ws = useWorkspace.getState();
    if (!showCirculation || !c || c.structure_id !== circulationTarget || c.mode === "none") {
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
  }, [circ.data, circulationTarget, showCirculation]);

  // Choosing a structure from search/hierarchy/links shows it: once its meshes are known
  // the camera focuses, the rest of the body fades (spotlight) and, if a documented
  // function model is linked, its simulation plays in 3D.
  const { play } = useFunctionPlayer();
  const pendingFocus = useRef<string | null>(null);
  const pendingPlay = useRef<{ id: string; modelId: string | null } | null>(null);
  const selectFromList = useCallback(
    (id: string) => {
      selectAndFocus(id);
      pendingFocus.current = id;
      pendingPlay.current = { id, modelId: null };
      useWorkspace.getState().setSpotlight(true);
      if (!desktop) setLeftOpen(false);
    },
    [selectAndFocus, desktop],
  );
  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data;
    if (pendingFocus.current === d.id) {
      if (d.mesh_ids.length) useWorkspace.getState().requestFocus(d.mesh_ids);
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
  }, [detail.data, play]);

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
        setRightOpen(true);
      }
    },
    [select, data.systems, manifest, models.data, play, desktop],
  );

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
        <TabsTrigger value="search">Search</TabsTrigger>
        <TabsTrigger value="layers">Layers</TabsTrigger>
        <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <TabsContent value="search">
          <SearchPanel onSelect={selectFromList} systems={data.systems} onSelectSystem={selectSystem} />
        </TabsContent>
        <TabsContent value="layers">
          <LayersPanel systems={data.systems} />
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
      {systemFocus && !selectedId ? (
        <SystemPanel systemId={systemFocus} systems={data.systems} index={data.index} onSelect={selectFromList} />
      ) : (
        <StructurePanel structureId={selectedId} meshIds={[...selectedMeshIds]} onSelect={selectFromList} />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopToolbar onToggleLeft={() => setLeftOpen((o) => !o)} onToggleRight={() => setRightOpen((o) => !o)} />
      <div className="flex min-h-0 flex-1">
        {desktop ? (
          <aside className={cn("w-72 shrink-0 border-r bg-card/40", !leftOpen && "hidden")} aria-label="Explorer">
            {left}
          </aside>
        ) : (
          <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetTitle className="sr-only">Explorer</SheetTitle>
              {left}
            </SheetContent>
          </Sheet>
        )}
        <section className="relative min-w-0 flex-1" aria-label="3D viewer">
          {data.error ? (
            <p role="alert" className="p-6 text-sm text-destructive">
              Could not load anatomy data: {data.error.message}
            </p>
          ) : data.manifest && data.systems.length ? (
            <AnatomyCanvas
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
        </section>
        {desktop ? (
          <aside className={cn("w-[22rem] shrink-0 border-l bg-card/40", !rightOpen && "hidden")} aria-label="Structure information">
            {right}
          </aside>
        ) : (
          <Sheet open={rightOpen && (!!selectedId || !!systemFocus)} onOpenChange={setRightOpen}>
            <SheetContent side="bottom" className="h-[70dvh] p-0">
              <SheetTitle className="sr-only">Structure information</SheetTitle>
              {right}
            </SheetContent>
          </Sheet>
        )}
      </div>
      <BottomToolbar />
    </div>
  );
}
