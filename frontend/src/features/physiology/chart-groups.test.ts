import { describe, expect, it } from "vitest";

import { chartGroups } from "./chart-groups";

const spec = (id: string, unit: string) => ({ id, label: id, unit, description: "" });

describe("chartGroups", () => {
  it("groups series by unit in declaration order and never mixes units", () => {
    const groups = chartGroups({
      series: [spec("p_lv", "mmHg"), spec("v", "mL"), spec("p_ao", "mmHg"), spec("m", "")],
    });
    expect(groups.map((g) => g.series.map((s) => s.id))).toEqual([["p_lv", "p_ao"], ["v"], ["m"]]);
    expect(groups[2].unit).toBe("0–1");
  });
});
