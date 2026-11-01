import { EvidenceBadge, ReferenceList } from "@/features/governance/badges";
import type { ModelDefinition, OutputSpec, Reference, RunResult } from "@/lib/api/types";
import { useLocale, useT } from "@/lib/i18n/client";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="grid gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="grid list-disc gap-1 pl-4 text-sm leading-relaxed">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export function ModelDocs({ model, references }: { model: ModelDefinition; references: Reference[] }) {
  const { t } = useT();
  const locale = useLocale();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceBadge evidence={model.evidence_class} />
        <span className="font-mono text-xs text-muted-foreground">
          {model.id} v{model.version}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{model.purpose}</p>
      {locale !== "en" && <p className="text-xs text-muted-foreground">{t("labs.technicalNote")}</p>}
      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.equations")}</h4>
        <div className="grid gap-1 rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {model.equations.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      </section>
      <List title={t("labs.numerical")} items={[model.solver, t("labs.initialConditions", { value: model.initial_conditions })]} />
      <List title={t("labs.assumptions")} items={model.assumptions} />
      <List title={t("labs.limitations")} items={model.limitations} />
      <List title={t("labs.validation")} items={model.validation} />
      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.paramsUnits")}</h4>
        <table className="w-full text-xs">
          <tbody>
            {model.parameters.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-1 pr-2">{p.label}</td>
                <td className="py-1 pr-2 text-muted-foreground">{p.unit}</td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {t("labs.range", { min: p.min, max: p.max, value: p.default })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("labs.references")}</h4>
        <ReferenceList references={references} />
      </section>
    </div>
  );
}

export function MetricsGrid({
  specs,
  primary,
  comparison,
  primaryLabel,
  comparisonLabel,
}: {
  specs: OutputSpec[];
  primary: RunResult;
  comparison?: RunResult;
  primaryLabel?: string;
  comparisonLabel?: string;
}) {
  const { t } = useT();
  const shown = specs.filter((s) => s.id !== "steady_state_residual" && s.id !== "ejected_volume");
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="py-1 text-left font-normal">{t("labs.output")}</th>
          <th className="py-1 text-right font-normal">{primaryLabel ?? t("labs.value")}</th>
          {comparison && <th className="py-1 text-right font-normal">{comparisonLabel}</th>}
          {comparison && <th className="py-1 text-right font-normal">{t("labs.change")}</th>}
        </tr>
      </thead>
      <tbody>
        {shown.map((s) => {
          const a = primary.metrics[s.id];
          const b = comparison?.metrics[s.id];
          const delta = b !== undefined ? b - a : undefined;
          return (
            <tr key={s.id} className="border-t border-border/50" title={s.description}>
              <td className="py-1.5">
                {s.label} <span className="text-xs text-muted-foreground">({s.unit})</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{a?.toFixed(1)}</td>
              {comparison && <td className="py-1.5 text-right tabular-nums">{b?.toFixed(1)}</td>}
              {comparison && (
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                  {delta === undefined ? "" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
