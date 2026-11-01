"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { useTheme } from "@/lib/theme/theme";

/** Switches between the light clinical theme and the dark theme. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const { t } = useT();
  const next = theme === "dark" ? "light" : "dark";
  const label = t(next === "dark" ? "theme.toDark" : "theme.toLight");
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => setTheme(next)}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
