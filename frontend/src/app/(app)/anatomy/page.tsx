import type { Metadata } from "next";
import { Suspense } from "react";

import { AnatomyWorkspace } from "@/features/anatomy/workspace";

export const metadata: Metadata = { title: "Anatomy Explorer" };

export default function AnatomyPage() {
  return (
    <Suspense>
      <AnatomyWorkspace />
    </Suspense>
  );
}
