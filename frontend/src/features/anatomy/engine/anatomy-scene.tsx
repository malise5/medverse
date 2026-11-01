"use client";

/* eslint-disable react-hooks/immutability -- three.js renderer, raycaster and scene-graph
   objects are mutable by design and live outside React state (standard R3F practice). */

import { CameraControls, Html, useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box3,
  Color,
  Mesh,
  PMREMGenerator,
  Plane,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { acceleratedRaycast, computeBoundsTree, type MeshBVH } from "three-mesh-bvh";

import type { AnatomicalSystem, AnimationBinding, AssetBundle } from "@/lib/api/types";

import { advance, effectStrength, playbackClock, sampleAt, seriesRange, type SeriesRange } from "../function/animation";
import {
  flowLevel,
  ghostDepth,
  meshVisibility,
  spotlightVisibility,
  useWorkspace,
  type PartView,
  type Playback,
  type ViewPreset,
} from "../store";
import { BloodFlow, PathwayAnimator } from "./head-processes";
import { MaterialCache, type MeshState } from "./materials";
import { MENINGES_OPACITY, meshColor } from "./palette";
import { type Region, regionFloor, regionView as regionViewFor } from "./regions";

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

/** Camera target and distance for a region (see regions.ts), from the scene bounds. */
export function regionView(region: Region, box: Box3): { target: Vector3; dist: number } {
  return regionViewFor(region, box, { target: TARGET, dist: DIST });
}

export interface RegisteredMesh {
  mesh: Mesh;
  meshId: string;
  structureId: string;
  systemId: string;
  group?: string;
  overlay?: Mesh;
  /** Material chosen by the static view rules; animations fall back to it. */
  baseMaterial?: Material;
  /** World-space vertical extent (region filtering). */
  minY?: number;
  maxY?: number;
  /** Rest transform, restored when playback stops. */
  basePosition: Vector3;
  baseScale: Vector3;
}

interface AnimatedTarget {
  binding: AnimationBinding;
  index: number;
  values: number[];
  range: SeriesRange;
  /** One group per bound structure: scale effects pivot about each group's centre. */
  groups: { meshes: RegisteredMesh[]; pivot: Vector3 }[];
}

interface AnimationState {
  playback: Playback;
  targets: AnimatedTarget[];
  t: number;
  /** Registry size when targets were built; rebuilt as bundles finish loading. */
  builtAt: number;
}

const FLOW_HOPS_PER_SECOND = 9;
const FLOW_LEVELS = 5;

const noRaycast = () => {};
// BVH-accelerated picking: the scene holds ~1M triangles across ~1,300 meshes.
const defaultRaycast = acceleratedRaycast;

/**
 * Image-based lighting from a procedural studio room (three.js RoomEnvironment): soft
 * reflections that give organs and bone their form. Generated locally, no download.
 */
function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

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
        basePosition: obj.position.clone(),
        baseScale: obj.scale.clone(),
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
  resolveMeshes,
}: {
  bundles: AssetBundle[];
  systems: AnatomicalSystem[];
  selectedMeshIds: Set<string>;
  multiMeshIds: Set<string>;
  onPick: (structureId: string, additive: boolean) => void;
  /** All mesh IDs of a structure including its parts. */
  resolveMeshes: (structureId: string) => string[];
}) {
  const { invalidate, gl, raycaster } = useThree();
  const controls = useRef<CameraControls>(null);
  const registry = useRef(new Map<string, RegisteredMesh>());
  const [loadVersion, setLoadVersion] = useState(0);
  const activeProcess = useWorkspace((s) => s.activeProcess);
  const region = useWorkspace((s) => s.region);
  const systemVisible = useWorkspace((s) => s.systemVisible);
  const getMeshes = useCallback(() => [...registry.current.values()], []);
  const getMesh = useCallback((id: string) => registry.current.get(id), []);
  const getSceneBox = useCallback(() => sceneBox.current, []);
  const clipPlane = useMemo(() => new Plane(new Vector3(1, 0, 0), 0), []);
  const headPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const clipPlanes = useMemo<Plane[]>(() => [], []);
  const materials = useMemo(() => new MaterialCache(clipPlanes), [clipPlanes]);
  const sceneBox = useRef(new Box3());
  const anim = useRef<AnimationState | null>(null);

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

    // Region: head and neck study modes keep everything above a floor plane.
    clipPlanes.length = 0;
    const regionBox = sceneBox.current.clone();
    const floor = regionFloor(s.region, regionBox);
    if (floor !== null) {
      regionBox.min.y = floor;
      headPlane.set(new Vector3(0, 1, 0), -floor);
      clipPlanes.push(headPlane);
    }
    // Section plane from the normalised slider position across the region's bounds.
    if (s.clip.axis !== "none" && !regionBox.isEmpty()) {
      const axis = { sagittal: 0, transverse: 1, coronal: 2 }[s.clip.axis];
      const min = regionBox.min.getComponent(axis);
      const max = regionBox.max.getComponent(axis);
      const at = min + (max - min) * s.clip.position;
      const n = new Vector3().setComponent(axis, s.clip.flip ? -1 : 1);
      clipPlane.set(n, s.clip.flip ? at : -at);
      clipPlanes.push(clipPlane);
    }

    // Spotlight keeps the selection (or focused system), anything driven by playback and
    // the shown vessel routes; the rest is context.
    let focus: Set<string> | null = null;
    if (s.spotlight && (selectedMeshIds.size || s.systemFocus)) {
      focus = new Set([...selectedMeshIds, ...multiMeshIds]);
      for (const target of anim.current?.targets ?? []) {
        for (const g of target.groups) for (const m of g.meshes) focus.add(m.meshId);
      }
      if (s.showCirculation && s.circulation) {
        for (const id of s.circulation.arteries.keys()) focus.add(id);
        for (const id of s.circulation.veins.keys()) focus.add(id);
      }
      if (s.systemFocus) {
        for (const r of registry.current.values()) if (r.systemId === s.systemFocus) focus.add(r.meshId);
      }
    }
    const partColor = new Map<string, string>();
    if (s.showParts) for (const p of s.parts) for (const id of p.meshIds) partColor.set(id, p.color);

    const hoveredMesh = s.hover?.meshId;
    for (const r of registry.current.values()) {
      const base = meshVisibility(s, {
        meshId: r.meshId,
        systemId: r.systemId,
        systemDepth: depthBySystem[r.systemId] ?? 50,
        removedGhostDepth: removedGhost,
      });
      const belowRegion = floor !== null && r.maxY !== undefined && r.maxY < floor;
      // Meninges enclose the brain: shown only in the meninges preset or when selected.
      const meninx = r.group !== undefined && r.group in MENINGES_OPACITY;
      const meningesHidden = meninx && s.headPreset !== "meninges" && !selectedMeshIds.has(r.meshId);
      const vis = belowRegion || meningesHidden ? "hidden" : spotlightVisibility(base, r.meshId, focus);
      const contextOnly = vis === "ghost" && base === "visible";
      const { mesh } = r;
      mesh.visible = vis !== "hidden";
      mesh.raycast = vis === "visible" ? defaultRaycast : noRaycast;
      if (vis !== "visible" && r.overlay) r.overlay.visible = false;
      if (vis === "ghost") {
        mesh.material = contextOnly ? materials.context() : materials.ghost();
        mesh.renderOrder = -1;
        continue;
      }
      let state: MeshState = "normal";
      // In spotlight the selection is already obvious; natural colours read better.
      if (selectedMeshIds.has(r.meshId)) state = focus ? "normal" : "selected";
      else if (multiMeshIds.has(r.meshId)) state = "multi";
      else if (s.highlightedMeshes.has(r.meshId)) state = "highlighted";
      else if (hoveredMesh === r.meshId) state = "hovered";
      const opacity = (s.systemOpacity[r.systemId] ?? 1) * (meninx ? MENINGES_OPACITY[r.group!] : 1);
      const color = partColor.get(r.meshId) ?? meshColor(r.systemId, r.group);
      mesh.material = materials.get(color, state, opacity, r.systemId);
      r.baseMaterial = mesh.material;
      mesh.renderOrder = opacity < 1 ? 1 : 0;
      // Overlay child (shared geometry) shows the selection through occluding anatomy.
      const wantOverlay = state === "selected" && s.xraySelection && !focus;
      if (wantOverlay && !r.overlay) {
        r.overlay = new Mesh(mesh.geometry, materials.xray());
        r.overlay.raycast = noRaycast;
        r.overlay.renderOrder = 10;
        mesh.add(r.overlay);
      }
      if (r.overlay) r.overlay.visible = wantOverlay;
    }
    invalidate();
  }, [clipPlane, clipPlanes, headPlane, depthBySystem, invalidate, materials, multiMeshIds, selectedMeshIds]);

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
        state.region !== prev.region ||
        state.headPreset !== prev.headPreset ||
        state.xraySelection !== prev.xraySelection ||
        state.spotlight !== prev.spotlight ||
        state.systemFocus !== prev.systemFocus ||
        state.parts !== prev.parts ||
        state.showParts !== prev.showParts ||
        state.circulation !== prev.circulation ||
        state.showCirculation !== prev.showCirculation ||
        state.flowAnimation !== prev.flowAnimation ||
        state.highlightedMeshes !== prev.highlightedMeshes
      ) {
        apply();
      }
    });
  }, [apply]);

  // ---- Function playback ---------------------------------------------------------
  // The model already ran on the server; here its output only drives presentation:
  // uniform scaling about a pivot, colour tint, or emissive glow.
  const restoreTransforms = useCallback(() => {
    for (const target of anim.current?.targets ?? []) {
      for (const g of target.groups) {
        for (const r of g.meshes) {
          r.mesh.position.copy(r.basePosition);
          r.mesh.scale.copy(r.baseScale);
        }
      }
    }
  }, []);

  const buildTargets = useCallback(
    (playback: Playback): AnimatedTarget[] =>
      playback.bindings
        .map((binding, index) => {
          const values = playback.series[binding.output] ?? [];
          const groups = binding.structure_ids
            .map((sid) => {
              const meshes = resolveMeshes(sid)
                .map((id) => registry.current.get(id))
                .filter((r): r is RegisteredMesh => !!r);
              const box = new Box3();
              for (const r of meshes) {
                r.mesh.updateWorldMatrix(true, false);
                box.union(new Box3().setFromObject(r.mesh));
              }
              return { meshes, pivot: box.isEmpty() ? new Vector3() : box.getCenter(new Vector3()) };
            })
            .filter((g) => g.meshes.length);
          return { binding, index, values, range: seriesRange(values), groups };
        })
        .filter((t) => t.values.length && t.groups.length),
    [resolveMeshes],
  );

  const syncPlayback = useCallback(() => {
    const playback = useWorkspace.getState().playback;
    const current = anim.current;
    if (current && (current.playback !== playback || current.builtAt !== registry.current.size)) {
      restoreTransforms(); // pivots must be measured at rest
    }
    if (!playback) {
      if (current) {
        anim.current = null;
        playbackClock.t = null;
        materials.disposeAnimated();
        apply();
      }
      return;
    }
    if (current?.playback === playback && current.builtAt === registry.current.size) return;
    const t = current?.playback.modelId === playback.modelId ? current.t : playback.time[0];
    anim.current = { playback, targets: buildTargets(playback), t, builtAt: registry.current.size };
    apply();
  }, [apply, buildTargets, materials, restoreTransforms]);

  useEffect(() => {
    syncPlayback();
    return useWorkspace.subscribe((state, prev) => {
      if (state.playback !== prev.playback) syncPlayback();
      if (state.playing !== prev.playing || state.speed !== prev.speed) invalidate();
    });
  }, [syncPlayback, invalidate]);

  useEffect(
    () => () => {
      restoreTransforms();
      playbackClock.t = null;
    },
    [restoreTransforms],
  );

  // ---- Blood-flow wave along inferred vessel routes --------------------------------
  // Schematic: a brightness pulse leaves the heart along arteries and returns along veins,
  // stepping one vessel segment (mesh) at a time. It shows direction, not real velocity.
  const flowPhase = useRef(0);
  useFrame((_, delta) => {
    const s = useWorkspace.getState();
    const c = s.circulation;
    if (!c || !s.showCirculation || !s.flowAnimation) return;
    flowPhase.current += Math.min(delta, 0.1) * FLOW_HOPS_PER_SECOND;
    const paint = (hops: Map<string, number>, maxHop: number, towardHeart: boolean, glow: string) => {
      for (const [meshId, hop] of hops) {
        const r = registry.current.get(meshId);
        if (!r || r.mesh.raycast !== defaultRaycast || !r.baseMaterial) continue;
        const level = Math.round(flowLevel(hop, maxHop, flowPhase.current, towardHeart) * FLOW_LEVELS);
        if (!level) {
          r.mesh.material = r.baseMaterial;
          continue;
        }
        const base = r.baseMaterial as Material & { color?: Color };
        const m = materials.animated(`flow${towardHeart ? "v" : "a"}${level}`, `#${base.color?.getHexString() ?? "ffffff"}`, base.opacity);
        m.emissive.set(glow);
        m.emissiveIntensity = (level / FLOW_LEVELS) * 0.9;
        r.mesh.material = m;
      }
    };
    paint(c.arteries, c.maxArteryHop, false, "#ffb3a6");
    paint(c.veins, c.maxVeinHop, true, "#a9c4ff");
    invalidate();
  });

  // Part labels: anchored at each part's centre; recomputed when parts change or more
  // bundles load (event-driven, so the registry ref is never read during render).
  const [labels, setLabels] = useState<(PartView & { at: Vector3 })[]>([]);
  const refreshLabels = useCallback(() => {
    const { parts, showParts } = useWorkspace.getState();
    setLabels(
      (showParts ? parts : [])
        .map((p) => {
          const box = new Box3();
          for (const id of p.meshIds) {
            const r = registry.current.get(id);
            if (r) box.union(new Box3().setFromObject(r.mesh));
          }
          return box.isEmpty() ? null : { ...p, at: box.getCenter(new Vector3()) };
        })
        .filter((p) => p !== null),
    );
  }, []);
  useEffect(
    () =>
      useWorkspace.subscribe((state, prev) => {
        if (state.parts !== prev.parts || state.showParts !== prev.showParts) refreshLabels();
      }),
    [refreshLabels],
  );

  const tmpColor = useMemo(() => new Color(), []);
  useFrame((_, delta) => {
    const a = anim.current;
    if (!a) return;
    const { playing, speed } = useWorkspace.getState();
    const { time, rate } = a.playback;
    // Clamp delta so a background tab does not jump a whole cycle on return.
    if (playing) a.t = advance(a.t, Math.min(delta, 0.1), rate, speed, time[0], time[time.length - 1]);
    playbackClock.t = a.t;
    for (const target of a.targets) {
      const { binding } = target;
      const k = effectStrength(binding, sampleAt(time, target.values, a.t), target.range);
      if (binding.effect === "scale") {
        for (const g of target.groups) {
          for (const r of g.meshes) {
            r.mesh.position.copy(r.basePosition).sub(g.pivot).multiplyScalar(k).add(g.pivot);
            r.mesh.scale.copy(r.baseScale).multiplyScalar(k);
          }
        }
        continue;
      }
      const touched = new Set<Material>();
      for (const g of target.groups) {
        for (const r of g.meshes) {
          if (r.mesh.raycast !== defaultRaycast) continue; // hidden or ghosted: leave alone
          const opacity = (r.mesh.material as Material).opacity;
          const m = materials.animated(String(target.index), meshColor(r.systemId, r.group), opacity);
          r.mesh.material = m;
          if (touched.has(m)) continue;
          touched.add(m);
          const accent = tmpColor.set(binding.color ?? "#ffffff");
          if (binding.effect === "tint") {
            m.color.copy(m.userData.baseColor as Color).lerp(accent, k);
            m.emissive.copy(accent);
            m.emissiveIntensity = 0.35 * k;
          } else {
            m.emissive.copy(accent);
            m.emissiveIntensity = 1.2 * k;
          }
        }
      }
    }
    if (playing) invalidate();
  });

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

  // Region modes frame the region from the scene bounds, which grow as bundles load:
  // keep re-framing until every bundle is in (only while no other focus is pending).
  const loadedBundles = useRef(new Set<string>());
  const frameRegion = useCallback(() => {
    const s = useWorkspace.getState();
    if (s.region === "body" || !controls.current || pendingFocus.current || s.selectedId) return;
    const { target, dist } = regionView(s.region, sceneBox.current);
    void controls.current.setLookAt(target.x, target.y, target.z + dist, target.x, target.y, target.z, true);
  }, []);

  const onLoaded = useCallback(
    (bundleId: string, meshes: RegisteredMesh[]) => {
      const box = new Box3();
      for (const m of meshes) {
        registry.current.set(m.meshId, m);
        // World-space bounds: quantised bundles carry per-node scale/translation.
        m.mesh.updateWorldMatrix(true, false);
        box.setFromObject(m.mesh);
        m.minY = box.min.y;
        m.maxY = box.max.y;
        sceneBox.current.union(box);
      }
      apply();
      refreshLabels();
      syncPlayback(); // bound structures may have just loaded
      tryFocus();
      setLoadVersion((v) => v + 1);
      if (!loadedBundles.current.has(bundleId)) {
        loadedBundles.current.add(bundleId);
        if (loadedBundles.current.size <= bundles.length) frameRegion();
      }
    },
    [apply, refreshLabels, syncPlayback, tryFocus, frameRegion, bundles.length],
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
    // Presets are directions around the region's centre (whole body or head).
    const { target, dist } = regionView(useWorkspace.getState().region, sceneBox.current);
    const dir = new Vector3(...VIEW_POSITIONS[viewCommand.preset]).sub(TARGET).normalize();
    const pos = target.clone().addScaledVector(dir, dist);
    controls.current.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
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
      <StudioEnvironment />
      <hemisphereLight args={["#e8f1ff", "#2a2420", 0.55]} />
      {/* key (warm, front-left high), fill (cool, right), rim (behind) for silhouettes */}
      <directionalLight position={[2, 4, 3]} intensity={1.35} color="#fff4e8" />
      <directionalLight position={[-3, 1.5, 1.5]} intensity={0.45} color="#dce8ff" />
      <directionalLight position={[0, 2.5, -4]} intensity={0.9} color="#cfe0ff" />
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
      {labels.map((p) => (
        <Html key={p.id} position={p.at} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="flex items-center gap-1 whitespace-nowrap rounded-full border bg-background/85 px-2 py-0.5 text-[11px] shadow backdrop-blur">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </div>
        </Html>
      ))}
      {activeProcess === "blood" && (
        <BloodFlow
          getMeshes={getMeshes}
          getSceneBox={getSceneBox}
          region={region}
          version={`${loadVersion}|${JSON.stringify(systemVisible)}`}
        />
      )}
      {activeProcess === "pathways" && (
        <PathwayAnimator resolveMeshes={resolveMeshes} getMesh={getMesh} version={loadVersion} />
      )}
      <gridHelper args={[3, 30, "#2c3a48", "#1d2731"]} position={[0, -0.002, 0]} />
    </>
  );
}

export { TARGET, VIEW_POSITIONS };
