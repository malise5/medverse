"use client";

import { Activity, ArrowLeft, Languages, Box, Crosshair, ExternalLink, Info, Play, Sprout, Stethoscope, Target } from "lucide-react";
import { Link, useT } from "@/lib/i18n/client";
import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { EducationalDisclaimer, ReferenceList, VerificationBadge } from "@/features/governance/badges";
import { linkedAnatomy } from "@/features/physiology/physiology-lab";
import { useLearningModule, useLearningModules, useModels } from "@/lib/api/queries";
import type { ModuleDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ProgressBar } from "./learning-hub";
import { LevelSwitch } from "./level-switch";
import { SystemIcon } from "./system-icon";
import { labItems, ModuleLab, ModuleSplit, useModuleLab } from "./module-lab";
import { useLearningLevel, useLevelText } from "./levels";
import { Quiz } from "./quiz";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold">
      {children}
    </h2>
  );
}

function Organs({ m, lab }: { m: ModuleDetail; lab: Lab }) {
  const { t } = useT();
  return (
    <section aria-labelledby="organs-h" className="grid gap-3">
      <SectionTitle id="organs-h">{t("module.organs")}</SectionTitle>
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
                    {t("module.bodyOnly", { body: t(o.body_models[0] === "male" ? "common.maleBody" : "common.femaleBody") })}
                  </Badge>
                )}
                {(() => {
                  const showing = lab.tab === "3d" && lab.params.get("structure") === o.structure_id;
                  return (
                    <Button
                      size="xs"
                      variant={showing ? "default" : "secondary"}
                      aria-pressed={showing}
                      onClick={() =>
                        lab.open("3d", {
                          structure: o.structure_id,
                          model: o.body_models.length === 1 ? o.body_models[0] : null,
                        })
                      }
                    >
                      <Box /> {showing ? t("module.showingIn3d") : t("module.viewIn3d")}
                    </Button>
                  );
                })()}
              </div>
            ) : (
              <Badge variant="outline" className="self-start text-[10px] text-muted-foreground sm:self-center">
                {t("module.notIn3d")}
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

function Simulate({ m, lab }: { m: ModuleDetail; lab: Lab }) {
  const { t } = useT();
  const models = useModels();
  const items = labItems(m.id, models.data ?? []);
  if (!items.length) return null;
  return (
    <section aria-labelledby="simulate-h" className="grid gap-3">
      <SectionTitle id="simulate-h">
        <span className="flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden /> {t("module.simulateIt")}
        </span>
      </SectionTitle>
      <p className="text-sm text-muted-foreground">
        {t("module.simulateIntro")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => {
          const active = lab.tab === "sim" && (lab.params.get("sim") ?? items[0].id) === i.id;
          const link = i.model ? linkedAnatomy(i.model) : null;
          return (
            <div
              key={i.id}
              className={cn("grid gap-2 rounded-lg border p-3 transition-colors", active && "border-primary/60 bg-primary/5")}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                {i.kind === "growth" ? <Sprout className="size-4 text-primary" /> : <Activity className="size-4 text-primary" />}
                {i.kind === "model" ? i.label : t(i.kind === "growth" ? "lab.neuronsGrowing" : "lab.neuronsCommunicating")}
              </p>
              <p className="text-xs text-muted-foreground">
                {i.model?.summary ??
                  t(i.kind === "growth" ? "module.neuronGrowthSummary" : "module.neuronSignalSummary")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="xs" variant={active ? "default" : "secondary"} onClick={() => lab.open("sim", { sim: i.id })}>
                  <Play /> {active ? t("module.running") : t("module.runSimulation")}
                </Button>
                {link?.play && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      lab.open("3d", { structure: link.structure, highlight: link.highlight.join(","), play: link.play })
                    }
                  >
                    <Box /> {t("module.watchIn3d")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WorksWith({ m }: { m: ModuleDetail }) {
  const { t } = useT();
  const modules = useLearningModules();
  const title = (id: string) => modules.data?.find((x) => x.id === id)?.title ?? id;
  return (
    <section aria-labelledby="works-h" className="grid gap-3">
      <SectionTitle id="works-h">{t("module.worksWith")}</SectionTitle>
      <p className="text-sm text-muted-foreground">{t("module.worksWithIntro", { system: m.title.toLowerCase() })}</p>
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
  const { t } = useT();
  return (
    <section aria-labelledby="terms-h" className="grid gap-3">
      <SectionTitle id="terms-h">{t("module.keyTerms")}</SectionTitle>
      <dl className="grid gap-2 sm:grid-cols-2">
        {m.key_terms.map((term) => (
          <div key={term.term} className="rounded-lg border p-3">
            <dt className="text-sm font-semibold">
              {term.term}
              {term.latin && term.latin !== term.term && <span className="ml-2 text-xs font-normal italic text-muted-foreground">TA: {term.latin}</span>}
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{term.definition}</dd>
            {term.origin && <dd className="mt-1 text-[11px] text-muted-foreground/80">{t("module.wordOrigin", { origin: term.origin })}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

type Lab = ReturnType<typeof useModuleLab>;

export function ModuleView({ moduleId }: { moduleId: string }) {
  const q = useLearningModule(moduleId);
  const [level, setLevel] = useLearningLevel();
  const lab = useModuleLab();
  const models = useModels();
  const { t } = useT();
  const levelText = useLevelText();

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
          {t("module.loadError")}
        </p>
        <Link href="/learn" className="text-sm text-primary hover:underline">
          {t("module.back")}
        </Link>
      </div>
    );
  }
  const m = q.data;
  const p = m.progress;
  const split = lab.tab !== null;
  const hasSims = labItems(m.id, models.data ?? []).length > 0;

  const aside = (
    <>
          <section aria-labelledby="obj-h" className="grid gap-2 rounded-xl border bg-card p-4">
            <h2 id="obj-h" className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-primary" aria-hidden /> {t("module.objectives")}
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
                {t("module.keyFacts")}
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
            <h2 className="text-sm font-semibold">{t("module.quizProgress")}</h2>
            <ProgressBar answered={p.answered} correct={p.correct} total={p.questions} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("module.quizProgressLine", { correct: p.correct, answered: p.answered, total: p.questions })}
            </p>
          </section>
          <Link href="/learn/glossary" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="size-3.5" /> {t("module.glossaryLink")}
          </Link>
    </>
  );

  const article = (
    <div className={cn("grid gap-6 p-4 md:p-6", split ? "mx-auto max-w-3xl" : "mx-auto max-w-6xl")}>
      <Link href="/learn" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {t("module.back")}
      </Link>

      <header className="grid gap-3">
        <div className="flex items-start gap-3">
          <SystemIcon system={m.id} size="lg" />
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold leading-tight">{m.title}</h1>
            {m.latin_name && <p className="text-sm italic text-muted-foreground">{m.latin_name}</p>}
            <p className="max-w-3xl text-sm text-muted-foreground">{m.tagline}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => lab.open("3d", { system: m.id })}>
            <Box /> {t("module.exploreIn3d")}
          </Button>
          {hasSims && (
            <Button size="sm" variant="secondary" onClick={() => lab.open("sim")}>
              <Activity /> {t("module.simulate")}
            </Button>
          )}
          <Button size="sm" variant="secondary" asChild>
            <a href="#quiz">
              <Crosshair /> {t("module.goToQuiz")}
            </a>
          </Button>
          <VerificationBadge status={m.verification_status} />
        </div>
      </header>

      {(m.translation === "partial" || m.translation === "missing") && (
        <p role="note" className="flex gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Languages className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {t(m.translation === "partial" ? "module.translationPartial" : "module.translationMissing")}{" "}
            {t("module.translationDraft")}
          </span>
        </p>
      )}

      {split && (
        <details className="group rounded-xl border bg-card/60 p-3 [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:mb-3">
            {t("module.objectivesSummary")}
          </summary>
          <div className="grid gap-4 sm:grid-cols-2">{aside}</div>
        </details>
      )}

      <div className={cn("grid gap-6", !split && "lg:grid-cols-[1fr_18rem]")}>
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="overview-h" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle id="overview-h">{t("module.overview")}</SectionTitle>
              <LevelSwitch value={level} onChange={setLevel} />
            </div>
            <p className="max-w-prose text-[15px] leading-relaxed text-foreground/90">{m.overview[level]}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("module.levelNote", { level: levelText.label(level).toLowerCase() })}
            </p>
          </section>

          <section aria-labelledby="functions-h" className="grid gap-3">
            <SectionTitle id="functions-h">{t("module.whatItDoes")}</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {m.functions.map((f) => (
                <div key={f.title} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          <Simulate m={m} lab={lab} />
          <Organs m={m} lab={lab} />
          <WorksWith m={m} />
          <KeyTerms m={m} />

          {m.clinical_notes.length > 0 && (
            <section aria-labelledby="clinical-h" className="grid gap-3">
              <SectionTitle id="clinical-h">
                <span className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-primary" aria-hidden /> {t("module.clinical")}
                </span>
              </SectionTitle>
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-foreground/90">
                {m.clinical_notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          <Quiz
            module={m}
            level={level}
            activeQuestion={lab.tab === "3d" ? lab.params.get("quiz") : null}
            onFindIn3D={(question) =>
              lab.open("3d", {
                quiz: question.id,
                module: m.id,
                model: question.body_models.length === 1 ? question.body_models[0] : null,
              })
            }
          />

          <section aria-labelledby="refs-h" className="grid gap-2">
            <SectionTitle id="refs-h">{t("module.sources")}</SectionTitle>
            <p className="text-xs text-muted-foreground">{t("module.sourcesIntro")}</p>
            <ReferenceList references={m.references} />
          </section>
          <EducationalDisclaimer />
        </div>

        {!split && (
          <aside className="grid h-fit gap-4 lg:sticky lg:top-4">{aside}</aside>
        )}
      </div>
    </div>
  );

  return (
    <ModuleSplit
      open={split}
      article={article}
      lab={({ maximized, toggleMaximized }) => (
        <ModuleLab moduleId={m.id} moduleTitle={m.title} maximized={maximized} toggleMaximized={toggleMaximized} />
      )}
    />
  );
}

/** Route entry: reads the module id from the URL (runtime data, rendered under Suspense). */
export function ModuleRoute() {
  const { moduleId } = useParams<{ moduleId: string }>();
  return <ModuleView moduleId={decodeURIComponent(moduleId)} />;
}
