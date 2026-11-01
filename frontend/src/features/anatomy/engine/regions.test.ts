import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { REGION_SPAN_M, regionFloor, regionView } from "./regions";

const body = new Box3(new Vector3(-0.3, 0, -0.15), new Vector3(0.3, 1.7, 0.15));
const fallback = { target: new Vector3(0, 0.88, 0), dist: 3 };

describe("study regions", () => {
  it("clips each region a fixed span below the vertex", () => {
    expect(regionFloor("body", body)).toBeNull();
    expect(regionFloor("head", body)).toBeCloseTo(1.7 - REGION_SPAN_M.head);
    expect(regionFloor("neck", body)).toBeCloseTo(1.7 - REGION_SPAN_M.neck);
    expect(REGION_SPAN_M.neck).toBeGreaterThan(REGION_SPAN_M.head); // neck reaches the clavicles
    expect(regionFloor("neck", new Box3())).toBeNull();
  });

  it("frames the neck below the head and the body with the fallback view", () => {
    const head = regionView("head", body, fallback);
    const neck = regionView("neck", body, fallback);
    expect(neck.target.y).toBeLessThan(head.target.y);
    expect(neck.target.y).toBeGreaterThan(regionFloor("neck", body)!);
    expect(regionView("body", body, fallback)).toEqual({ target: fallback.target, dist: 3 });
  });
});
