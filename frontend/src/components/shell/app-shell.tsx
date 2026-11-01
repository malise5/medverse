"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, useMe } from "@/lib/api/queries";
import { Link, useLocalePath, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { GlobalSearch } from "./global-search";
import { MODULES } from "./modules";

function ActiveNavList({ onNavigate }: { onNavigate?: () => void }) {
  return <NavItems pathname={usePathname()} onNavigate={onNavigate} />;
}

/**
 * The pathname is runtime data on dynamic routes (e.g. /learn/[moduleId]); the
 * prerendered shell shows the same links without the active highlight.
 */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavItems pathname="" onNavigate={onNavigate} />}>
      <ActiveNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

function NavItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { t } = useT();
  const lp = useLocalePath();
  // Only working modules are navigation; planned ones are shown on the home page.
  const groups = (["learn", "explore"] as const).map((g) => ({
    id: g,
    items: MODULES.filter((m) => m.status === "live" && m.group === g),
  }));
  return (
    <nav aria-label={t("nav.modules")} className="grid gap-5">
      {groups.map((g) => (
        <div key={g.id} className="grid gap-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`nav.groups.${g.id}`)}
          </p>
          {g.items.map((m) => {
            const active = pathname.startsWith(lp(m.href));
            const Icon = m.icon;
            return (
              <Link
                key={m.id}
                href={m.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {t(`nav.items.${m.id}.label`)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserBox() {
  const me = useMe();
  const lp = useLocalePath();
  const logout = useLogout();
  const { t } = useT();
  if (!me.data) return <div className="h-14" />;
  const initials = me.data.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-card p-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[image:var(--hero)] text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{me.data.full_name}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">
          {me.data.roles.map((r) => r.replace("_", " ")).join(", ")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("nav.signOut")}
        title={t("nav.signOut")}
        onClick={() =>
          logout.mutate(undefined, {
            // Full reload so no cached data from this session survives sign-out.
            onSettled: () => window.location.assign(new URL(lp("/login"), window.location.origin)),
          })
        }
      >
        <LogOut />
      </Button>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="px-1 pt-1" onClick={onNavigate} aria-label="MEDVERSE">
        <Logo />
      </Link>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto grid gap-3">
        <p className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          {t("nav.versionBadge")}
        </p>
        <UserBox />
      </div>
    </div>
  );
}

/** Top bar: search everything, language and appearance. */
function TopBar({ onMenu }: { onMenu?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/70 px-3 backdrop-blur md:px-5">
      {onMenu}
      <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
        <GlobalSearch />
      </div>
      <LanguageSwitcher compact className="hidden sm:flex" />
      <ThemeToggle />
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const menu = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("nav.openNavigation")} className="lg:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0">
        <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
        <div className="px-4 pb-4 sm:hidden">
          <LanguageSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={menu} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
