"use client";

import { useMemo } from "react";

import { useAssetManifest, useStructureIndex, useSystems } from "@/lib/api/queries";

/** Reference data the workspace needs, plus derived lookup tables. */
export function useAnatomyData() {
  const systems = useSystems();
  const index = useStructureIndex();
  const manifest = useAssetManifest();

  const derived = useMemo(() => {
    const names = new Map<string, string>();
    const systemOf = new Map<string, string | null>();
    const children = new Map<string, string[]>();
    if (index.data) {
      const { ids, names: n, systems: s, parents } = index.data;
      ids.forEach((id, i) => {
        names.set(id, n[i]);
        systemOf.set(id, s[i]);
        const p = parents[i];
        if (p >= 0) {
          const pid = ids[p];
          const list = children.get(pid);
          if (list) list.push(id);
          else children.set(pid, [id]);
        }
      });
      for (const list of children.values()) list.sort((a, b) => names.get(a)!.localeCompare(names.get(b)!));
    }
    // Meshes owned by each (atomic) structure, from the asset manifest.
    const ownedMeshes = new Map<string, string[]>();
    for (const [meshId, [, structureId]] of Object.entries(manifest.data?.meshes ?? {})) {
      const list = ownedMeshes.get(structureId);
      if (list) list.push(meshId);
      else ownedMeshes.set(structureId, [meshId]);
    }
    return { names, systemOf, children, ownedMeshes };
  }, [index.data, manifest.data]);

  return {
    systems: systems.data ?? [],
    manifest: manifest.data,
    index: index.data,
    ...derived,
    isLoading: systems.isLoading || index.isLoading || manifest.isLoading,
    error: systems.error ?? index.error ?? manifest.error,
  };
}

/** Roots of a system's subtree: structures in the system whose parent lies outside it. */
export function systemRoots(
  systemId: string,
  index: { ids: string[]; systems: (string | null)[]; parents: number[] },
): string[] {
  return index.ids.filter((id, i) => {
    if (index.systems[i] !== systemId) return false;
    const p = index.parents[i];
    return p < 0 || index.systems[p] !== systemId;
  });
}
