"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import type { GrowthState } from "./growth";

const CELL_COLORS = ["#5ea8ff", "#7fe6f0", "#9b7cf0", "#f2a93b", "#7cf29a", "#f27cb1"];

/** Renders the current growth state; the stage advances the model and bumps `version`. */
export function GrowthScene({ state, version }: { state: GrowthState; version: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 4]} intensity={1} />
      <group key={version}>
        {state.cells.map((c) => (
          <mesh key={c.id} position={c.soma}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial color={CELL_COLORS[c.id % CELL_COLORS.length]} emissive={CELL_COLORS[c.id % CELL_COLORS.length]} emissiveIntensity={0.5} />
          </mesh>
        ))}
        {state.branches.map((b) =>
          b.points.length > 1 ? (
            <Line
              key={b.id}
              points={b.points}
              color={CELL_COLORS[b.cell % CELL_COLORS.length]}
              lineWidth={b.kind === "axon" ? 2.6 : Math.max(0.8, 2.2 - b.order * 0.5)}
              transparent
              opacity={b.kind === "axon" ? 1 : 0.8}
            />
          ) : null,
        )}
        {state.branches
          .filter((b) => b.growing && state.stage !== "pruning" && state.stage !== "mature")
          .map((b) => (
            <mesh key={`cone-${b.id}`} position={b.points[b.points.length - 1]}>
              <sphereGeometry args={[b.kind === "axon" ? 0.03 : 0.018, 12, 12]} />
              <meshBasicMaterial color="#fff3b0" toneMapped={false} />
            </mesh>
          ))}
        {state.synapses.map((s, i) => (
          <mesh key={`syn-${i}`} position={s.at}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial
              color={s.pruned ? "#4b5563" : "#7cf29a"}
              emissive={s.pruned ? "#000000" : "#7cf29a"}
              emissiveIntensity={s.pruned ? 0 : 1.3}
              transparent
              opacity={s.pruned ? 0.35 : 1}
            />
          </mesh>
        ))}
        {state.cells.map((c) =>
          c.target && state.stage === "guidance" ? (
            <mesh key={`t-${c.id}`} position={c.target}>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshBasicMaterial color={CELL_COLORS[c.id % CELL_COLORS.length]} transparent opacity={0.05} />
            </mesh>
          ) : null,
        )}
      </group>
      <OrbitControls enablePan={false} minDistance={2} maxDistance={8} />
    </Canvas>
  );
}
