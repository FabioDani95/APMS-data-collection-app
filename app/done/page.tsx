import Link from "next/link";

import { CelebrationScene } from "@/components/CelebrationScene";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";
import type { Locale } from "@/lib/types";

interface DonePageProps {
  searchParams?: {
    sessionId?: string;
    locale?: string;
  };
}

function resolveLocale(value?: string): Locale {
  return value === "it" ? "it" : "en";
}

export default async function DonePage({ searchParams }: DonePageProps) {
  const sessionCookie = readSessionCookie();
  const fallbackLocale = resolveLocale(searchParams?.locale);
  const locale = sessionCookie?.locale ?? fallbackLocale;
  const t = getCopy(locale);
  const fallbackSessionId = Number(searchParams?.sessionId);
  const sessionId =
    sessionCookie?.sessionId ??
    (Number.isInteger(fallbackSessionId) && fallbackSessionId > 0 ? fallbackSessionId : null);
  const session = sessionId
    ? await prisma.session.findUnique({
        where: { id: sessionId },
        select: { first_name: true },
      })
    : null;
  const participantName = session?.first_name?.trim() || t.done.nameFallback;
  const title = t.done.titleNamed.replace("{name}", participantName);
  const body = t.done.bodyNamed.replace("{name}", participantName);

  return (
    <main className="-mx-4 -mb-4 -mt-2 h-full sm:-mx-6 lg:-mx-8">
      <section className="relative isolate flex h-full min-h-[calc(100dvh-8.5rem)] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.24),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.2),transparent_28%),linear-gradient(145deg,#fff7cc_0%,#fffaf1_34%,#eef8ff_68%,#fef2f2_100%)] px-6 py-10">
        <CelebrationScene />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-amber-300 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 shadow-sm">
            {t.done.eyebrow}
          </div>
          <h2 className="mt-8 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">{title}</h2>
          <p className="mt-6 text-lg leading-9 text-slate-700 sm:text-2xl">{body}</p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">{t.done.body}</p>
          <div className="mt-10 flex justify-center">
            <Link
              href="/admin"
              className="rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:translate-y-[-1px]"
            >
              {t.done.newCollection}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
