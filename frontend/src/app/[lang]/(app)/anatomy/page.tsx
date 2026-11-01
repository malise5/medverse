import type { Metadata } from "next";
import { Suspense } from "react";

import { AnatomyWorkspace } from "@/features/anatomy/workspace";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/anatomy">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.nav.items.anatomy.label };
}

export default function AnatomyPage() {
  return (
    <Suspense>
      <AnatomyWorkspace />
    </Suspense>
  );
}
