import type { Metadata } from "next";

import { Glossary } from "@/features/learning/glossary";

export const metadata: Metadata = { title: "Glossary" };

export default function GlossaryPage() {
  return <Glossary />;
}
