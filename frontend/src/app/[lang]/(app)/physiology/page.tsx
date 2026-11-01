import type { Metadata } from "next";
import { Suspense } from "react";

import { PhysiologyLab } from "@/features/physiology/physiology-lab";

export const metadata: Metadata = { title: "Physiology Lab" };

export default function PhysiologyPage() {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-bold">Physiology Lab</h1>
        <p className="text-sm text-muted-foreground">
          Models are computed by the MEDVERSE simulation engine; the browser only visualises results.
          Each model documents its equations, assumptions, validated range and sources.
        </p>
      </header>
      <Suspense>
        <PhysiologyLab />
      </Suspense>
    </div>
  );
}
