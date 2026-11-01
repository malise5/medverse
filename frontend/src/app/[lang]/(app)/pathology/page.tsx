import type { Metadata } from "next";
import { Suspense } from "react";

import { PathologyLab } from "@/features/pathology/pathology-lab";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/pathology">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.nav.items.pathology.label };
}

export default async function PathologyPage({ params }: PageProps<"/[lang]/pathology">) {
  const m = messagesFor((await params).lang);
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 p-4 md:p-8">
      <header>
        <h1 className="text-xl font-semibold">{m.nav.items.pathology.label}</h1>
        <p className="text-sm text-muted-foreground">{m.labs.pathologyIntro}</p>
      </header>
      <Suspense>
        <PathologyLab />
      </Suspense>
    </div>
  );
}
