import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvidenceClass, Reference, VerificationStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS: Record<VerificationStatus, { label: string; tip: string; className: string }> = {
  source_imported: {
    label: "Source data",
    tip: "Imported unchanged from a cited external dataset. Not independently reviewed by MEDVERSE.",
    className: "border-sky-500/40 text-sky-300",
  },
  draft: {
    label: "Draft · pending expert review",
    tip: "Written from cited references but not yet reviewed by a credentialed expert.",
    className: "border-warning/50 text-warning",
  },
  in_review: {
    label: "In review",
    tip: "Under review by a credentialed content expert.",
    className: "border-warning/50 text-warning",
  },
  expert_reviewed: {
    label: "Expert reviewed",
    tip: "Reviewed and approved by a credentialed content expert.",
    className: "border-emerald-500/50 text-emerald-300",
  },
  deprecated: {
    label: "Deprecated",
    tip: "Superseded content retained for traceability.",
    className: "border-destructive/50 text-destructive",
  },
};

const EVIDENCE: Record<EvidenceClass, { label: string; tip: string }> = {
  A: { label: "A · Anatomically validated", tip: "Validated anatomical content." },
  B: { label: "B · Evidence-supported", tip: "Evidence-supported educational explanation." },
  C: {
    label: "C · Simplified educational model",
    tip: "Simplified educational simulation. Not a clinical prediction tool.",
  },
  D: { label: "D · Experimental", tip: "Experimental or unvalidated model." },
};

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("cursor-help text-[10px]", s.className, className)}>
          {s.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{s.tip}</TooltipContent>
    </Tooltip>
  );
}

export function EvidenceBadge({ evidence }: { evidence: EvidenceClass }) {
  const e = EVIDENCE[evidence];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help text-[10px]">
          {e.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{e.tip}</TooltipContent>
    </Tooltip>
  );
}

export function ReferenceList({ references }: { references: Reference[] }) {
  if (!references.length) return <p className="text-xs text-muted-foreground">No references.</p>;
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
        </li>
      ))}
    </ol>
  );
}

export function EducationalDisclaimer({ className, text }: { className?: string; text?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-warning",
        className,
      )}
    >
      {text ??
        "Educational content for learning and professional reference. Not validated for diagnosis, treatment or prediction of individual patient outcomes."}
    </p>
  );
}
