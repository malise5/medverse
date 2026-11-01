"use client";

import NextLink from "next/link";
import { createContext, useCallback, useContext, useMemo, type ComponentProps, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale, LOCALE_COOKIE, localizePath, switchLocalePath } from "./config";
import { en, type Messages } from "./messages/en";

/** Dotted paths to every message ("nav.items.dashboard.label"). */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;
/** Base keys of counted messages (those with _one / _other variants). */
export type CountedKey = MessageKey extends infer K ? (K extends `${infer B}_other` ? B : never) : never;

type Vars = Record<string, string | number>;

interface I18n {
  locale: Locale;
  messages: Messages;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, messages, children }: I18n & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Used only where a component renders without the root layout's provider: Next.js
// validates instant navigation by rendering a segment on its own (development only).
const FALLBACK: I18n = { locale: DEFAULT_LOCALE, messages: en };

function useI18n(): I18n {
  return useContext(I18nContext) ?? FALLBACK;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

function lookup(messages: Messages, key: string): string {
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : key;
}

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/**
 * Translation functions for the current language:
 * - `t(key, vars)` looks up a message and fills {placeholders};
 * - `tp(base, count, vars)` picks the `_one` / `_other` form by the language's plural rules.
 */
export function useT() {
  const { locale, messages } = useI18n();
  const rules = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const t = useCallback((key: MessageKey, vars?: Vars) => format(lookup(messages, key), vars), [messages]);
  const tp = useCallback(
    (base: CountedKey, count: number, vars?: Vars) => {
      const form = rules.select(count) === "one" ? "one" : "other";
      return format(lookup(messages, `${base}_${form}`), { count, ...vars });
    },
    [messages, rules],
  );
  return { t, tp, locale };
}

/** Prefixes an internal path with the current language. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return useCallback((path: string) => localizePath(path, locale), [locale]);
}

/** next/link that keeps the current language on internal links ("/learn" -> "/sw/learn"). */
export function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const lp = useLocalePath();
  const target = typeof href === "string" ? lp(href) : href;
  return <NextLink href={target} {...rest} />;
}

/**
 * Switch language: remember the choice (cookie read by the proxy for un-prefixed URLs)
 * and reload the same page in the other language, so no cached text of the previous
 * language survives.
 */
export function switchLanguage(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  const { pathname, search, hash } = window.location;
  window.location.assign(switchLocalePath(pathname + search, locale) + hash);
}
