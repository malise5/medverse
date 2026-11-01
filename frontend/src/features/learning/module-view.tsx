"use client";

import { ArrowLeft, Box, Crosshair, ExternalLink, Info, Stethoscope, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { EducationalDisclaimer, ReferenceList, VerificationBadge } from "@/features/governance/badges";
import { useLearningModule, useLearningModules } from "@/lib/api/queries";
import type { ModuleDetail } from "@/lib/api/types";

import { ProgressBar } from "./learning-hub";
import { LevelSwitch } from "./level-switch";
import { levelLabel, useLearningLevel } from "./levels";
import { Quiz } from "./quiz";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold">
      {children}
    </h2>
  );
}

function Organs({ m }: { m: ModuleDetail }) {
  return (
    <section aria-labelledby="organs-h" className="grid gap-3">
      <SectionTitle id="organs-h">Main organs and structures</SectionTitle>
      <ul className="divide-y rounded-xl border">
        {m.organs.map((o) => (
          <li key={o.name} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {o.name}
                {o.latin && <span className="ml-2 text-xs font-normal italic text-muted-foreground">{o.latin}</span>}
              </p>
              <p className="text-sm text-muted-foreground">{o.role}</p>
            </div>
            {o.in_3d && o.structure_id ? (
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
                {o.body_models.length === 1 && (
                  <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
                    {o.body_models[0]} body
                  </Badge>
                )}
                <Button size="xs" variant="secondary" asChild>
                  <Link
                    href={`/anatomy?structure=${encodeURIComponent(o.structure_id)}${
                      o.body_models.length === 1 ? `&model=${o.body_models[0]}` : ""
                    }`}
                  >
                    <Box /> View in 3D
                  </Link>
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="self-start text-[10px] text-muted-foreground sm:self-center">
                Not in the 3D model yet
              </Badge>
            )}
          </li>
        ))}
      </ul>
      {m.asset_note && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 translate-y-0.5" aria-hidden /> {m.asset_note}
        </p>
      )}
    </section>
  );
}

function WorksWith({ m }: { m: ModuleDetail }) {
  const modules = useLearningModules();
  const title = (id: string) => modules.data?.find((x) => x.id === id)?.title ?? id;
  return (
    <section aria-labelledby="works-h" className="grid gap-3">
      <SectionTitle id="works-h">Working with other systems</SectionTitle>
      <p className="text-sm text-muted-foreground">No system works alone. These are the main partnerships of the {m.title.toLowerCase()}.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {m.works_with.map((w) => (
          <Link
            key={w.system}
            href={`/learn/${w.system}`}
            className="grid gap-1 rounded-lg border p-3 transition-colors hover:border-primary/50"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SYSTEM_COLORS[w.system] }} />
              {title(w.system)}
            </span>
            <span className="text-sm text-muted-foreground">{w.body}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function KeyTerms({ m }: { m: ModuleDetail }) {
  return (
    <section aria-labelledby="terms-h" className="grid gap-3">
      <SectionTitle id="terms-h">Key terms</SectionTitle>
      <dl className="grid gap-2 sm:grid-cols-2">
        {m.key_terms.map((t) => (
          <div key={t.term} className="rounded-lg border p-3">
            <dt className="text-sm font-semibold">
              {t.term}
              {t.latin && t.latin !== t.term && <span className="ml-2 text-xs font-normal italic text-muted-foreground">TA: {t.latin}</span>}
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t.definition}</dd>
            {t.origin && <dd className="mt-1 text-[11px] text-muted-foreground/80">Word origin: {t.origin}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ModuleView({ moduleId }: { moduleId: string }) {
  const q = useLearningModule(moduleId);
  const [level, setLevel] = useLearningLevel();

  if (q.isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 p-4 md:p-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto grid max-w-6xl gap-3 p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">
          This module could not be loaded.
        </p>
        <Link href="/learn" className="text-sm text-primary hover:underline">
          Back to body systems
        </Link>
      </div>
    );
  }
  const m = q.data;
  const p = m.progress;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6">
      <Link href="/learn" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Body systems
      </Link>

      <header className="grid gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-2 size-4 shrink-0 rounded" style={{ background: SYSTEM_COLORS[m.id] }} />
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold leading-tight">{m.title}</h1>
            {m.latin_name && <p className="text-sm italic text-muted-foreground">{m.latin_name}</p>}
            <p className="max-w-3xl text-sm text-muted-foreground">{m.tagline}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link href={`/anatomy?system=${encodeURIComponent(m.id)}`}>
              <Box /> Explore in 3D
            </Link>
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <a href="#quiz">
              <Crosshair /> Go to the quiz
            </a>
          </Button>
          <VerificationBadge status={m.verification_status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="overview-h" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle id="overview-h">Overview</SectionTitle>
              <LevelSwitch value={level} onChange={setLevel} />
            </div>
            <p className="max-w-prose text-[15px] leading-relaxed text-foreground/90">{m.overview[level]}</p>
            <p className="text-[11px] text-muted-foreground">
              Showing the {levelLabel(level).toLowerCase()} explanation. Switch level to read it in more or less depth.
            </p>
          </section>

          <section aria-labelledby="functions-h" className="grid gap-3">
            <SectionTitle id="functions-h">What it does</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {m.functions.map((f) => (
                <div key={f.title} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          <Organs m={m} />
          <WorksWith m={m} />
          <KeyTerms m={m} />

          {m.clinical_notes.length > 0 && (
            <section aria-labelledby="clinical-h" className="grid gap-3">
              <SectionTitle id="clinical-h">
                <span className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-primary" aria-hidden /> Clinical relevance
                </span>
              </SectionTitle>
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-foreground/90">
                {m.clinical_notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          <Quiz module={m} level={level} />

          <section aria-labelledby="refs-h" className="grid gap-2">
            <SectionTitle id="refs-h">Sources</SectionTitle>
            <p className="text-xs text-muted-foreground">
              Original text written from these references. Terminology follows Terminologia Anatomica 2 (FIPAT).
            </p>
            <ReferenceList references={m.references} />
          </section>
          <EducationalDisclaimer />
        </div>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-4">
          <section aria-labelledby="obj-h" className="grid gap-2 rounded-xl border bg-card p-4">
            <h2 id="obj-h" className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-primary" aria-hidden /> You will be able to
            </h2>
            <ul className="grid list-disc gap-1.5 pl-4 text-sm text-muted-foreground">
              {m.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
          {m.facts.length > 0 && (
            <section aria-labelledby="facts-h" className="grid gap-2 rounded-xl border bg-card p-4">
              <h2 id="facts-h" className="text-sm font-semibold">
                Key facts
              </h2>
              <dl className="grid gap-2">
                {m.facts.map((f) => (
                  <div key={f.label} className="grid gap-0.5 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{f.value}</dd>
                    {f.note && <dd className="text-[11px] text-muted-foreground">{f.note}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="grid gap-2 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Your quiz progress</h2>
            <ProgressBar answered={p.answered} correct={p.correct} total={p.questions} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {p.correct} correct · {p.answered} of {p.questions} attempted
            </p>
          </section>
          <Link href="/learn/glossary" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="size-3.5" /> Full glossary of terms
          </Link>
        </aside>
      </div>
    </div>
  );
}

/** Route entry: reads the module id from the URL (runtime data, rendered under Suspense). */
export function ModuleRoute() {
  const { moduleId } = useParams<{ moduleId: string }>();
  return <ModuleView moduleId={decodeURIComponent(moduleId)} />;
}
