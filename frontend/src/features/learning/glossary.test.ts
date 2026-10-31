import { describe, expect, it } from "vitest";

import { filterGlossary, fold } from "./glossary";

const entry = (term: string, module_id: string, extra: Partial<{ latin: string; definition: string }> = {}) => ({
  term,
  latin: extra.latin ?? null,
  origin: null,
  definition: extra.definition ?? "",
  module_id,
  module_title: module_id,
});

describe("glossary search", () => {
  it("ignores case and accents", () => {
    expect(fold("Œsophagus Ü")).toBe("œsophagus u");
  });

  it("matches term, Latin name or definition, filtered by module", () => {
    const all = [
      entry("Ventricle", "cardiovascular", { latin: "Ventriculus" }),
      entry("Nephron", "urinary", { definition: "Functional unit of the kidney" }),
    ];
    expect(filterGlossary(all, "ventriculus", "").map((e) => e.term)).toEqual(["Ventricle"]);
    expect(filterGlossary(all, "KIDNEY", "").map((e) => e.term)).toEqual(["Nephron"]);
    expect(filterGlossary(all, "", "urinary")).toHaveLength(1);
  });
});
