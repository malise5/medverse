import type { Metadata } from "next";

import { LearningHub } from "@/features/learning/learning-hub";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/learn">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.nav.items.library.label };
}

export default function LearnPage() {
  return <LearningHub />;
}
