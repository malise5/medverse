"use client";

/* eslint-disable react-hooks/immutability -- three.js renderer, raycaster and scene-graph
   objects are mutable by design and live outside React state (standard R3F practice). */

import { CameraControls, useGLTF } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Box3, Mesh, Plane, Vector3, type BufferGeometry, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree, type MeshBVH } from "three-mesh-bvh";

import type { AnatomicalSystem, AssetBundle } from "@/lib/api/types";

import { ghostDepth, meshVisibility, useWorkspace, type ViewPreset } from "../store";
import { MaterialCache, type MeshState } from "./materials";
import { meshColor } from "./palette";

/** Scene bounds (metres) of the BodyParts3D model after pipeline normalisation. */
const TARGET = new Vector3(0, 0.88, 0);
const DIST = 3.3;

const VIEW_POSITIONS: Record<ViewPreset, [number, number, number]> = {
  anterior: [0, 0.95, DIST],
  posterior: [0, 0.95, -DIST],
  // Patient's left is +X in scene coordinates.
  left: [DIST, 0.95, 0],
  right: [-DIST, 0.95, 0],
  superior: [0, 0.88 + DIST * 1.2, 0.01],
  inferior: [0, 0.88 - DIST * 1.2, 0.01],
  oblique: [DIST * 0.7, 1.4, DIST * 0.7],
};

export interface RegisteredMesh {
  mesh: Mesh;
  meshId: string;
  structureId: string;
  systemId: string;
  group?: string;
  overlay?: Mesh;
}

const noRaycast = () => {};
// BVH-accelerated picking: the scene holds ~1M triangles across ~1,300 meshes.
const defaultRaycast = acceleratedRaycast;

function BundleLayer({
  bundle,
  onLoaded,
}: {
  bundle: AssetBundle;
  onLoaded: (bundleId: string, meshes: RegisteredMesh[]) => void;
}) {
  // Meshopt decoding enabled (no-op for uncompressed bundles); Draco not used.
  const gltf = useGLTF(bundle.uri, false, true);
  useEffect(() => {
    const meshes: RegisteredMesh[] = [];
    gltf.scene.traverse((obj: Object3D) => {
      if (!(obj instanceof Mesh)) return;
      const geometry = obj.geometry as BufferGeometry & { boundsTree?: MeshBVH };
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      if (!geometry.boundsTree) geometry.boundsTree = computeBoundsTree.call(geometry);
      const structureId = obj.userData.structureId as string | undefined;
      if (!structureId) return;
      meshes.push({
        mesh: obj,
        meshId: obj.name,
        structureId,
        systemId: bundle.system_id ?? "unclassified",
        group: obj.userData.group,
      });
    });
    onLoaded(bundle.id, meshes);
  }, [gltf, bundle, onLoaded]);
  return <primitive object={gltf.scene} />;
}

