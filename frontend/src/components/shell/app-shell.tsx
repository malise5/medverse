"use client";

import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, useMe } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

import { MODULES } from "./modules";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Modules" className="grid gap-0.5">
      {MODULES.map((m) => {
        const active = pathname.startsWith(m.href) && m.status === "live";
        const Icon = m.icon;
        if (m.status !== "live") {
          return (
            <span
              key={m.id}
              aria-disabled
              title={`${m.description} Planned for ${m.phase}.`}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground/60"
            >
              <Icon className="size-4" />
              <span className="flex-1">{m.label}</span>
              <span className="text-[10px] uppercase tracking-wide">{m.phase}</span>
            </span>
          );
        }
        return (
          <Link
            key={m.id}
            href={m.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox() {
  const me = useMe();
  const logout = useLogout();
  if (!me.data) return <div className="h-12" />;
  return (
    <div className="flex items-center gap-2 rounded-md border border-sidebar-border p-2">
      <div className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {me.data.full_name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{me.data.full_name}</p>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {me.data.roles.map((r) => r.replace("_", " ")).join(", ")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        onClick={() =>
          logout.mutate(undefined, {
            // Full reload so no cached data from this session survives sign-out.
            onSettled: () => window.location.assign(new URL("/login", window.location.origin)),
          })
        }
      >
        <LogOut />
      </Button>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="px-1.5 pt-1" onClick={onNavigate}>
        <Logo />
      </Link>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto grid gap-3">
        <Badge variant="outline" className="justify-center text-[10px] text-muted-foreground">
          Educational use only · v0.1 (Phase 1)
        </Badge>
        <UserBox />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b px-3 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo />
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
