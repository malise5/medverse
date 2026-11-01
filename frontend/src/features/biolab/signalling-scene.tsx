"use client";


import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, Color, type Mesh, type MeshStandardMaterial, Vector3 } from "three";

import {
  type Circuit,
  type CircuitState,
  pulseProgress,
  SYNAPTIC_DELAY_MS,
  V_RESET,
} from "./signalling";

export interface SignallingView {
  circuit: Circuit;
  /** Mutable simulation state, advanced by the stage's clock. */
  state: { current: CircuitState };
  myelinated: boolean;
  onStimulate: (id: string) => void;
  /** Name of the cell under the pointer (shown by the stage), or null. */
  onHover?: (label: string | null) => void;
}

interface Layout {
  soma: Vector3;
  axon: CatmullRomCurve3;
  dendrites: CatmullRomCurve3[];
  color: string;
  pyramidal?: boolean;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dendriteTree(soma: Vector3, seed: number, count: number, reach: number): CatmullRomCurve3[] {
  const r = rng(seed);
  const out: CatmullRomCurve3[] = [];
  for (let i = 0; i < count; i++) {
    const dir = new Vector3(r() - 0.5, r() - 0.3, r() - 0.5).normalize();
    const pts = [soma.clone()];
    let p = soma.clone();
    for (let k = 0; k < 4; k++) {
      dir.add(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.6)).normalize();
      p = p.clone().addScaledVector(dir, reach / 4);
      pts.push(p);
    }
    out.push(new CatmullRomCurve3(pts));
  }
  return out;
}

/** Fixed positions: inputs on the left, the integrating pyramidal cell, its target on the right. */
function layoutFor(): Record<string, Layout> {
  const A = new Vector3(-2.6, 1.0, 0.2);
  const B = new Vector3(-2.6, -1.0, -0.2);
  const I = new Vector3(-1.4, 1.9, -0.4);
  const C = new Vector3(0, 0, 0);
  const D = new Vector3(2.7, 0.2, 0);
  const into = (to: Vector3, offset: Vector3) => to.clone().add(offset);
  return {
    a: {
      soma: A,
      color: "#5ea8ff",
      dendrites: dendriteTree(A, 11, 5, 0.6),
      axon: new CatmullRomCurve3([A, new Vector3(-1.8, 0.9, 0.3), new Vector3(-0.9, 0.55, 0.1), into(C, new Vector3(-0.42, 0.28, 0.05))]),
    },
    b: {
      soma: B,
      color: "#5ea8ff",
      dendrites: dendriteTree(B, 23, 5, 0.6),
      axon: new CatmullRomCurve3([B, new Vector3(-1.8, -0.9, -0.2), new Vector3(-0.9, -0.5, -0.1), into(C, new Vector3(-0.42, -0.25, -0.05))]),
    },
    i: {
      soma: I,
      color: "#f2a93b",
      dendrites: dendriteTree(I, 37, 4, 0.45),
      axon: new CatmullRomCurve3([I, new Vector3(-0.9, 1.4, -0.3), into(C, new Vector3(-0.12, 0.42, -0.05))]),
    },
    c: {
      soma: C,
      color: "#7fe6f0",
      pyramidal: true,
      dendrites: [
        ...dendriteTree(C, 41, 6, 0.75),
        new CatmullRomCurve3([C, new Vector3(0.05, 0.6, 0), new Vector3(-0.05, 1.3, 0.1), new Vector3(0.1, 2.0, 0)]), // apical dendrite
      ],
      axon: new CatmullRomCurve3([C, new Vector3(0.6, -0.4, 0), new Vector3(1.5, -0.3, 0.1), into(D, new Vector3(-0.4, 0.05, 0))]),
    },
    d: {
      soma: D,
      color: "#9b7cf0",
      dendrites: dendriteTree(D, 53, 5, 0.6),
      axon: new CatmullRomCurve3([D, new Vector3(3.3, -0.6, 0), new Vector3(3.6, -1.6, 0)]),
    },
  };
}

const REST = new Color("#1e3a5f");
const ACTIVE = new Color("#7fe6f0");
const SPIKE = new Color("#fff3b0");

function membraneColor(v: number, out: Color): Color {
  if (v > 0) return out.copy(SPIKE);
  const f = Math.min(1, Math.max(0, (v - V_RESET) / 30)); // −75 → 0, −45 → 1
  return out.copy(REST).lerp(ACTIVE, f);
}

