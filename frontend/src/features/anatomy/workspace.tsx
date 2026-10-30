"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStructure } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

import { HierarchyPanel } from "./panels/hierarchy-panel";
import { LayersPanel } from "./panels/layers-panel";
import { SearchPanel } from "./panels/search-panel";
import { StructurePanel } from "./panels/structure-panel";
import { BottomToolbar, TopToolbar } from "./panels/toolbars";
import { useWorkspace } from "./store";
import { useAnatomyData } from "./use-anatomy-data";

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

  // Focus the camera once the selected structure's meshes are known (search/hierarchy).
  const pendingFocus = useRef<string | null>(null);
  const selectFromList = useCallback(
    (id: string) => {
      selectAndFocus(id);
      pendingFocus.current = id;
      if (!desktop) setLeftOpen(false);
    },
    [selectAndFocus, desktop],
  );
  useEffect(() => {
    if (pendingFocus.current && detail.data?.id === pendingFocus.current) {
      if (detail.data.mesh_ids.length) useWorkspace.getState().requestFocus(detail.data.mesh_ids);
      pendingFocus.current = null;
    }
  }, [detail.data]);

  // Deep links: /anatomy?structure=FMA:3734&highlight=FMA:3734,FMA:3736
  const params = useSearchParams();
  const ownedMeshes = data.ownedMeshes;
  useEffect(() => {
    const s = params.get("structure");
    if (s) {
      select(s); // external (zustand) store
      pendingFocus.current = s;
    }
  }, [params, select]);
  useEffect(() => {
    const h = params.get("highlight");
    const ids = h ? h.split(",").flatMap((id) => ownedMeshes.get(id) ?? []) : [];
    useWorkspace.getState().setHighlighted(ids);
  }, [params, ownedMeshes]);

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
          <SearchPanel onSelect={selectFromList} />
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
      <StructurePanel structureId={selectedId} meshIds={[...selectedMeshIds]} onSelect={selectFromList} />
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
          <Sheet open={rightOpen && !!selectedId} onOpenChange={setRightOpen}>
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
