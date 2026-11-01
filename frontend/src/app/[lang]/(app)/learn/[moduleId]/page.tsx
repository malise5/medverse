import { Suspense } from "react";

import { ModuleRoute } from "@/features/learning/module-view";

export default function ModulePage() {
  return (
    <Suspense>
      <ModuleRoute />
    </Suspense>
  );
}
