import { DEFAULT_LOCALE, isLocale, type Locale } from "../config";
import { en, type Messages } from "./en";
import { sw } from "./sw";

/** Message catalogues by language (the root layout sends only the active one to the client). */
export const MESSAGES: Record<Locale, Messages> = { en, sw };

export type { Messages };

/** Messages for a `[lang]` route segment (server components and metadata). */
export function messagesFor(lang: string): Messages {
  return MESSAGES[isLocale(lang) ? lang : DEFAULT_LOCALE];
}
