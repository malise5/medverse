"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MODULES } from "@/components/shell/modules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_COLORS } from "@/features/anatomy/engine/palette";
import { EducationalDisclaimer } from "@/features/governance/badges";
import { useAssetManifest, useConditions, useMe, useModels, useSystems } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

const QUICK_STARTS = [
  { label: "Heart", id: "FMA:7088" },
  { label: "Aorta", id: "FMA:3734" },
  { label: "Right femoral artery", id: "FMA:70249" },
  { label: "Right femur", id: "FMA:24474" },
  { label: "Brain", id: "FMA:50801" },
  { label: "Liver", id: "FMA:7197" },
];

function Stat({ label, value, hint }: { label: string; value: string | number | undefined; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === undefined ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      )}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Dashboard() {
  const me = useMe();
  const systems = useSystems();
  const manifest = useAssetManifest();
  const models = useModels();
  const conditions = useConditions();

  const structures = systems.data?.reduce((n, s) => n + s.structure_count, 0);
  const meshes = manifest.data ? Object.keys(manifest.data.meshes).length : undefined;
  const maxMeshes = Math.max(1, ...(systems.data ?? []).map((s) => s.mesh_count));

  return (
    <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">
          {me.data ? `Welcome, ${me.data.full_name.split(" ")[0]}` : "Welcome"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Select any structure, understand its anatomy and function, and explore what happens when it fails.
        </p>
      </header>

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 pt-6 md:grid-cols-5">
          <Stat label="Anatomical structures" value={structures} hint="FMA-identified" />
          <Stat label="Selectable 3D meshes" value={meshes} hint="BodyParts3D 4.0" />
          <Stat label="Body systems with geometry" value={systems.data?.filter((s) => s.mesh_count > 0).length} />
          <Stat label="Simulation models" value={models.data?.length} hint="documented, tested" />
          <Stat label="Pathology models" value={conditions.data?.length} hint="educational" />
        </CardContent>
      </Card>

      <section aria-labelledby="modules-h" className="grid gap-3">
        <h2 id="modules-h" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.filter((m) => m.id !== "dashboard").map((m) => {
            const Icon = m.icon;
            const live = m.status === "live";
            const body = (
              <Card className={cn("h-full transition-colors", live ? "hover:border-primary/50" : "opacity-60")}>
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", live ? "bg-primary/15 text-primary" : "bg-muted")}>
                    <Icon className="size-4.5" />
                  </div>
                  <div className="grid gap-1">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {m.label}
                      {!live && <Badge variant="outline" className="text-[10px]">Planned · {m.phase}</Badge>}
                    </CardTitle>
                    <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
                  </div>
                  {live && <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />}
                </CardHeader>
              </Card>
            );
            return live ? (
              <Link key={m.id} href={m.href}>{body}</Link>
            ) : (
              <div key={m.id} aria-disabled>{body}</div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick start</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {QUICK_STARTS.map((q) => (
              <Link
                key={q.id}
                href={`/anatomy?structure=${encodeURIComponent(q.id)}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              >
                {q.label}
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3D asset coverage by system (meshes)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5">
              {(systems.data ?? []).map((s) => (
                <li key={s.id} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span className="truncate">{s.name.replace(" system", "")}</span>
                  <span className="h-2 rounded-r-sm bg-muted/40">
                    <span
                      className="block h-full rounded-r-sm"
                      style={{ width: `${(s.mesh_count / maxMeshes) * 100}%`, background: SYSTEM_COLORS[s.id] }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{s.mesh_count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <EducationalDisclaimer text="MEDVERSE is for education and professional reference. It is not a diagnostic or treatment tool. Curated content is marked as draft until reviewed by a credentialed expert; simulations are simplified educational models." />
    </div>
  );
}
