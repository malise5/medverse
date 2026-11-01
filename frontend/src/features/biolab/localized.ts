"use client";

import { useMemo } from "react";

import type { Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";

import { type Pathway, PATHWAYS } from "./pathways";
import { type ProcessMeta, PROCESSES } from "./processes";
import { PATHWAYS_SW, PROCESSES_SW } from "./text.sw";

/** Processes with their wording in `locale`; English where no translation exists. */
export function localizeProcesses(locale: Locale): ProcessMeta[] {
  if (locale !== "sw") return PROCESSES;
  return PROCESSES.map((p) => ({ ...p, ...PROCESSES_SW[p.id] }));
}

/** Pathways with their wording in `locale`; steps keep their structures and order. */
export function localizePathways(locale: Locale): Pathway[] {
  if (locale !== "sw") return PATHWAYS;
  return PATHWAYS.map((pw) => {
    const tr = PATHWAYS_SW[pw.id];
    if (!tr) return pw;
    return {
      ...pw,
      title: tr.title,
      summary: tr.summary,
      steps: pw.steps.map((s, i) => ({ ...s, ...tr.steps[i] })),
    };
  });
}

export function useProcesses(): ProcessMeta[] {
  const locale = useLocale();
  return useMemo(() => localizeProcesses(locale), [locale]);
}

export function usePathways(): Pathway[] {
  const locale = useLocale();
  return useMemo(() => localizePathways(locale), [locale]);
}
