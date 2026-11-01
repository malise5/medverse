"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { create } from "zustand";

/**
 * Part labels ("left ventricle", "aorta" …) drawn as plain DOM over the canvas.
 *
 * The scene publishes each label's world anchor; the overlay renders the labels as normal
 * React DOM outside the WebGL canvas; a projector inside the canvas moves them on every
 * rendered frame by writing the elements' transforms directly. Unlike drei's <Html>, no
 * extra React roots are created, so the viewer can mount and unmount freely (for example
 * inside a learning module's lab pane).
 */
export interface PartLabel {
  id: string;
  name: string;
  color: string;
}

interface LabelState {
  labels: PartLabel[];
  setLabels: (labels: PartLabel[]) => void;
}

export const useLabelStore = create<LabelState>((set) => ({
  labels: [],
  setLabels: (labels) => set({ labels }),
}));

/** World-space anchors (scene metres) by label id; written by the scene. */
export const labelAnchors = new Map<string, Vector3>();
/** Overlay elements by label id; registered by the overlay. */
const labelElements = new Map<string, HTMLDivElement>();

const tmp = new Vector3();

/** Inside <Canvas>: positions the overlay labels for the current camera. */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    for (const [id, el] of labelElements) {
      const at = labelAnchors.get(id);
      if (!at) {
        el.style.visibility = "hidden";
        continue;
      }
      tmp.copy(at).project(camera);
      const behind = tmp.z > 1;
      el.style.visibility = behind ? "hidden" : "visible";
      const x = (tmp.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

/** Outside <Canvas>, in the same positioned container: the label elements. */
export function PartLabelOverlay() {
  const labels = useLabelStore((s) => s.labels);
  useEffect(() => () => labelElements.clear(), []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {labels.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) labelElements.set(p.id, el);
            else labelElements.delete(p.id);
          }}
          style={{ visibility: "hidden" }}
          className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border bg-background/85 px-2 py-0.5 text-[11px] shadow backdrop-blur"
        >
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
        </div>
      ))}
    </div>
  );
}