function Neuron({
  id,
  label,
  layout,
  myelinated,
  view,
}: {
  id: string;
  label: string;
  layout: Layout;
  myelinated: boolean;
  view: SignallingView;
}) {
  const soma = useRef<Mesh>(null);
  const color = useMemo(() => new Color(), []);
  const nodes = 8;
  const segments = useMemo(
    () =>
      Array.from({ length: nodes }, (_, k) => {
        const a = k / nodes + 0.012;
        const b = (k + 1) / nodes - 0.012;
        const pts = Array.from({ length: 6 }, (_, j) => layout.axon.getPointAt(a + ((b - a) * j) / 5));
        return new CatmullRomCurve3(pts);
      }),
    [layout.axon],
  );

  useFrame(() => {
    const n = view.state.current.neurons[id];
    if (soma.current && n) {
      membraneColor(n.v + (n.lastSpike !== null && view.state.current.t - n.lastSpike < 1 ? 100 : 0), color);
      const m = soma.current.material as MeshStandardMaterial;
      m.emissive.copy(color);
      m.emissiveIntensity = n.v > -60 || (n.lastSpike !== null && view.state.current.t - n.lastSpike < 1) ? 1.4 : 0.35;
    }
  });

  return (
    <group>
      <mesh
        ref={soma}
        position={layout.soma}
        scale={layout.pyramidal ? [1, 1.35, 1] : 1}
        onClick={(e) => {
          e.stopPropagation();
          view.onStimulate(id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          view.onHover?.(label);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          view.onHover?.(null);
        }}
      >
        {layout.pyramidal ? <coneGeometry args={[0.2, 0.42, 24]} /> : <sphereGeometry args={[0.16, 32, 32]} />}
        <meshStandardMaterial color={layout.color} roughness={0.35} emissive={layout.color} emissiveIntensity={0.35} />
      </mesh>
      {layout.dendrites.map((d, i) => (
        <mesh key={i}>
          <tubeGeometry args={[d, 24, 0.022, 8, false]} />
          <meshStandardMaterial color={layout.color} roughness={0.5} opacity={0.85} transparent />
        </mesh>
      ))}
      <mesh>
        <tubeGeometry args={[layout.axon, 80, 0.018, 8, false]} />
        <meshStandardMaterial color="#c8d6e5" roughness={0.4} />
      </mesh>
      {myelinated &&
        segments.map((s, i) => (
          <mesh key={i}>
            <tubeGeometry args={[s, 12, 0.05, 12, false]} />
            <meshStandardMaterial color="#eef3f8" roughness={0.6} opacity={0.92} transparent />
          </mesh>
        ))}
      {/* axon terminal bouton */}
      <mesh position={layout.axon.getPointAt(1)}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color={layout.color} roughness={0.4} />
      </mesh>
      <Pulses id={id} curve={layout.axon} myelinated={myelinated} view={view} nodes={nodes} />
    </group>
  );
}

const MAX_PULSES = 6;

function Pulses({
  id,
  curve,
  myelinated,
  view,
  nodes,
}: {
  id: string;
  curve: CatmullRomCurve3;
  myelinated: boolean;
  view: SignallingView;
  nodes: number;
}) {
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const s = view.state.current;
    const mine = s.pulses.filter((p) => p.neuron === id).slice(-MAX_PULSES);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = mine[i];
      m.visible = !!p;
      if (p) m.position.copy(curve.getPointAt(pulseProgress(p, s.t, myelinated, nodes)));
    });
  });
  return (
    <>
      {Array.from({ length: MAX_PULSES }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial color="#fff3b0" toneMapped={false} />
          <pointLight color="#ffe08a" intensity={0.6} distance={0.8} />
        </mesh>
      ))}
    </>
  );
}

const VESICLES = 10;

function Releases({ view, layout }: { view: SignallingView; layout: Record<string, Layout> }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const n = view.circuit.synapses.length * VESICLES;
  useFrame(() => {
    const s = view.state.current;
    refs.current.forEach((m) => m && (m.visible = false));
    for (const r of s.releases) {
      const syn = view.circuit.synapses[r.synapse];
      const from = layout[syn.from].axon.getPointAt(1);
      const toLayout = layout[syn.to];
      const to = from.clone().lerp(toLayout.soma, 0.18);
      const f = Math.min(1, (s.t - r.t0) / SYNAPTIC_DELAY_MS);
      for (let k = 0; k < VESICLES; k++) {
        const m = refs.current[r.synapse * VESICLES + k];
        if (!m) continue;
        const spread = new Vector3(Math.sin(k * 2.4) * 0.05, Math.cos(k * 1.7) * 0.05, Math.sin(k * 3.1) * 0.05);
        m.visible = f < 1;
        m.position.copy(from).lerp(to, f).add(spread.multiplyScalar(f));
        (m.material as MeshStandardMaterial).color.set(syn.weightMv > 0 ? "#7cf29a" : "#f27c7c");
      }
    }
  });
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#7cf29a" emissive="#7cf29a" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </>
  );
}

export function SignallingScene(view: SignallingView) {
  const layout = useMemo(() => layoutFor(), []);
  return (
    <Canvas camera={{ position: [0.4, 0.3, 8.2], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#070b12"]} />
      <fog attach="fog" args={["#070b12", 7, 14]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#6d8cff" />
      {view.circuit.neurons.map((n) => (
        <Neuron key={n.id} id={n.id} label={n.label} layout={layout[n.id]} myelinated={view.myelinated && n.myelinated} view={view} />
      ))}
      <Releases view={view} layout={layout} />
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={11} />
    </Canvas>
  );
}
