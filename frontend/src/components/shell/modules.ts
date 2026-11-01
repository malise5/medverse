import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  ClipboardCheck,
  HeartPulse,
  LayoutDashboard,
  Microscope,
  ScanLine,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

/** Labels and descriptions are messages: nav.items.<id>.label / .description. */
export type ModuleId =
  | "dashboard"
  | "anatomy"
  | "physiology"
  | "pathology"
  | "library"
  | "histology"
  | "imaging"
  | "cases"
  | "assistant"
  | "assessments";

export interface ModuleDef {
  id: ModuleId;
  href: string;
  icon: LucideIcon;
  /** "live" modules are implemented; planned ones appear only in the home page's
   * "coming soon" strip, never as navigation that does nothing. */
  status: "live" | "planned";
  /** Sidebar group of live modules. */
  group?: "learn" | "explore";
  phase?: number;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", href: "/dashboard", icon: LayoutDashboard, status: "live", group: "learn" },
  { id: "library", href: "/learn", icon: BookOpen, status: "live", group: "learn" },
  { id: "anatomy", href: "/anatomy", icon: Brain, status: "live", group: "explore" },
  { id: "physiology", href: "/physiology", icon: Activity, status: "live", group: "explore" },
  { id: "pathology", href: "/pathology", icon: HeartPulse, status: "live", group: "explore" },
  { id: "histology", href: "#", icon: Microscope, status: "planned", phase: 6 },
  { id: "imaging", href: "#", icon: ScanLine, status: "planned", phase: 6 },
  { id: "cases", href: "#", icon: Stethoscope, status: "planned", phase: 7 },
  { id: "assistant", href: "#", icon: Bot, status: "planned", phase: 7 },
  { id: "assessments", href: "#", icon: ClipboardCheck, status: "planned", phase: 8 },
];
