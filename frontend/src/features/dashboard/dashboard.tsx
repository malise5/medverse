"use client";

import { Activity, ArrowRight, BookOpen, Box, Brain, Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

import { MODULES } from "@/components/shell/modules";
import { Skeleton } from "@/components/ui/skeleton";
import { EducationalDisclaimer } from "@/features/governance/badges";
import { ProgressBar } from "@/features/learning/learning-hub";
import { SystemIcon } from "@/features/learning/system-icon";
import { useBodyModels, useLearningModules, useMe, useModels, useSystems } from "@/lib/api/queries";
import type { ModuleSummary } from "@/lib/api/types";
import { Link, useT } from "@/lib/i18n/client";

const QUICK_STARTS = [
  { label: "heart", id: "FMA:7088" },
  { label: "brain", id: "FMA:50801" },
  { label: "liver", id: "FMA:7197" },
  { label: "aorta", id: "FMA:3734" },
  { label: "femur", id: "FMA:24474" },
  { label: "femoralArtery", id: "FMA:70249" },
] as const;

const noopSubscribe = () => () => {};

/** The module to suggest: the one in progress with most answers, else the first one. */
function nextModule(modules: ModuleSummary[]): { module: ModuleSummary; started: boolean } | null {
  if (!modules.length) return null;
  const inProgress = modules
    .filter((m) => m.progress.answered > 0 && m.progress.answered < m.progress.questions)
    .sort((a, b) => b.progress.answered - a.progress.answered)[0];
  if (inProgress) return { module: inProgress, started: true };
  const fresh = modules.find((m) => m.progress.answered === 0);
  return { module: fresh ?? modules[0], started: false };
}

/** Progress ring for the overall quiz score. */
function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = total ? value / total : 0;
  return (
    <figure className="relative grid size-24 place-items-center" aria-label={label}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
        />
      </svg>
      <span className="text-xl font-bold tabular-nums">{Math.round(frac * 100)}%</span>
    </figure>
  );
}

