import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { THEME_SCRIPT } from "@/lib/theme/script";

import { Providers } from "../providers";
import "../globals.css";

const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Both languages are prerendered; any other first segment is a 404.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const DESCRIPTION = {
  en: "Interactive 3D human anatomy, physiology and pathology for medical education. Educational use only.",
  sw: "Anatomia, fiziolojia na patholojia shirikishi za 3D kwa elimu ya tiba. Kwa matumizi ya kielimu pekee.",
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: { default: "MEDVERSE", template: "%s · MEDVERSE" },
    description: isLocale(lang) ? DESCRIPTION[lang] : DESCRIPTION.en,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    // Light clinical theme by default; the saved choice is applied before first paint.
    <html lang={lang} className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {/* Only the active language's messages are sent to the browser. */}
        <Providers locale={lang} messages={MESSAGES[lang]}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
