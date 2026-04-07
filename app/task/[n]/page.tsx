import { redirect } from "next/navigation";

import { ScenarioPanel } from "@/components/ScenarioPanel";
import { TaskClient } from "@/components/TaskClient";
import { getStudyConfig, getTaskDefinition, resolveText, resolveTextList } from "@/lib/config";
import { getCopy } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";

interface TaskPageProps {
  params: {
    n: string;
  };
}

export default async function TaskPage({ params }: TaskPageProps) {
  const taskOrder = Number(params.n);
  const cookie = readSessionCookie();

  if (!cookie || !Number.isInteger(taskOrder) || taskOrder < 1 || taskOrder > 3) {
    redirect("/admin");
  }

  const session = await prisma.session.findUnique({
    where: { id: cookie.sessionId },
    include: {
      tasks: {
        orderBy: {
          task_order: "asc",
        },
      },
    },
  });

  if (!session) {
    redirect("/admin");
  }

  const locale = cookie.locale;
  const t = getCopy(locale);
  const config = getStudyConfig();
  const taskDefinition = getTaskDefinition(session.group_id, taskOrder);

  if (!taskDefinition) {
    redirect("/admin");
  }

  const task = session.tasks.find((entry) => entry.task_order === taskOrder);

  if (!task) {
    redirect(taskOrder === 1 ? "/instructions" : `/task/${taskOrder - 1}`);
  }

  const scenario = config.scenarios[taskDefinition.scenario];
  const tool = config.tools[taskDefinition.tool];
  const startTime = task.start_time ? new Date(task.start_time) : null;
  const elapsedSeconds = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;
  const initialRemainingSeconds = Math.max(config.task_duration_seconds - elapsedSeconds, 0);

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.currentStep}</p>
        <h2 className="text-3xl font-semibold text-ink">
          {t.task.scenario} {taskOrder}
        </h2>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <ScenarioPanel
          locale={locale}
          scenarioId={taskDefinition.scenario}
          scenario={scenario}
          toolLabel={resolveText(tool.label, locale)}
          toolColor={tool.color}
          labels={{
            scenario: t.task.scenario,
            difficulty: t.task.difficulty,
            subsystem: t.task.subsystem,
            machineState: t.task.machineState,
            processParameters: t.task.processParameters,
            observableSymptoms: t.task.observableSymptoms,
            errorCode: t.task.errorCode,
            errorMessage: t.task.errorMessage,
            accordionLabel: t.task.scenarioPanelLabel,
          }}
        />

        <TaskClient
          taskId={task.id}
          toolColor={tool.color}
          initialRemainingSeconds={initialRemainingSeconds}
          initialValues={{
            diagnosis_text: task.diagnosis_text,
            corrective_action_text: task.corrective_action_text,
            confidence_score: task.confidence_score,
            trust_t1: task.trust_t1,
            trust_t2: task.trust_t2,
            trust_t3: task.trust_t3,
            timed_out: task.timed_out,
            end_time: task.end_time ? task.end_time.toISOString() : null,
          }}
          trustQuestions={resolveTextList(config.trust_questions, locale)}
          labels={{
            diagnosis: t.task.diagnosis,
            action: t.task.action,
            confidence: t.task.confidence,
            trustBlock: t.task.trustBlock,
            submit: t.task.submit,
            autosaving: t.task.autosaving,
            autosaved: t.task.autosaved,
            saving: t.task.saving,
            requiredLikert: t.task.requiredLikert,
            timeoutTitle: t.task.timeoutTitle,
            timeoutBody: t.task.timeoutBody,
            continue: t.task.continue,
            unloadMessage: t.guard.unload,
            saveError: t.common.saveError,
            scaleLow: t.common.scaleLow,
            scaleHigh: t.common.scaleHigh,
          }}
        />
      </div>
    </main>
  );
}
