import type { Metadata } from "next";

import { Glossary } from "@/features/learning/glossary";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/learn/glossary">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.glossary.title };
}

export default function GlossaryPage() {
  return <Glossary />;
}
