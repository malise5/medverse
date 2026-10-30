"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, structurePath } from "./client";
import type {
  AnatomicalSystem,
  AssetManifest,
  AudienceLevel,
  ConditionDetail,
  ConditionSummary,
  ModelDefinition,
  RunResult,
  SearchHit,
  StructureDetail,
  StructureIndex,
  StructureSummary,
  User,
} from "./types";

const REFERENCE_STALE = 5 * 60_000;

export const qk = {
  me: ["auth", "me"] as const,
  systems: ["anatomy", "systems"] as const,
  index: ["anatomy", "index"] as const,
  manifest: ["assets", "manifest"] as const,
  structure: (id: string, audience: AudienceLevel) => ["anatomy", "structure", id, audience] as const,
  children: (id: string) => ["anatomy", "children", id] as const,
  roots: (system: string) => ["anatomy", "roots", system] as const,
  search: (q: string, system?: string) => ["anatomy", "search", q, system ?? ""] as const,
  models: ["simulations", "models"] as const,
  conditions: ["pathology", "conditions"] as const,
  condition: (id: string) => ["pathology", "condition", id] as const,
};

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => api<User>("/auth/me"),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => qc.clear(),
  });
}

export function useSystems() {
  return useQuery({
    queryKey: qk.systems,
    queryFn: () => api<AnatomicalSystem[]>("/anatomy/systems"),
    staleTime: REFERENCE_STALE,
  });
}

export function useStructureIndex() {
  return useQuery({
    queryKey: qk.index,
    queryFn: () => api<StructureIndex>("/anatomy/index"),
    staleTime: REFERENCE_STALE,
  });
}

export function useAssetManifest() {
  return useQuery({
    queryKey: qk.manifest,
    queryFn: () => api<AssetManifest>("/assets/manifest"),
    staleTime: REFERENCE_STALE,
  });
}

export function useStructure(id: string | null, audience: AudienceLevel = "undergraduate") {
  return useQuery({
    queryKey: qk.structure(id ?? "", audience),
    queryFn: () => api<StructureDetail>(structurePath(id!), { query: { audience } }),
    enabled: !!id,
    staleTime: REFERENCE_STALE,
  });
}

export function useChildren(id: string | null) {
  return useQuery({
    queryKey: qk.children(id ?? ""),
    queryFn: () => api<StructureSummary[]>(`${structurePath(id!)}/children`),
    enabled: !!id,
    staleTime: REFERENCE_STALE,
  });
}

export function useHierarchyRoots(system: string | null) {
  return useQuery({
    queryKey: qk.roots(system ?? ""),
    queryFn: () => api<StructureSummary[]>("/anatomy/hierarchy/roots", { query: { system } }),
    enabled: !!system,
    staleTime: REFERENCE_STALE,
  });
}

export function useSearch(q: string, system?: string) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.search(term, system),
    queryFn: ({ signal }) =>
      api<SearchHit[]>("/anatomy/search", { query: { q: term, system, limit: 25 }, signal }),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: REFERENCE_STALE,
  });
}

export function useModels() {
  return useQuery({
    queryKey: qk.models,
    queryFn: () => api<ModelDefinition[]>("/simulations/models"),
    staleTime: REFERENCE_STALE,
  });
}

export function useRunSimulation() {
  return useMutation({
    mutationFn: (args: {
      modelId: string;
      parameters?: Record<string, number>;
      scenarioId?: string | null;
    }) =>
      api<RunResult>(`/simulations/models/${encodeURIComponent(args.modelId)}/run`, {
        method: "POST",
        json: { parameters: args.parameters ?? {}, scenario_id: args.scenarioId ?? null },
      }),
  });
}

export function useConditions() {
  return useQuery({
    queryKey: qk.conditions,
    queryFn: () => api<ConditionSummary[]>("/pathology/conditions"),
    staleTime: REFERENCE_STALE,
  });
}

export function useCondition(id: string | null) {
  return useQuery({
    queryKey: qk.condition(id ?? ""),
    queryFn: () => api<ConditionDetail>(`/pathology/conditions/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: REFERENCE_STALE,
  });
}
