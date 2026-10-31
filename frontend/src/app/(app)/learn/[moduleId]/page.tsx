import type { Metadata } from "next";
import { Suspense } from "react";

import { ModuleRoute } from "@/features/learning/module-view";

export const metadata: Metadata = { title: "Body system module" };

export default function ModulePage() {
  return (
    <Suspense>
      <ModuleRoute />
    </Suspense>
  );
}
