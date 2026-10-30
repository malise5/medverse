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

export interface ModuleDef {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** "live" modules are implemented; others are listed honestly with their planned phase. */
  status: "live" | "planned";
  phase?: string;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, status: "live",
    description: "Overview of your workspace and platform status." },
  { id: "anatomy", label: "Anatomy Explorer", href: "/anatomy", icon: Brain, status: "live",
    description: "Interactive 3D anatomy with selectable structures, layers and dissection." },
  { id: "physiology", label: "Physiology Lab", href: "/physiology", icon: Activity, status: "live",
    description: "Documented, parameterised physiological models computed by the simulation engine." },
  { id: "pathology", label: "Pathology Lab", href: "/pathology", icon: HeartPulse, status: "live",
    description: "Compare healthy and pathological states using educational models." },
  { id: "histology", label: "Histology Lab", href: "#", icon: Microscope, status: "planned", phase: "Phase 6",
    description: "Virtual microscopy from organ to subcellular level." },
  { id: "imaging", label: "Medical Imaging", href: "#", icon: ScanLine, status: "planned", phase: "Phase 6",
    description: "DICOM series, windowing and 3D correlation." },
  { id: "cases", label: "Clinical Cases", href: "#", icon: Stethoscope, status: "planned", phase: "Phase 7",
    description: "Simulated virtual patients with decision feedback." },
  { id: "assistant", label: "AI Assistant", href: "#", icon: Bot, status: "planned", phase: "Phase 7",
    description: "Context-aware, cited educational assistant." },
  { id: "library", label: "Learning Library", href: "#", icon: BookOpen, status: "planned", phase: "Phase 8",
    description: "Courses, pathways, flashcards and spaced repetition." },
  { id: "assessments", label: "Assessments", href: "#", icon: ClipboardCheck, status: "planned", phase: "Phase 8",
    description: "Quizzes, mock examinations and 3D identification tests." },
];
