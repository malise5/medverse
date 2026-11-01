import { describe, expect, it } from "vitest";

import { format } from "./client";
import { localeOf, localizePath, negotiateLocale, switchLocalePath } from "./config";
import { en } from "./messages/en";
import { sw } from "./messages/sw";

function leaves(obj: object, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );
}

describe("locale routing", () => {
  it("prefixes internal paths and leaves others alone", () => {
    expect(localizePath("/learn/cardiovascular?lab=3d", "sw")).toBe("/sw/learn/cardiovascular?lab=3d");
    expect(localizePath("/", "en")).toBe("/en");
    expect(localizePath("/sw/learn", "en")).toBe("/sw/learn"); // already localised
    expect(localizePath("#quiz", "sw")).toBe("#quiz");
    expect(localizePath("https://example.org", "sw")).toBe("https://example.org");
    expect(localizePath("//cdn.example.org/x", "sw")).toBe("//cdn.example.org/x");
  });

  it("switches the language of the current page", () => {
    expect(switchLocalePath("/sw/learn/x?lab=sim", "en")).toBe("/en/learn/x?lab=sim");
    expect(switchLocalePath("/en", "sw")).toBe("/sw");
    expect(localeOf("/sw/anatomy")).toBe("sw");
    expect(localeOf("/swahili")).toBeNull();
  });

  it("picks Swahili from the browser's languages, English otherwise", () => {
    expect(negotiateLocale("sw-KE,sw;q=0.9,en;q=0.8")).toBe("sw");
    expect(negotiateLocale("en-GB,en;q=0.9,sw;q=0.5")).toBe("en");
    expect(negotiateLocale("fr-FR,fr;q=0.9")).toBe("en");
    expect(negotiateLocale("fr;q=0.9,sw-TZ;q=0.8")).toBe("sw");
    expect(negotiateLocale(null)).toBe("en");
  });
});

describe("messages", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("Karibu, {name}", { name: "Amina" })).toBe("Karibu, Amina");
    expect(format("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  it("Swahili defines every English message with the same placeholders", () => {
    const e = new Map(leaves(en));
    const s = new Map(leaves(sw));
    expect([...s.keys()].sort()).toEqual([...e.keys()].sort());
    for (const [key, text] of e) {
      const vars = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(s.get(key)!), key).toEqual(vars(text));
    }
  });

  it("Swahili is translated, not copied (except names and codes)", () => {
    // Numeric framing and dataset names (proper nouns) stay the same in every language.
    const allowedSame = new Set(["learn.correctOf", "explorer.structure.sources.bodyparts3d-4.0"]);
    const copied = leaves(en)
      .filter(([k, v]) => !allowedSame.has(k) && v.length > 3 && /[a-z]{4}/.test(v))
      .filter(([k, v]) => leaves(sw).find(([sk]) => sk === k)?.[1] === v)
      .map(([k]) => k);
    expect(copied).toEqual([]);
  });
});
