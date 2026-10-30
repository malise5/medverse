import type { Metadata } from "next";
import { Suspense } from "react";

import { PhysiologyLab } from "@/features/physiology/physiology-lab";

export const metadata: Metadata = { title: "Physiology Lab" };

export default function PhysiologyPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Physiology Lab</h1>
        <p className="text-sm text-muted-foreground">
          Models are computed by the MEDVERSE simulation engine; the browser only visualises results.
          The catalogue currently contains one model. More are planned for Phase 4.
        </p>
      </header>
      <Suspense>
        <PhysiologyLab />
      </Suspense>
    </div>
  );
}
