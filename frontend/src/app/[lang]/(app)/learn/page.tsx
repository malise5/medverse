import type { Metadata } from "next";

import { LearningHub } from "@/features/learning/learning-hub";

export const metadata: Metadata = { title: "Body systems" };

export default function LearnPage() {
  return <LearningHub />;
}
