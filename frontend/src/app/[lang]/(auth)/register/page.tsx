import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/auth-form";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[lang]/register">): Promise<Metadata> {
  const { lang } = await params;
  return { title: MESSAGES[isLocale(lang) ? lang : DEFAULT_LOCALE].auth.registerPageTitle };
}

export default function Page() {
  return <AuthForm mode="register" />;
}
