import type { Metadata } from "next";

import "./globals.css";
import { AbortSessionButton } from "@/components/AbortSessionButton";
import { NavigationGuard } from "@/components/NavigationGuard";
import { getStudyConfig, resolveText } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { readSessionCookie } from "@/lib/session";

export const metadata: Metadata = {
  title: "P1P Troubleshooting Study",
  description: "Wizard-style local data collection app for the P1P troubleshooting study.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sessionCookie = readSessionCookie();
  const locale = sessionCookie?.locale ?? "en";
  const t = getCopy(locale);
  const config = getStudyConfig();

  return (
    <html lang={locale}>
      <body>
        <div className="mx-auto flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-4 flex flex-none items-center justify-between border-b border-slate-200/80 pb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.appLabel}</div>
              <h1 className="mt-1 text-xl font-semibold text-ink">{resolveText(config.study_title, locale)}</h1>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {t.language}: {locale.toUpperCase()}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="app-scroll-area h-full overflow-y-auto overflow-x-hidden pr-1">{children}</div>
          </div>
        </div>
        <AbortSessionButton
          visible={Boolean(sessionCookie)}
          label={t.abortSession.label}
          confirmMessage={t.abortSession.confirmMessage}
          genericError={t.abortSession.error}
        />
        <NavigationGuard message={t.guard.noBack} />
      </body>
    </html>
  );
}
