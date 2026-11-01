"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError, setApiLocale } from "@/lib/api/client";
import { I18nProvider } from "@/lib/i18n/client";
import { DEFAULT_LOCALE, localeOf, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

function redirectToLogin() {
  const { pathname, search } = window.location;
  const locale = localeOf(pathname) ?? DEFAULT_LOCALE;
  if (!pathname.startsWith(`/${locale}/login`)) {
    window.location.assign(
      new URL(`/${locale}/login?next=${encodeURIComponent(pathname + search)}`, window.location.origin),
    );
  }
}

export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  // API requests ask for content in the interface language (English where untranslated).
  setApiLocale(locale);
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) redirectToLogin();
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <I18nProvider locale={locale} messages={messages}>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
