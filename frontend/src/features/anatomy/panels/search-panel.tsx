"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Input } from "@/components/ui/input";
import { useSearch } from "@/lib/api/queries";
import type { AnatomicalSystem } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { SYSTEM_COLORS } from "../engine/palette";

/** Everyday words for whole systems (UI search aliases, not anatomical synonyms). */
const SYSTEM_ALIASES: Record<string, string[]> = {
  cardiovascular: ["circulatory", "circulation", "blood vessels", "heart and vessels"],
  skeletal: ["skeleton", "bones"],
  muscular: ["muscles"],
  nervous: ["nerves", "neural"],
  respiratory: ["breathing", "airways"],
  digestive: ["gut", "gastrointestinal"],
  urinary: ["renal", "kidneys and bladder"],
  integumentary: ["skin"],
};

export function matchSystems(systems: AnatomicalSystem[], query: string): AnatomicalSystem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  return systems.filter((sys) => {
    if (!sys.mesh_count) return false;
    const terms = [sys.name.toLowerCase(), sys.id, ...(SYSTEM_ALIASES[sys.id] ?? [])];
    return terms.some((t) => t.includes(q) || (q.includes(t) && t.length >= 4));
  });
}

export function SearchPanel({
  onSelect,
  systems = [],
  onSelectSystem,
}: {
  onSelect: (id: string) => void;
  systems?: AnatomicalSystem[];
  onSelectSystem?: (systemId: string) => void;
}) {
  const [q, setQ] = useState("");
  const { t } = useT();
  const deferred = useDeferredValue(q);
  const results = useSearch(deferred);
  const hits = deferred.trim().length >= 2 ? (results.data ?? []) : [];
  const systemHits = onSelectSystem ? matchSystems(systems, deferred) : [];

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="searchbox"
          aria-label={t("explorer.search.aria")}
          placeholder={t("explorer.search.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            aria-label={t("explorer.search.clear")}
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {results.isError && <p className="text-xs text-destructive">{t("explorer.search.failed")}</p>}
      {deferred.trim().length >= 2 && !results.isFetching && hits.length === 0 && !systemHits.length && (
        <p className="px-1 text-xs text-muted-foreground">{t("explorer.search.noMatch", { q: deferred })}</p>
      )}
      {systemHits.length > 0 && (
        <ul className="grid gap-0.5" aria-label={t("explorer.search.systems")}>
          {systemHits.map((sys) => (
            <li key={sys.id}>
              <button
                type="button"
                onClick={() => onSelectSystem?.(sys.id)}
                className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-left text-sm hover:bg-primary/10"
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: SYSTEM_COLORS[sys.id] }} />
                <span className="flex-1 truncate">{sys.name}</span>
                <span className="text-[10px] text-muted-foreground">{t("explorer.search.wholeSystem", { count: sys.structure_count })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className={cn("grid gap-0.5", results.isFetching && "opacity-70")} aria-label={t("explorer.search.results")}>
        {hits.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h.id)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: SYSTEM_COLORS[h.system_id ?? "unclassified"] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{h.name}</span>
                {h.matched_text.toLowerCase() !== h.name.toLowerCase() && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("explorer.search.matched", { text: h.matched_text })}
                  </span>
                )}
              </span>
              {!h.has_geometry && (
                <span className="text-[10px] text-muted-foreground" title={t("explorer.search.noMeshTitle")}>
                  {t("explorer.search.noMesh")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
