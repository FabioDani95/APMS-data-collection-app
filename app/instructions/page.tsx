import { redirect } from "next/navigation";

import { InstructionsStartButton } from "@/components/InstructionsStartButton";
import { ToolBadge } from "@/components/ToolBadge";
import { getStudyConfig, getTaskDefinition, resolveText } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";

export default async function InstructionsPage() {
  const cookie = readSessionCookie();
  if (!cookie) {
    redirect("/admin");
  }

  const session = await prisma.session.findUnique({
    where: { id: cookie.sessionId },
    select: { id: true, group_id: true },
  });

  if (!session) {
    redirect("/admin");
  }

  const locale = cookie.locale;
  const t = getCopy(locale);
  const config = getStudyConfig();
  const firstTask = getTaskDefinition(session.group_id, 1);

  if (!firstTask) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.currentStep}</p>
        <h2 className="text-3xl font-semibold text-ink">{t.instructions.title}</h2>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
        <h3 className="text-lg font-semibold text-slate-950">{t.instructions.overview}</h3>
        <ul className="mt-4 space-y-2 pl-5 text-sm leading-7 text-slate-700">
          {config.instructions.overview[locale].map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
        <h3 className="text-lg font-semibold text-slate-950">{t.instructions.rules}</h3>
        <ul className="mt-4 space-y-2 pl-5 text-sm leading-7 text-slate-700">
          {config.instructions.rules[locale].map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {(["KG", "LLM", "DOC"] as const).map((tool) => (
          <section key={tool} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
            <ToolBadge color={config.tools[tool].color} label={resolveText(config.tools[tool].label, locale)} />
            <div className="mt-5 space-y-5 text-sm leading-7 text-slate-700">
              <div>
                <h3 className="font-semibold text-slate-950">{t.instructions.usageSteps}</h3>
                <ul className="mt-2 space-y-2 pl-5">
                  {config.instructions.tools[tool].usage_steps[locale].map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">{t.instructions.youMay}</h3>
                <ul className="mt-2 space-y-2 pl-5">
                  {config.instructions.tools[tool].you_may[locale].map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">{t.instructions.youMayNot}</h3>
                <ul className="mt-2 space-y-2 pl-5">
                  {config.instructions.tools[tool].you_may_not[locale].map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>

      <InstructionsStartButton
        sessionId={session.id}
        taskOrder={1}
        scenarioId={firstTask.scenario}
        toolAssigned={firstTask.tool}
        label={t.instructions.start}
      />
    </main>
  );
}
