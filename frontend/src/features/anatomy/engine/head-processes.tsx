"use client";


import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Color,
  type InstancedMesh,
  type Mesh,
  Matrix4,
  Quaternion,
  QuadraticBezierCurve3,
  Vector3,
} from "three";

import { PATHWAYS, STEP_SECONDS } from "@/features/biolab/pathways";

import { useWorkspace } from "../store";
import { along, centerline, cumulativeLengths, orientFrom, type P3 } from "./centerline";
import { type Region, regionFloor } from "./regions";
import type { RegisteredMesh } from "./anatomy-scene";

const ARTERIAL = new Color("#ff2b2b");
const VENOUS = new Color("#4b49c8");
/** Illustrative flow speed in the scene (m/s), slowed relative to the ~0.3 m/s in carotids. */
const FLOW_SPEED = 0.03;
/** Displayed cell size (m): red cells are 7.5 µm across, enlarged so they are visible. */
const CELL_SIZE = 0.0011;
const MAX_CELLS = 1600;

interface Vessel {
  points: P3[];
  cum: number[];
  radius: number;
  length: number;
  arterial: boolean;
  perp: [Vector3, Vector3];
}

function worldSample(r: RegisteredMesh, max = 500): P3[] {
  const pos = r.mesh.geometry.getAttribute("position");
  const step = Math.max(1, Math.floor(pos.count / max));
  const v = new Vector3();
  const out: P3[] = [];
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(r.mesh.matrixWorld);
    out.push([v.x, v.y, v.z]);
  }
  return out;
}

function heartPoint(meshes: RegisteredMesh[], box: Box3): P3 {
  const heart = meshes.filter((m) => m.group === "heart" || m.structureId === "FMA:7088");
  if (heart.length) {
    const b = new Box3();
    heart.forEach((m) => b.expandByObject(m.mesh));
    const c = b.getCenter(new Vector3());
    return [c.x, c.y, c.z];
  }
  return [0, box.isEmpty() ? 1.25 : box.max.y * 0.72, 0.03];
}

interface Cell {
  vi: number;
  u: number;
  ox: number;
  oy: number;
  spin: number;
}

function placeCells(vessels: Vessel[]): Cell[] {
  const total = vessels.reduce((s, v) => s + v.length, 0);
  const n = Math.min(MAX_CELLS, Math.round(total / 0.003));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const cum: number[] = [];
  vessels.reduce((s, v, i) => ((cum[i] = s + v.length), cum[i]), 0);
  return Array.from({ length: n }, () => {
    const x = rnd() * total;
    const vi = Math.max(0, cum.findIndex((c) => c >= x));
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * 0.6;
    return { vi, u: rnd(), ox: Math.cos(ang) * rad, oy: Math.sin(ang) * rad, spin: rnd() * Math.PI };
  });
}

