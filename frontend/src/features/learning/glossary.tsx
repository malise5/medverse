"use client";

import { ArrowLeft, Search } from "lucide-react";
import { Link, useT } from "@/lib/i18n/client";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { useGlossary } from "@/lib/api/queries";
import type { GlossaryEntry } from "@/lib/api/types";

/** Case- and accent-insensitive text for matching (e.g. "oesophagus" vs "Œsophagus"). */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en");
}

export function filterGlossary(entries: GlossaryEntry[], query: string, moduleId: string): GlossaryEntry[] {
  const q = fold(query.trim());
  return entries.filter(
    (e) =>
      (!moduleId || e.module_id === moduleId) &&
      (!q || [e.term, e.latin ?? "", e.definition, e.origin ?? ""].some((f) => fold(f).includes(q))),
  );
}

export function Glossary() {
  const g = useGlossary();
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [moduleId, setModuleId] = useState("");
  const modules = useMemo(
    () => [...new Map((g.data ?? []).map((e) => [e.module_id, e.module_title])).entries()],
    [g.data],
  );
  const groups = useMemo(() => {
    const out = new Map<string, GlossaryEntry[]>();
    for (const e of filterGlossary(g.data ?? [], query, moduleId)) {
      const letter = fold(e.term)[0]?.toUpperCase() ?? "#";
      out.set(letter, [...(out.get(letter) ?? []), e]);
    }
    return [...out.entries()];
  }, [g.data, query, moduleId]);
  const count = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 p-4 md:p-6">
      <Link href="/learn" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {t("module.back")}
      </Link>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">{t("glossary.title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("glossary.intro")}</p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("glossary.search")}
            aria-label={t("glossary.searchAria")}
            className="pl-8"
          />
        </div>
        <select
          aria-label={t("glossary.filter")}
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="h-8 rounded-md border border-input bg-input/30 px-2 text-sm"
        >
          <option value="" className="bg-popover">
            {t("glossary.allSystems")}
          </option>
          {modules.map(([id, title]) => (
            <option key={id} value={id} className="bg-popover">
              {title}
            </option>
          ))}
        </select>
      </div>

      {g.isLoading ? (
        <Skeleton className="h-96" />
      ) : g.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the glossary.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {count} term{count === 1 ? "" : "s"}
          </p>
          {groups.map(([letter, list]) => (
            <section key={letter} aria-label={t("glossary.startingWith", { letter })} className="grid gap-2">
              <h2 className="sticky top-0 z-[1] bg-background/90 py-1 text-sm font-semibold text-primary backdrop-blur">{letter}</h2>
              <dl className="grid gap-2 md:grid-cols-2">
                {list.map((e) => (
                  <div key={`${e.module_id}-${e.term}`} className="rounded-lg border p-3">
                    <dt className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                      {e.term}
                      {e.latin && e.latin !== e.term && <span className="text-xs font-normal italic text-muted-foreground">TA: {e.latin}</span>}
                    </dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{e.definition}</dd>
                    {e.origin && <dd className="mt-1 text-[11px] text-muted-foreground/80">Word origin: {e.origin}</dd>}
                    <dd className="mt-2">
                      <Link href={`/learn/${e.module_id}`} className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline">
                        <span aria-hidden className="size-2 rounded-sm" style={{ background: SYSTEM_COLORS[e.module_id] }} />
                        {e.module_title}
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {count === 0 && <p className="text-sm text-muted-foreground">{t("glossary.noMatch")}</p>}
        </>
      )}
    </div>
  );
}
