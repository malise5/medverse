import {
  Baby,
  Bone,
  Brain,
  Droplets,
  Dumbbell,
  Eye,
  FlaskConical,
  Hand,
  HeartPulse,
  type LucideIcon,
  Shapes,
  ShieldPlus,
  Utensils,
  Wind,
} from "lucide-react";

import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  skeletal: Bone,
  muscular: Dumbbell,
  cardiovascular: HeartPulse,
  nervous: Brain,
  respiratory: Wind,
  digestive: Utensils,
  urinary: Droplets,
  reproductive: Baby,
  endocrine: FlaskConical,
  lymphatic: ShieldPlus,
  integumentary: Hand,
  special_senses: Eye,
};

/** A body system's icon on a tile tinted with the system's 3D colour. */
export function SystemIcon({ system, className, size = "md" }: { system: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = ICONS[system] ?? Shapes;
  const color = SYSTEM_COLORS[system] ?? SYSTEM_COLORS.unclassified;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
      style={{ background: `color-mix(in oklch, ${color} 22%, transparent)`, color: `color-mix(in oklch, ${color} 55%, var(--foreground))` }}
    >
      <Icon />
    </span>
  );
}
