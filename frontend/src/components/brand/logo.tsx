import { cn } from "@/lib/utils";

/** MEDVERSE mark: a heart with a heartbeat trace, on a teal tile. */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id="mv-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.11 180)" />
          <stop offset="1" stopColor="oklch(0.46 0.09 210)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mv-tile)" />
      <path
        d="M16 25.5s-8.5-5-8.5-11.2A4.6 4.6 0 0 1 16 11.6a4.6 4.6 0 0 1 8.5 2.7c0 6.2-8.5 11.2-8.5 11.2Z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M4 17.5h7l1.6-3.2 2.4 6.4 2.2-8.4 1.9 5.2H28"
        fill="none"
        stroke="oklch(0.5 0.1 195)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? "mv-trace" : undefined}
        style={animated ? ({ "--trace-length": 40 } as React.CSSProperties) : undefined}
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <LogoMark />
      {!compact && (
        <span className="grid leading-none">
          <span className="text-[15px]">MEDVERSE</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Africa</span>
        </span>
      )}
    </span>
  );
}
