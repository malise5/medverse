"use client";

import { ArrowRight, BookA, Box, Layers3 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { EducationalDisclaimer } from "@/features/governance/badges";
import { useLearningModules } from "@/lib/api/queries";
import type { ModuleSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { LevelSwitch } from "./level-switch";
import { LEVELS, useLearningLevel } from "./levels";

const PRESETS: { label: string; systems: string[] }[] = [
  { label: "Skeleton", systems: ["skeletal"] },
  { label: "Skeleton and muscles", systems: ["skeletal", "muscular"] },
  { label: "Heart, vessels and lungs", systems: ["cardiovascular", "respiratory"] },
  { label: "Organs of the trunk", systems: ["digestive", "urinary", "respiratory", "cardiovascular"] },
];

export function ProgressBar({ answered, correct, total, className }: { answered: number; correct: number; total: number; className?: string }) {
  const pct = (n: number) => (total ? (100 * n) / total : 0);
  return (
    <div
      role="img"
      aria-label={`${correct} of ${total} questions correct, ${answered} answered`}
      className={cn("flex h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="bg-primary" style={{ width: `${pct(correct)}%` }} />
      <div className="bg-primary/35" style={{ width: `${pct(answered - correct)}%` }} />
    </div>
  );
}

function ModuleCard({ m }: { m: ModuleSummary }) {
  const p = m.progress;
  return (
    <Link
      href={`/learn/${m.id}`}
      className="group grid gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: SYSTEM_COLORS[m.id] }} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight group-hover:text-primary">{m.title}</h3>
          {m.latin_name && <p className="text-xs italic text-muted-foreground">{m.latin_name}</p>}
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground">{m.tagline}</p>
      <div className="mt-auto grid gap-1.5">
        <ProgressBar answered={p.answered} correct={p.correct} total={p.questions} />
        <p className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>
            Quiz: {p.correct}/{p.questions} correct
          </span>
          <span>{m.mesh_count ? `${m.structure_count} structures in 3D` : "Described only"}</span>
        </p>
      </div>
    </Link>
  );
}

function BodyBuilder({ modules }: { modules: ModuleSummary[] }) {
  const [chosen, setChosen] = useState<string[]>(["skeletal"]);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const href = `/anatomy?systems=${encodeURIComponent(chosen.join(","))}`;
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="size-4 text-primary" aria-hidden /> Build the body, one system at a time
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the systems to show, then open them together in the 3D explorer to see how they fit and overlap.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Systems to show">
          {modules.map((m) => {
            const on = chosen.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                disabled={!m.mesh_count}
                onClick={() => toggle(m.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                  on ? "border-primary/60 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span aria-hidden className="size-2 rounded-full" style={{ background: SYSTEM_COLORS[m.id] }} />
                {m.title.replace(/ system$/, "")}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Presets:</span>
          {PRESETS.map((p) => (
            <Button key={p.label} size="xs" variant="ghost" onClick={() => setChosen(p.systems)}>
              {p.label}
            </Button>
          ))}
        </div>
        <Button className="justify-self-start" disabled={!chosen.length} asChild={chosen.length > 0}>
          {chosen.length ? (
            <Link href={href}>
              <Box /> View {chosen.length} system{chosen.length > 1 ? "s" : ""} in 3D
            </Link>
          ) : (
            <span>Choose at least one system</span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function LearningHub() {
  const modules = useLearningModules();
  const [level, setLevel] = useLearningLevel();
  const totals = (modules.data ?? []).reduce(
    (t, m) => ({ q: t.q + m.progress.questions, a: t.a + m.progress.answered, c: t.c + m.progress.correct }),
    { q: 0, a: 0, c: 0 },
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6">
      <header className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Body systems</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Study the human body system by system. Every module is written at three levels, uses the international
            anatomical terminology (Terminologia Anatomica 2) with Latin names, gives measurements in SI units, links
            each organ to the 3D model and ends with a quiz.
          </p>
        </div>
        <div className="grid gap-1 justify-self-start md:justify-self-end">
          <span className="text-xs text-muted-foreground">Your level: {LEVELS.find((l) => l.id === level)?.hint}</span>
          <LevelSwitch value={level} onChange={setLevel} />
        </div>
      </header>

      {modules.isError && <p role="alert" className="text-sm text-destructive">Could not load the learning modules.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {modules.data ? <BodyBuilder modules={modules.data} /> : <Skeleton className="h-48" />}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-3xl font-semibold tabular-nums">
              {totals.c}
              <span className="text-base font-normal text-muted-foreground"> / {totals.q} correct</span>
            </p>
            <ProgressBar answered={totals.a} correct={totals.c} total={totals.q} />
            <p className="text-xs text-muted-foreground">{totals.a} questions attempted. Your latest answer to each question counts.</p>
            <Button variant="secondary" size="sm" className="justify-self-start" asChild>
              <Link href="/learn/glossary">
                <BookA /> Glossary of terms
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="modules-h" className="grid gap-3">
        <h2 id="modules-h" className="text-lg font-semibold">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.data
            ? modules.data.map((m) => <ModuleCard key={m.id} m={m} />)
            : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </section>

      <EducationalDisclaimer text="Learning content is written from cited standard references and is a draft pending review by credentialed anatomists. It is for education only." />
    </div>
  );
}
