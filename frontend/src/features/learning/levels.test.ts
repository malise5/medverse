import { describe, expect, it } from "vitest";

import { levelLabel, questionsForLevel, toLearningLevel } from "./levels";

describe("levels", () => {
  it("maps deep workspace levels onto the clinical module text", () => {
    expect(toLearningLevel("basic")).toBe("basic");
    expect(toLearningLevel("specialist")).toBe("clinical");
    expect(levelLabel("undergraduate")).toBe("Intermediate");
  });

  it("offers questions at or below the chosen level", () => {
    const qs = [
      { id: "a", level: "basic" as const },
      { id: "b", level: "undergraduate" as const },
      { id: "c", level: "clinical" as const },
    ];
    expect(questionsForLevel(qs, "basic").map((q) => q.id)).toEqual(["a"]);
    expect(questionsForLevel(qs, "clinical").map((q) => q.id)).toEqual(["a", "b", "c"]);
  });
});
