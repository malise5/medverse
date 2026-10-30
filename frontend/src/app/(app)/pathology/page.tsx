import type { Metadata } from "next";
import { Suspense } from "react";

import { PathologyLab } from "@/features/pathology/pathology-lab";

export const metadata: Metadata = { title: "Pathology Lab" };

export default function PathologyPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Pathology Lab</h1>
        <p className="text-sm text-muted-foreground">
          Start from a reference state, introduce a mechanism, and compare. All scenarios are
          simplified educational models.
        </p>
      </header>
      <Suspense>
        <PathologyLab />
      </Suspense>
    </div>
  );
}
