import { redirect } from "next/navigation";

import { DemographicsForm } from "@/components/DemographicsForm";
import { getStudyConfig, resolveText } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";

export default async function DemographicsPage() {
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
        <h2 className="text-3xl font-semibold text-ink">{t.demographics.title}</h2>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">{t.demographics.intro}</p>
      </section>

      <DemographicsForm
        sessionId={session.id}
        locale={locale}
        toolOptions={(Object.keys(config.tools) as Array<keyof typeof config.tools>).map((tool) => ({
          value: tool,
          label: resolveText(config.tools[tool].label, locale),
        }))}
        labels={{
          firstName: t.demographics.firstName,
          age: t.demographics.age,
          gender: t.demographics.gender,
          genderOptions: t.demographics.genderOptions,
          studyProfile: t.demographics.studyProfile,
          studyProfileHelp: t.demographics.studyProfileHelp,
          studyProfilePlaceholder: t.demographics.studyProfilePlaceholder,
          experience: t.demographics.experience,
          manufacturing: t.demographics.manufacturing,
          submit: t.demographics.submit,
          experienceOptions: t.demographics.experienceOptions,
          lowManufacturing: `1 = ${config.likert_labels.manufacturing[locale].low}`,
          highManufacturing: `7 = ${config.likert_labels.manufacturing[locale].high}`,
          saveError: t.common.saveError,
          generator: {
            open: t.demographics.generator.open,
            title: t.demographics.generator.title,
            intro: t.demographics.generator.intro,
            warning: t.demographics.generator.warning,
            participantName: t.demographics.generator.participantName,
            age: t.demographics.generator.age,
            gender: t.demographics.generator.gender,
            genderOptions: t.demographics.generator.genderOptions,
            studyProfileHint: t.demographics.generator.studyProfileHint,
            experience: t.demographics.generator.experience,
            confidence: t.demographics.generator.confidence,
            manufacturing: t.demographics.generator.manufacturing,
            preferredTool: t.demographics.generator.preferredTool,
            leastPreferredTool: t.demographics.generator.leastPreferredTool,
            optionalTool: t.demographics.generator.optionalTool,
            slidersTitle: t.demographics.generator.slidersTitle,
            answerVerbosity: t.demographics.generator.answerVerbosity,
            decisiveness: t.demographics.generator.decisiveness,
            toolTrust: t.demographics.generator.toolTrust,
            sliderLow: t.demographics.generator.sliderLow,
            sliderHigh: t.demographics.generator.sliderHigh,
            notes: t.demographics.generator.notes,
            cancel: t.demographics.generator.cancel,
            submit: t.demographics.generator.submit,
            submitting: t.demographics.generator.submitting,
            genericError: t.demographics.generator.genericError,
            distinctToolError: t.demographics.generator.distinctToolError,
            experiencePlaceholder: t.demographics.generator.experiencePlaceholder,
            likertPlaceholder: t.demographics.generator.likertPlaceholder,
          },
        }}
      />
    </main>
  );
}
