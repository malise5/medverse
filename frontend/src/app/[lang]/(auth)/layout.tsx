import { Activity, Box, Languages } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

/** Heartbeat trace across the mission panel (drawn once on load). */
function PulseLine() {
  return (
    <svg viewBox="0 0 600 120" aria-hidden className="w-full opacity-80" preserveAspectRatio="none">
      <path
        d="M0 70h150l18-30 24 70 26-110 22 80 14-10h346"
        fill="none"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mv-trace"
        style={{ "--trace-length": 900 } as React.CSSProperties}
      />
    </svg>
  );
}

export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const m = MESSAGES[isLocale(lang) ? lang : DEFAULT_LOCALE];
  const features = [
    { icon: Box, text: m.auth.hero.feature3d },
    { icon: Activity, text: m.auth.hero.featureSim },
    { icon: Languages, text: m.auth.hero.featureLang },
  ];
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[image:var(--hero)] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-10 ring-2 ring-white/30 rounded-[10px]" />
          <span className="grid leading-none">
            <span className="text-lg font-bold tracking-tight">MEDVERSE</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Africa</span>
          </span>
        </div>
        <div className="relative mt-auto grid max-w-xl gap-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{m.auth.hero.title}</h1>
          <p className="text-lg leading-relaxed text-white/85">{m.auth.hero.body}</p>
          <ul className="grid gap-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-10">
          <PulseLine />
          <p className="mt-4 text-xs text-white/70">{m.auth.footer}</p>
        </div>
      </section>

      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-end gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted-foreground lg:hidden">{m.auth.footer}</p>
      </section>
    </main>
  );
}
