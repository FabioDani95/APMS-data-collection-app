import { redirect } from "next/navigation";

import { PostSessionForm } from "@/components/PostSessionForm";
import { getStudyConfig, resolveText } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";

export default async function PostSessionPage() {
  const cookie = readSessionCookie();
  if (!cookie) {
    redirect("/admin");
  }

  const session = await prisma.session.findUnique({
    where: { id: cookie.sessionId },
    select: { id: true },
  });

  if (!session) {
    redirect("/admin");
  }

  const locale = cookie.locale;
  const t = getCopy(locale);
  const config = getStudyConfig();

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.currentStep}</p>
        <h2 className="text-3xl font-semibold text-ink">{t.postSession.title}</h2>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">{t.postSession.intro}</p>
      </section>

      <PostSessionForm
        sessionId={session.id}
        labels={{
          confidence: t.postSession.confidence,
          requiredConfidence: t.postSession.requiredConfidence,
          rank1: t.postSession.rank1,
          rank2: t.postSession.rank2,
          rank3: t.postSession.rank3,
          justification: t.postSession.justification,
          comment: t.postSession.comment,
          submit: t.postSession.submit,
          selectPlaceholder: t.common.selectPlaceholder,
          distinctError: t.postSession.distinctError,
          saveError: t.common.saveError,
          lowConfidence: `1 = ${config.likert_labels.confidence[locale].low}`,
          highConfidence: `7 = ${config.likert_labels.confidence[locale].high}`,
        }}
        toolOptions={(Object.keys(config.tools) as Array<keyof typeof config.tools>).map((tool) => ({
          value: tool,
          label: resolveText(config.tools[tool].label, locale),
        }))}
      />
    </main>
  );
}
