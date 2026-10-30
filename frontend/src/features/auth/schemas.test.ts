import { describe, expect, it } from "vitest";

import { registerSchema, safeNext } from "./schemas";

describe("safeNext", () => {
  it("allows same-origin paths only", () => {
    expect(safeNext("/anatomy?structure=FMA:7088")).toBe("/anatomy?structure=FMA:7088");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});

describe("registerSchema", () => {
  const ok = { full_name: "Ada L", email: "ada@example.org", password: "Correct-Horse-42", educational_level: "clinical" };
  it("accepts a strong password", () => expect(registerSchema.safeParse(ok).success).toBe(true));
  it("mirrors the backend password policy", () => {
    expect(registerSchema.safeParse({ ...ok, password: "short1A!" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: "alllowercaseletters" }).success).toBe(false);
  });
});
