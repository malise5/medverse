"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY } from "./script";

/**
 * Light (default) or dark appearance. The choice is a per-browser convenience kept in
 * localStorage; an inline script in the root layout applies it before first paint so
 * the page never flashes the other theme.
 */
export type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
  const set = (t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  };
  return [theme, set];
}
