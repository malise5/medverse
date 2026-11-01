"use client";

import type { LearningLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useT } from "@/lib/i18n/client";

import { LEVELS, useLevelText } from "./levels";

/** Segmented control for the study level (a radio group for assistive technology). */
export function LevelSwitch({
  value,
  onChange,
  className,
}: {
  value: LearningLevel;
  onChange: (level: LearningLevel) => void;
  className?: string;
}) {
  const { t } = useT();
  const text = useLevelText();
  return (
    <div role="radiogroup" aria-label={t("levels.label")} className={cn("inline-flex rounded-lg border bg-muted/40 p-0.5", className)}>
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          title={text.hint(l.id)}
          onClick={() => onChange(l.id)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
            value === l.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text.label(l.id)}
        </button>
      ))}
    </div>
  );
}
