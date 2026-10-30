import { afterEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, buildUrl, errorDetails, structurePath } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("builds URLs, skipping empty params", () => {
    expect(buildUrl("/anatomy/search", { q: "heart", system: undefined, limit: 5 })).toBe(
      "/api/v1/anatomy/search?q=heart&limit=5",
    );
    expect(structurePath("FMA:7088")).toBe("/anatomy/structures/FMA%3A7088");
  });

  it("raises structured ApiError with details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "invalid_parameters", message: "bad", details: [{ loc: ["x"], msg: "Heart rate too high" }] },
        }),
        { status: 422 },
      ),
    );
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("invalid_parameters");
    expect(errorDetails(err)).toEqual(["Heart rate too high"]);
  });

  it("returns undefined for 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });
});
