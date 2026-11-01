"use client";

import { useEffect } from "react";

import { useWorkspace } from "@/features/anatomy/store";
import type { AudienceLevel, LearningLevel } from "@/lib/api/types";

/** The three study levels of the learning modules, in order of depth. */
export const LEVELS: { id: LearningLevel; label: string; hint: string }[] = [
  { id: "basic", label: "Beginner", hint: "No prior study needed" },
  { id: "undergraduate", label: "Intermediate", hint: "University or early medical studies" },
  { id: "clinical", label: "Advanced", hint: "Clinical application" },
];

export function levelLabel(level: string): string {
  return LEVELS.find((l) => l.id === level)?.label ?? level;
}

/** Workspace content levels deeper than "clinical" read the clinical module text. */
export function toLearningLevel(audience: AudienceLevel): LearningLevel {
  return audience === "basic" || audience === "undergraduate" ? audience : "clinical";
}

const STORAGE_KEY = "medverse.level";

function readStored(): AudienceLevel | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "basic" || v === "undergraduate" || v === "clinical" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The learner's study level. Shared with the 3D explorer's content level so that a
 * beginner sees beginner text in both places; remembered in this browser only.
 */
export function useLearningLevel(): [LearningLevel, (level: LearningLevel) => void] {
  const audience = useWorkspace((s) => s.audience);
  const setAudience = useWorkspace((s) => s.setAudience);
  useEffect(() => {
    const stored = readStored();
    if (stored && stored !== useWorkspace.getState().audience) setAudience(stored);
  }, [setAudience]);
  const set = (level: LearningLevel) => {
    setAudience(level);
    try {
      window.localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // storage unavailable (private mode): the choice lasts for this session only
    }
  };
  return [toLearningLevel(audience), set];
}

/** Questions at or below the learner's level, deepest last. */
export function questionsForLevel<T extends { level: LearningLevel }>(questions: T[], level: LearningLevel): T[] {
  const max = LEVELS.findIndex((l) => l.id === level);
  return questions.filter((q) => LEVELS.findIndex((l) => l.id === q.level) <= max);
}
