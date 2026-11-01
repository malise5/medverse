"use client";

import { BookOpen, Box, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLearningModules, useSearch } from "@/lib/api/queries";
import { useLocalePath, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  kind: "module" | "structure";
  label: string;
  hint: string;
  href: string;
}

/**
 * Search everything from anywhere (Ctrl/⌘ K): body-system modules open their module page,
 * anatomical structures open in the 3D explorer, focused.
 */
export function GlobalSearch() {
  const { t } = useT();
  const lp = useLocalePath();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  // Fetched only when the palette opens: loading it with the shell would fill the cache
  // before the page below hydrates (a server/client mismatch).
  const modules = useLearningModules(open);
  const hits = useSearch(open ? q : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const mods: Result[] = (modules.data ?? [])
      // Titles only: taglines mention many words ("hearing") and would crowd out organs.
      .filter((m) => m.title.toLowerCase().includes(term))
      .slice(0, 4)
      .map((m) => ({ id: m.id, kind: "module", label: m.title, hint: m.tagline, href: `/learn/${m.id}` }));
    const structs: Result[] = (hits.data ?? []).slice(0, 8).map((h) => ({
      id: h.id,
      kind: "structure",
      label: h.name,
      hint: h.matched_text && h.matched_text !== h.name ? h.matched_text : t("search.openIn3d"),
      href: `/anatomy?structure=${encodeURIComponent(h.id)}`,
    }));
    return [...mods, ...structs];
  }, [q, modules.data, hits.data, t]);

  const go = (r: Result) => {
    setOpen(false);
    setQ("");
    router.push(lp(r.href));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-full border bg-card px-3.5 text-sm text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{t("search.placeholder")}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQ("");
        }}
      >
        <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
          <DialogTitle className="sr-only">{t("search.title")}</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  go(results[active]);
                }
              }}
              placeholder={t("search.inputPlaceholder")}
              aria-label={t("search.title")}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul id="global-search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.hint")}</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {hits.isFetching ? t("common.loading") : t("search.noResults")}
              </li>
            ) : (
              results.map((r, i) => (
                <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                      i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      {r.kind === "module" ? <BookOpen className="size-4" /> : <Box className="size-4" />}
                    </span>
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-medium first-letter:uppercase">{r.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {r.kind === "module" ? t("search.module") : t("search.structure")} · {r.hint}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
