"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Input } from "@/components/ui/input";
import { useSearch } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

import { SYSTEM_COLORS } from "../engine/palette";

export function SearchPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const results = useSearch(deferred);
  const hits = deferred.trim().length >= 2 ? (results.data ?? []) : [];

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="searchbox"
          aria-label="Search anatomical structures"
          placeholder="Search structures, synonyms, Latin…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {results.isError && <p className="text-xs text-destructive">Search failed. Try again.</p>}
      {deferred.trim().length >= 2 && !results.isFetching && hits.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No structures match “{deferred}”.</p>
      )}
      <ul className={cn("grid gap-0.5", results.isFetching && "opacity-70")} aria-label="Search results">
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
                    matched “{h.matched_text}”
                  </span>
                )}
              </span>
              {!h.has_geometry && (
                <span className="text-[10px] text-muted-foreground" title="No 3D mesh available">
                  no mesh
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
