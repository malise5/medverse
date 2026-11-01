/**
 * Languages of the interface. English is the source language; every other language must
 * provide every message (enforced by the `Messages` type in messages/en.ts).
 *
 * The language is the first URL segment (/en/…, /sw/…), so both languages are prerendered
 * and cached separately (important for offline use) and links can be shared in either
 * language. The proxy (src/proxy.ts) adds the segment to un-prefixed URLs from the saved
 * preference (cookie) or the browser's languages.
 */
export const LOCALES = ["en", "sw"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Preference cookie set by the language switcher (read by the proxy). */
export const LOCALE_COOKIE = "mv_locale";

/** Each language named in itself, as shown in the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", sw: "Kiswahili" };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Locale of a pathname ("/sw/learn" -> "sw"), if it has one. */
export function localeOf(pathname: string): Locale | null {
  const seg = pathname.split("/")[1];
  return isLocale(seg) ? seg : null;
}

/** Prefix an internal path with the locale; leaves external, hash and prefixed paths alone. */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (localeOf(path)) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The same page in another language ("/sw/learn/x?y" -> "/en/learn/x?y"). */
export function switchLocalePath(pathWithQuery: string, locale: Locale): string {
  const current = localeOf(pathWithQuery);
  const rest = current ? pathWithQuery.slice(current.length + 1) || "/" : pathWithQuery;
  return localizePath(rest, locale);
}

/**
 * Best locale for an Accept-Language header: the highest-weighted supported language
 * (sw, sw-KE, sw-TZ … count as Swahili), otherwise the default.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.base)
    .sort((a, b) => b.q - a.q);
  return ranked.find((x) => isLocale(x.base))?.base as Locale | undefined ?? DEFAULT_LOCALE;
}
