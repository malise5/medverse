import type { ModelDefinition, OutputSpec } from "@/lib/api/types";

export interface ChartGroup {
  key: string;
  title: string;
  unit: string;
  series: OutputSpec[];
}

/**
 * One chart per unit: series that share a unit share an axis, series with different
 * units never do (no dual axes). Order follows the model's declared series order.
 */
export function chartGroups(model: Pick<ModelDefinition, "series">): ChartGroup[] {
  const groups = new Map<string, OutputSpec[]>();
  for (const s of model.series) {
    const list = groups.get(s.unit);
    if (list) list.push(s);
    else groups.set(s.unit, [s]);
  }
  return [...groups].map(([unit, series]) => ({
    key: unit || "unitless",
    title: series.length === 1 ? series[0].label : series.map((s) => s.label).join(", "),
    unit: unit || "0–1",
    series,
  }));
}