export function AnatomyScene({
  bundles,
  systems,
  selectedMeshIds,
  multiMeshIds,
  onPick,
}: {
  bundles: AssetBundle[];
  systems: AnatomicalSystem[];
  selectedMeshIds: Set<string>;
  multiMeshIds: Set<string>;
  onPick: (structureId: string, additive: boolean) => void;
}) {
  const { invalidate, gl, raycaster } = useThree();
  const controls = useRef<CameraControls>(null);
  const registry = useRef(new Map<string, RegisteredMesh>());
  const clipPlane = useMemo(() => new Plane(new Vector3(1, 0, 0), 0), []);
  const clipPlanes = useMemo<Plane[]>(() => [], []);
  const materials = useMemo(() => new MaterialCache(clipPlanes), [clipPlanes]);
  const sceneBox = useRef(new Box3());

  useEffect(() => {
    gl.localClippingEnabled = true;
    (raycaster as typeof raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    return () => materials.dispose();
  }, [gl, materials, raycaster]);

  const depthBySystem = useMemo(
    () => Object.fromEntries(systems.map((s) => [s.id, s.dissection_depth])),
    [systems],
  );

  const apply = useCallback(() => {
    const s = useWorkspace.getState();
    const depths = Object.entries(depthBySystem)
      .filter(([id]) => s.systemVisible[id] !== false)
      .map(([, d]) => d);
    const removedGhost = ghostDepth(depths, s.dissectionDepth);

    // Clipping plane from normalised slider position across the loaded scene bounds.
    clipPlanes.length = 0;
    if (s.clip.axis !== "none" && !sceneBox.current.isEmpty()) {
      const axis = { sagittal: 0, transverse: 1, coronal: 2 }[s.clip.axis];
      const min = sceneBox.current.min.getComponent(axis);
      const max = sceneBox.current.max.getComponent(axis);
      const at = min + (max - min) * s.clip.position;
      const n = new Vector3().setComponent(axis, s.clip.flip ? -1 : 1);
      clipPlane.set(n, s.clip.flip ? at : -at);
      clipPlanes.push(clipPlane);
    }

    const hoveredMesh = s.hover?.meshId;
    for (const r of registry.current.values()) {
      const vis = meshVisibility(s, {
        meshId: r.meshId,
        systemId: r.systemId,
        systemDepth: depthBySystem[r.systemId] ?? 50,
        removedGhostDepth: removedGhost,
      });
      const { mesh } = r;
      mesh.visible = vis !== "hidden";
      mesh.raycast = vis === "visible" ? defaultRaycast : noRaycast;
      if (vis !== "visible" && r.overlay) r.overlay.visible = false;
      if (vis === "ghost") {
        mesh.material = materials.ghost();
        mesh.renderOrder = -1;
        continue;
      }
      let state: MeshState = "normal";
      if (selectedMeshIds.has(r.meshId)) state = "selected";
      else if (multiMeshIds.has(r.meshId)) state = "multi";
      else if (s.highlightedMeshes.has(r.meshId)) state = "highlighted";
      else if (hoveredMesh === r.meshId) state = "hovered";
      const opacity = s.systemOpacity[r.systemId] ?? 1;
      mesh.material = materials.get(meshColor(r.systemId, r.group), state, opacity);
      mesh.renderOrder = opacity < 1 ? 1 : 0;
      // Overlay child (shared geometry) shows the selection through occluding anatomy.
      const wantOverlay = state === "selected" && s.xraySelection;
      if (wantOverlay && !r.overlay) {
        r.overlay = new Mesh(mesh.geometry, materials.xray());
        r.overlay.raycast = noRaycast;
        r.overlay.renderOrder = 10;
        mesh.add(r.overlay);
      }
      if (r.overlay) r.overlay.visible = wantOverlay;
    }
    invalidate();
  }, [clipPlane, clipPlanes, depthBySystem, invalidate, materials, multiMeshIds, selectedMeshIds]);

  useEffect(() => {
    apply();
    return useWorkspace.subscribe((state, prev) => {
      if (
        state.hover?.meshId !== prev.hover?.meshId ||
        state.systemVisible !== prev.systemVisible ||
        state.systemOpacity !== prev.systemOpacity ||
        state.hiddenMeshes !== prev.hiddenMeshes ||
        state.isolatedMeshes !== prev.isolatedMeshes ||
        state.dissectionDepth !== prev.dissectionDepth ||
        state.ghostRemovedLayer !== prev.ghostRemovedLayer ||
        state.clip !== prev.clip ||
        state.xraySelection !== prev.xraySelection ||
        state.highlightedMeshes !== prev.highlightedMeshes
      ) {
        apply();
      }
    });
  }, [apply]);

  // Focus requests can arrive before their bundle has loaded (deep links); keep the
  // request pending and retry whenever new meshes register.
  const pendingFocus = useRef<string[] | null>(null);
  const tryFocus = useCallback(() => {
    const ids = pendingFocus.current;
    if (!ids || !controls.current) return;
    const box = new Box3();
    let missing = false;
    for (const id of ids) {
      const r = registry.current.get(id);
      if (r) box.expandByObject(r.mesh);
      else missing = true;
    }
    if (box.isEmpty()) return;
    void controls.current.fitToBox(box, true, {
      paddingTop: 0.08,
      paddingBottom: 0.08,
      paddingLeft: 0.08,
      paddingRight: 0.08,
    });
    if (!missing) pendingFocus.current = null;
  }, []);

  const focusCommand = useWorkspace((s) => s.focusCommand);
  useEffect(() => {
    if (!focusCommand) return;
    pendingFocus.current = focusCommand.meshIds;
    tryFocus();
  }, [focusCommand, tryFocus]);

  const onLoaded = useCallback(
    (_bundleId: string, meshes: RegisteredMesh[]) => {
      const box = new Box3();
      for (const m of meshes) {
        registry.current.set(m.meshId, m);
        // World-space bounds: quantised bundles carry per-node scale/translation.
        m.mesh.updateWorldMatrix(true, false);
        sceneBox.current.union(box.setFromObject(m.mesh));
      }
      apply();
      tryFocus();
    },
    [apply, tryFocus],
  );

  // CameraControls owns the camera once mounted; set the initial anterior view here.
  useEffect(() => {
    const [x, y, z] = VIEW_POSITIONS.anterior;
    controls.current?.setLookAt(x, y, z, TARGET.x, TARGET.y, TARGET.z, false);
  }, []);

  // Camera commands.
  const viewCommand = useWorkspace((s) => s.viewCommand);
  useEffect(() => {
    if (!viewCommand || !controls.current) return;
    const [x, y, z] = VIEW_POSITIONS[viewCommand.preset];
    controls.current.setLookAt(x, y, z, TARGET.x, TARGET.y, TARGET.z, true);
  }, [viewCommand]);


  // Picking. Intersections arrive nearest-first; skip points removed by the clip plane
  // so users cannot select geometry they cannot see.
  const isClipped = (p: Vector3) => clipPlanes.some((pl) => pl.distanceToPoint(p) < 0);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || isClipped(e.point)) return; // ignore drags; let next hit handle
    e.stopPropagation();
    const id = e.object.userData.structureId as string | undefined;
    if (id) onPick(id, e.shiftKey || e.ctrlKey || e.metaKey);
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (isClipped(e.point)) return;
    e.stopPropagation();
    const structureId = e.object.userData.structureId as string | undefined;
    if (!structureId) return;
    useWorkspace.getState().setHover({
      meshId: e.object.name,
      structureId,
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
    });
  };

  return (
    <>
      <hemisphereLight args={["#e8f1ff", "#2a2420", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={0.05}
        maxDistance={8}
        dollySpeed={0.6}
        smoothTime={0.25}
      />
      <group
          onClick={handleClick}
          onPointerMove={handleMove}
          onPointerOut={() => useWorkspace.getState().setHover(null)}
          onPointerMissed={(e) => {
            if (e.type === "click") onPick("", false);
          }}
        >
          {bundles.map((b) => (
            <Suspense key={b.id} fallback={null}>
              <BundleLayer bundle={b} onLoaded={onLoaded} />
            </Suspense>
          ))}
      </group>
      <gridHelper args={[3, 30, "#2c3a48", "#1d2731"]} position={[0, -0.002, 0]} />
    </>
  );
}

export { TARGET, VIEW_POSITIONS };
