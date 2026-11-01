"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvidenceClass, Reference, VerificationStatus } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<VerificationStatus, string> = {
  source_imported: "border-sky-600/40 text-sky-700 dark:border-sky-500/40 dark:text-sky-300",
  draft: "border-warning/50 text-warning",
  in_review: "border-warning/50 text-warning",
  expert_reviewed: "border-emerald-600/50 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300",
  deprecated: "border-destructive/50 text-destructive",
};

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const { t } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("cursor-help text-[10px]", STATUS_CLASS[status], className)}>
          {t(`governance.status.${status}.label`)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{t(`governance.status.${status}.tip`)}</TooltipContent>
    </Tooltip>
  );
}

export function EvidenceBadge({ evidence }: { evidence: EvidenceClass }) {
  const { t } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help text-[10px]">
          {t(`governance.evidence.${evidence}.label`)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{t(`governance.evidence.${evidence}.tip`)}</TooltipContent>
    </Tooltip>
  );
}

export function ReferenceList({ references }: { references: Reference[] }) {
  const { t } = useT();
  if (!references.length) return <p className="text-xs text-muted-foreground">{t("governance.noReferences")}</p>;
  return (
    <ol className="grid gap-2 text-xs">
      {references.map((r) => (
        <li key={r.id} id={`ref-${r.id}`} className="leading-relaxed text-muted-foreground">
          <span className="text-foreground/90">{r.citation}</span>
          {r.doi && (
            <>
              {" "}
              <a
                className="text-primary hover:underline"
                href={`https://doi.org/${r.doi}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                doi:{r.doi}
              </a>
            </>
          )}
          {r.pmid && <> · PMID {r.pmid}</>}
          {!r.doi && r.url && (
            <>
              {" "}
              <a className="text-primary hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">
                {new URL(r.url).hostname}
              </a>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

export function EducationalDisclaimer({ className, text }: { className?: string; text?: string }) {
  const { t } = useT();
  return (
    <p
      role="note"
      className={cn(
        "rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning",
        className,
      )}
    >
      {text ?? t("governance.disclaimer")}
    </p>
  );
}