export function Dashboard() {
  const { t } = useT();
  const me = useMe();
  const modules = useLearningModules();
  const systems = useSystems();
  const bodies = useBodyModels();
  const models = useModels();
  // Data fetched by other components may already be cached when this page hydrates;
  // use it only after hydration so server and client render the same first HTML.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const list = hydrated ? (modules.data ?? []) : [];
  const next = nextModule(list);
  const totals = list.reduce(
    (acc, m) => ({ q: acc.q + m.progress.questions, c: acc.c + m.progress.correct }),
    { q: 0, c: 0 },
  );
  const structures = hydrated ? systems.data?.reduce((n, s) => n + s.structure_count, 0) : undefined;
  const meshes = hydrated ? bodies.data?.reduce((n, b) => n + b.mesh_count, 0) : undefined;
  const modelCount = hydrated ? models.data?.length : undefined;
  const firstName = me.data?.full_name.split(" ")[0];

  const actions = [
    { href: "/learn", icon: BookOpen, key: "study" },
    { href: "/anatomy", icon: Box, key: "anatomy" },
    { href: "/anatomy?region=head", icon: Brain, key: "head" },
    { href: "/physiology", icon: Activity, key: "sim" },
  ] as const;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 p-4 md:p-8">
      {/* Hero: greeting, next step, overall score */}
      <section className="relative overflow-hidden rounded-3xl bg-[image:var(--hero)] p-6 text-white shadow-lg md:p-8">
        {/* Heartbeat motif, top right, away from the text and buttons. */}
        <svg aria-hidden viewBox="0 0 300 80" className="pointer-events-none absolute right-0 top-4 hidden h-16 w-80 opacity-20 md:block">
          <path d="M0 45h90l12-20 16 46 18-70 14 52 10-8h140" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="grid flex-1 gap-3">
            <p className="text-sm font-medium text-white/80">MEDVERSE Africa</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {hydrated && firstName ? t("home.welcomeName", { name: firstName }) : t("home.welcome")}
            </h1>
            <p className="max-w-xl text-white/85">{t("home.heroBody")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {next ? (
                <Link
                  href={`/learn/${next.module.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[oklch(0.38_0.08_200)] shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  {t(next.started ? "home.continue" : "home.start", { module: next.module.title })}
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Skeleton className="h-10 w-56 rounded-full bg-white/30" />
              )}
              <Link
                href="/anatomy"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Box className="size-4" /> {t("home.explore3d")}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 md:flex-col md:text-center">
            <Ring value={totals.c} total={totals.q} label={t("home.overall")} />
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold">{t("home.overall")}</p>
              <p className="text-xs text-white/80 tabular-nums">{t("home.correctOf", { correct: totals.c, total: totals.q })}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-h" className="grid gap-4">
        <h2 id="quick-h" className="text-lg font-bold">
          {t("home.quickTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {actions.map(({ href, icon: Icon, key }) => (
            <Link
              key={key}
              href={href}
              className="group grid content-start gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <span className="grid gap-1">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold sm:text-base">
                  {t(`home.actions.${key}.title`)}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="hidden text-sm text-muted-foreground sm:block">{t(`home.actions.${key}.body`)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Progress by system */}
        <section aria-labelledby="progress-h" className="grid content-start gap-4">
          <div className="flex items-center justify-between">
            <h2 id="progress-h" className="text-lg font-bold">
              {t("home.progressTitle")}
            </h2>
            <Link href="/learn" className="text-sm font-semibold text-primary hover:underline">
              {t("home.seeAll")}
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.length
              ? list.map((m) => (
                  <Link
                    key={m.id}
                    href={`/learn/${m.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <SystemIcon system={m.id} />
                    <span className="grid min-w-0 flex-1 gap-1.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{m.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {m.progress.answered ? `${m.progress.correct}/${m.progress.questions}` : t("home.notStarted")}
                        </span>
                      </span>
                      <ProgressBar answered={m.progress.answered} correct={m.progress.correct} total={m.progress.questions} />
                    </span>
                  </Link>
                ))
              : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </section>

        <aside className="grid content-start gap-6">
          {/* Jump to an organ */}
          <section aria-labelledby="jump-h" className="grid gap-3 rounded-2xl border bg-card p-5">
            <h2 id="jump-h" className="font-bold">
              {t("home.jumpTitle")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {QUICK_STARTS.map((q) => (
                <Link
                  key={q.id}
                  href={`/anatomy?structure=${encodeURIComponent(q.id)}`}
                  className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  {t(`dashboard.quick.${q.label}`)}
                </Link>
              ))}
              <Link
                href="/anatomy?region=neck"
                className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                {t("home.neck")}
              </Link>
            </div>
          </section>

          {/* What's inside */}
          <section aria-labelledby="inside-h" className="grid gap-3 rounded-2xl border bg-card p-5">
            <h2 id="inside-h" className="font-bold">
              {t("home.insideTitle")}
            </h2>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                [t("dashboard.stats.structures"), structures],
                [t("home.parts3d"), meshes],
                [t("dashboard.stats.models"), modelCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="grid gap-0.5 rounded-xl bg-muted p-2">
                  <dd className="text-lg font-bold tabular-nums">{value ?? "–"}</dd>
                  <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
          </section>

          {/* Coming soon: listed honestly, not clickable */}
          <section aria-labelledby="soon-h" className="grid gap-3 rounded-2xl border border-dashed p-5">
            <h2 id="soon-h" className="flex items-center gap-2 font-bold">
              <Clock className="size-4 text-muted-foreground" aria-hidden /> {t("home.comingTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("home.comingBody")}</p>
            <ul className="grid gap-2">
              {MODULES.filter((m) => m.status === "planned").map((m) => {
                const Icon = m.icon;
                return (
                  <li key={m.id} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{t(`nav.items.${m.id}.label`)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                      {t("nav.phase", { n: m.phase ?? "" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <EducationalDisclaimer text={t("common.draftNotice")} />
    </div>
  );
}
