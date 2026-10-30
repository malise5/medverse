"use client";

import { useProgress } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useMemo, type ReactNode } from "react";

import type { AnatomicalSystem, AssetManifest } from "@/lib/api/types";

import { useWorkspace } from "../store";
import { AnatomyScene, TARGET, VIEW_POSITIONS } from "./anatomy-scene";

class WebGLBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="grid h-full place-items-center p-6 text-center text-sm">
          <div className="max-w-sm space-y-2">
            <p className="font-medium">The 3D viewer could not start.</p>
            <p className="text-muted-foreground">
              Your browser or device may not support WebGL 2, or the anatomy assets failed to load.
              Search, hierarchy and structure information remain available.
            </p>
            <p className="font-mono text-xs text-muted-foreground">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingOverlay() {
  const { active, progress, loaded, total } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <div className="rounded-full border bg-background/80 px-3 py-1 text-xs backdrop-blur">
        Loading anatomy assets… {Math.round(progress)}% ({loaded}/{total})
      </div>
    </div>
  );
}

function HoverLabel({ names }: { names: Map<string, string> }) {
  const hover = useWorkspace((s) => s.hover);
  if (!hover) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border bg-popover/95 px-2 py-1 text-xs shadow-lg"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <span className="font-medium">{names.get(hover.structureId) ?? hover.structureId}</span>
      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{hover.structureId}</span>
    </div>
  );
}

export default function AnatomyCanvas({
  manifest,
  systems,
  names,
  selectedMeshIds,
  multiMeshIds,
  onPick,
}: {
  manifest: AssetManifest;
  systems: AnatomicalSystem[];
  names: Map<string, string>;
  selectedMeshIds: Set<string>;
  multiMeshIds: Set<string>;
  onPick: (structureId: string, additive: boolean) => void;
}) {
  const bundles = useMemo(() => manifest.bundles.filter((b) => !b.is_placeholder), [manifest]);
  const attribution = useMemo(
    () => [...new Set(manifest.bundles.map((b) => `${b.attribution} (${b.license})`))].join(" · "),
    [manifest],
  );
  return (
    <WebGLBoundary>
      <div id="anatomy-canvas" className="relative h-full w-full">
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: VIEW_POSITIONS.anterior, fov: 35, near: 0.01, far: 50 }}
          onCreated={({ camera }) => camera.lookAt(TARGET)}
          aria-label="Interactive 3D anatomical model"
        >
          <color attach="background" args={["#0d1217"]} />
          <Suspense fallback={null}>
            <AnatomyScene
              bundles={bundles}
              systems={systems}
              selectedMeshIds={selectedMeshIds}
              multiMeshIds={multiMeshIds}
              onPick={onPick}
            />
          </Suspense>
        </Canvas>
        <LoadingOverlay />
        <HoverLabel names={names} />
        <p className="pointer-events-none absolute bottom-1.5 right-2 max-w-[70%] text-right text-[10px] leading-tight text-muted-foreground/70">
          3D data: {attribution}
        </p>
      </div>
    </WebGLBoundary>
  );
}
