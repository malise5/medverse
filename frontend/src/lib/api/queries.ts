"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, structurePath } from "./client";
import type {
  AnatomicalSystem,
  AnswerResult,
  AssetManifest,
  AudienceLevel,
  Circulation,
  ConditionDetail,
  ConditionSummary,
  GlossaryEntry,
  ModelDefinition,
  ModuleDetail,
  ModuleSummary,
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
  circulation: (id: string) => ["anatomy", "circulation", id] as const,
  roots: (system: string) => ["anatomy", "roots", system] as const,
  search: (q: string, system?: string) => ["anatomy", "search", q, system ?? ""] as const,
  models: ["simulations", "models"] as const,
  conditions: ["pathology", "conditions"] as const,
  condition: (id: string) => ["pathology", "condition", id] as const,
  modules: ["learning", "modules"] as const,
  module: (id: string) => ["learning", "module", id] as const,
  glossary: ["learning", "glossary"] as const,
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

export function useCirculation(id: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.circulation(id ?? ""),
    queryFn: () => api<Circulation>(`${structurePath(id!)}/circulation`),
    enabled: !!id && enabled,
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

export const modelsQuery = {
  queryKey: qk.models,
  queryFn: () => api<ModelDefinition[]>("/simulations/models"),
  staleTime: REFERENCE_STALE,
};

export function useModels() {
  return useQuery(modelsQuery);
}

export function runSimulation(modelId: string, parameters: Record<string, number> = {}, scenarioId: string | null = null) {
  return api<RunResult>(`/simulations/models/${encodeURIComponent(modelId)}/run`, {
    method: "POST",
    json: { parameters, scenario_id: scenarioId },
  });
}

export function useRunSimulation() {
  return useMutation({
    mutationFn: (args: {
      modelId: string;
      parameters?: Record<string, number>;
      scenarioId?: string | null;
    }) => runSimulation(args.modelId, args.parameters, args.scenarioId ?? null),
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

// --- Learning --------------------------------------------------------------------------

export function useLearningModules() {
  return useQuery({
    queryKey: qk.modules,
    queryFn: () => api<ModuleSummary[]>("/learning/modules"),
  });
}

export function useLearningModule(id: string | null) {
  return useQuery({
    queryKey: qk.module(id ?? ""),
    queryFn: () => api<ModuleDetail>(`/learning/modules/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
}

export function useGlossary() {
  return useQuery({
    queryKey: qk.glossary,
    queryFn: () => api<GlossaryEntry[]>("/learning/glossary"),
    staleTime: REFERENCE_STALE,
  });
}

/** Submit an answer; the server grades it and records progress for the signed-in learner. */
export function useAnswerQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, response }: { questionId: string; response: string }) =>
      api<AnswerResult>(`/learning/questions/${encodeURIComponent(questionId)}/answer`, {
        method: "POST",
        json: { response },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}
