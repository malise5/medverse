import type { Metadata } from "next";
import { Suspense } from "react";

import { PhysiologyLab } from "@/features/physiology/physiology-lab";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/physiology">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.nav.items.physiology.label };
}

export default async function PhysiologyPage({ params }: PageProps<"/[lang]/physiology">) {
  const m = messagesFor((await params).lang);
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-bold">{m.nav.items.physiology.label}</h1>
        <p className="text-sm text-muted-foreground">{m.labs.physiologyIntro}</p>
      </header>
      <Suspense>
        <PhysiologyLab />
      </Suspense>
    </div>
  );
}
