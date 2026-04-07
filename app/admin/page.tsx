import { AdminForm } from "@/components/AdminForm";
import { buildGroupProgress, getRecommendedGroup, TARGET_COMPLETED_PER_GROUP } from "@/lib/group-assignment";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getLocaleFromCookie } from "@/lib/session";

export default async function AdminPage() {
  const locale = getLocaleFromCookie();
  const t = getCopy(locale);
  const completedSessions = await prisma.postSession.findMany({
    select: {
      session: {
        select: {
          group_id: true,
        },
      },
    },
  });
  const groupProgress = buildGroupProgress(completedSessions.map((entry) => entry.session.group_id));
  const recommendedGroupId = getRecommendedGroup(groupProgress);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.currentStep}</p>
        <h2 className="text-3xl font-semibold text-ink">{t.admin.title}</h2>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">{t.admin.intro}</p>
        <div className="pt-2">
          <a
            href="/admin/results"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {t.admin.openResults}
          </a>
        </div>
      </section>

      <AdminForm
        locale={locale}
        initialGroupId={recommendedGroupId}
        groupOptions={groupProgress.map((entry) => ({
          value: entry.groupId,
          label: `${entry.groupId} (${entry.completedCount}/${TARGET_COMPLETED_PER_GROUP})`,
        }))}
        labels={{
          group: t.admin.group,
          groupHelp: t.admin.groupHelp,
          interfaceLanguage: t.admin.interfaceLanguage,
          submit: t.admin.submit,
          genericError: t.admin.genericError,
        }}
      />
    </main>
  );
}
