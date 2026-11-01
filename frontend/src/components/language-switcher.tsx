"use client";

import { Languages } from "lucide-react";

import { switchLanguage, useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** English / Kiswahili switch; each language is named in itself. */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={t("language.label")} className={cn("flex items-center gap-1.5", className)}>
      <Languages className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className={cn("inline-flex rounded-full border bg-muted/60 p-0.5", !compact && "flex-1")}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={locale === l}
            aria-label={LOCALE_NAMES[l]}
            onClick={() => locale !== l && switchLanguage(l)}
            className={cn(
              "flex-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
              locale === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
