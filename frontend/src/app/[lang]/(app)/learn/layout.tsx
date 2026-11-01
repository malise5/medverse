import type { Metadata } from "next";

import { messagesFor } from "@/lib/i18n/messages";

/**
 * Title for module pages (/learn/[moduleId]). It lives here because this layout's params
 * hold only the prerendered `lang`; reading params in the module page's own metadata would
 * touch the dynamic module id. The hub and glossary pages set their own titles.
 */
export async function generateMetadata({ params }: LayoutProps<"/[lang]/learn">): Promise<Metadata> {
  // Keeps the site template for the pages below (a plain string title would reset it).
  return { title: { default: messagesFor((await params).lang).module.pageTitle, template: "%s · MEDVERSE" } };
}

export default function LearnLayout({ children }: LayoutProps<"/[lang]/learn">) {
  return children;
}
