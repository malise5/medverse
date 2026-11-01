import type { Metadata } from "next";

import { Dashboard } from "@/features/dashboard/dashboard";
import { messagesFor } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const m = messagesFor((await params).lang);
  return { title: m.nav.items.dashboard.label };
}

export default function DashboardPage() {
  return <Dashboard />;
}