function buildVessels(all: RegisteredMesh[], box: Box3, floor: number | null): Vessel[] {
  const heart = heartPoint(all, box);
  const out: Vessel[] = [];
  for (const r of all) {
    if (r.systemId !== "cardiovascular" || (r.group !== "artery" && r.group !== "vein")) continue;
    if (!r.mesh.visible || (floor !== null && (r.maxY ?? 0) < floor)) continue;
    const c = centerline(worldSample(r));
    if (!c || c.length < 0.008) continue;
    const arterial = r.group === "artery";
    const points = orientFrom(c.points, heart, !arterial);
    const a = new Vector3(...points[points.length - 1]).sub(new Vector3(...points[0])).normalize();
    const p1 = new Vector3().crossVectors(a, Math.abs(a.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
    const p2 = new Vector3().crossVectors(a, p1).normalize();
    out.push({ points, cum: cumulativeLengths(points), radius: c.radius, length: c.length, arterial, perp: [p1, p2] });
  }
  return out;
}

/** Red cells streaming along the centre lines of the visible vessel meshes. */
export function BloodFlow({
  getMeshes,
  getSceneBox,
  region,
  version,
}: {
  getMeshes: () => RegisteredMesh[];
  getSceneBox: () => Box3;
  region: Region;
  version: string;
}) {
  const inst = useRef<InstancedMesh>(null);
  // Imperative three.js data: built in an effect from the scene registry, read per frame.
  const data = useRef<{ vessels: Vessel[]; cells: Cell[] }>({ vessels: [], cells: [] });
  useEffect(() => {
    const box = getSceneBox();
    const floor = regionFloor(region, box);
    const vessels = buildVessels(getMeshes(), box, floor);
    const cells = placeCells(vessels);
    data.current = { vessels, cells };
    const m = inst.current;
    if (m) {
      m.count = cells.length;
      cells.forEach((c, i) => m.setColorAt(i, vessels[c.vi].arterial ? ARTERIAL : VENOUS));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [getMeshes, getSceneBox, region, version]);

  const tools = useMemo(
    () => ({
      mat: new Matrix4(),
      q: new Quaternion(),
      pos: new Vector3(),
      scl: new Vector3(CELL_SIZE, CELL_SIZE * 0.4, CELL_SIZE),
      tmp: [0, 0, 0] as P3,
    }),
    [],
  );

  useFrame((_, dt) => {
    const m = inst.current;
    const { vessels, cells } = data.current;
    if (!m || !cells.length) return;
    const s = useWorkspace.getState();
    const step = s.processPlaying ? Math.min(0.05, dt) * s.processSpeed : 0;
    const { mat, q, pos, scl, tmp } = tools;
    cells.forEach((c, i) => {
      const v = vessels[c.vi];
      c.u = (c.u + (step * FLOW_SPEED) / v.length) % 1;
      along(v.points, v.cum, c.u, tmp);
      pos.set(tmp[0], tmp[1], tmp[2])
        .addScaledVector(v.perp[0], c.ox * v.radius)
        .addScaledVector(v.perp[1], c.oy * v.radius);
      q.setFromAxisAngle(v.perp[0], c.spin + c.u * 6);
      mat.compose(pos, q, scl);
      m.setMatrixAt(i, mat);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, MAX_CELLS]} count={0} frustumCulled={false} raycast={() => {}}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial roughness={0.35} emissiveIntensity={0.35} emissive="#330000" />
    </instancedMesh>
  );
}

/** Lights each pathway step's structure in turn and sends an impulse between them. */
export function PathwayAnimator({
  resolveMeshes,
  getMesh,
  version,
}: {
  resolveMeshes: (structureId: string) => string[];
  getMesh: (meshId: string) => RegisteredMesh | undefined;
  version: number;
}) {
  const pathwayId = useWorkspace((s) => s.pathwayId);
  const pathway = PATHWAYS.find((p) => p.id === pathwayId) ?? null;
  const spark = useRef<Mesh>(null);
  const t = useRef(0);

  const steps = useRef<{ meshIds: string[]; center: Vector3 | null }[]>([]);
  useEffect(() => {
    if (!pathway) {
      steps.current = [];
      return;
    }
    steps.current = pathway.steps.map((st) => {
      for (const id of st.structures) {
        const meshIds = resolveMeshes(id).filter((m) => getMesh(m));
        if (meshIds.length) {
          const b = new Box3();
          meshIds.forEach((m) => b.expandByObject(getMesh(m)!.mesh));
          return { meshIds, center: b.getCenter(new Vector3()) };
        }
      }
      return { meshIds: [] as string[], center: null as Vector3 | null };
    });
  }, [pathway, resolveMeshes, getMesh, version]);

  useEffect(() => {
    t.current = 0;
    return () => useWorkspace.getState().setHighlighted([]);
  }, [pathwayId]);

  useFrame((_, dt) => {
    const s = useWorkspace.getState();
    const st = steps.current;
    if (!st.length) return;
    if (s.processPlaying) t.current += Math.min(0.05, dt) * s.processSpeed;
    const cycle = st.length * STEP_SECONDS + 1.5;
    const time = t.current % cycle;
    const i = Math.min(st.length - 1, Math.floor(time / STEP_SECONDS));
    const phase = (time - i * STEP_SECONDS) / STEP_SECONDS;
    if (s.pathwayStep !== i) {
      s.setPathwayStep(i);
      s.setHighlighted(st[i].meshIds);
    }
    const sp = spark.current;
    if (!sp) return;
    const prev = st.slice(0, i).reverse().find((x) => x.center)?.center;
    const cur = st[i].center;
    if (prev && cur && phase < 0.45) {
      const mid = prev.clone().lerp(cur, 0.5).add(new Vector3(0, prev.distanceTo(cur) * 0.25, 0));
      sp.position.copy(new QuadraticBezierCurve3(prev, mid, cur).getPoint(phase / 0.45));
      sp.visible = true;
    } else {
      sp.visible = false;
    }
  });

  if (!pathway) return null;
  return (
    <mesh ref={spark} visible={false} renderOrder={20}>
      <sphereGeometry args={[0.006, 16, 16]} />
      <meshBasicMaterial color="#fff3b0" toneMapped={false} depthTest={false} transparent />
      <pointLight color="#ffd27a" intensity={0.4} distance={0.12} />
    </mesh>
  );
}
