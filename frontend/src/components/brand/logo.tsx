import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
        <defs>
          <linearGradient id="mv-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="oklch(0.82 0.12 195)" />
            <stop offset="1" stopColor="oklch(0.6 0.14 230)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#mv-g)" opacity="0.18" />
        <path
          d="M16 6c-2.4 0-4 1.8-4 4 0 1.5.8 2.7 2 3.4V26h4V13.4c1.2-.7 2-1.9 2-3.4 0-2.2-1.6-4-4-4Z M8 15h5 M19 15h5 M10 21h3 M19 21h3"
          fill="none"
          stroke="url(#mv-g)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && <span className="text-[15px]">MEDVERSE</span>}
    </span>
  );
}
