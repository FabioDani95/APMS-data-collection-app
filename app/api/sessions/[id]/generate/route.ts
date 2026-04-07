import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getTaskDefinition } from "@/lib/config";
import { STEP_KEYS } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { generateSyntheticParticipant, getSyntheticModelName } from "@/lib/synthetic-participant";
import { syntheticParticipantSchema } from "@/lib/validation";

interface SessionGenerateRouteProps {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: SessionGenerateRouteProps) {
  const id = Number(params.id);
  const cookiePayload = decodeSessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload || cookiePayload.sessionId !== id) {
    return NextResponse.json({ message: "Session mismatch." }, { status: 403 });
  }

  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true, group_id: true },
  });

  if (!session) {
    return NextResponse.json({ message: "Session not found." }, { status: 404 });
  }

  try {
    const guidance = syntheticParticipantSchema.parse(await request.json());
    const generated = await generateSyntheticParticipant(cookiePayload.locale, session.group_id, guidance);
    const now = Date.now();
    const completedSteps = [
      STEP_KEYS.admin,
      STEP_KEYS.demographics,
      STEP_KEYS.instructions,
      STEP_KEYS.task1,
      STEP_KEYS.task2,
      STEP_KEYS.task3,
      STEP_KEYS.postSession,
    ];

    const taskTimeline = generated.tasks.map((task, index) => {
      const laterTasksDuration = generated.tasks
        .slice(index + 1)
        .reduce((sum, entry) => sum + entry.time_spent_seconds, 0);
      const laterBreaks = (generated.tasks.length - index - 1) * 45;
      const endTime = new Date(now - (laterTasksDuration + laterBreaks) * 1000);
      const startTime = new Date(endTime.getTime() - task.time_spent_seconds * 1000);

      return { startTime, endTime };
    });

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: session.id },
        data: {
          created_at: new Date(taskTimeline[0].startTime.getTime() - 120000),
          first_name: generated.demographics.first_name,
          age: generated.demographics.age,
          gender: generated.demographics.gender,
          study_profile: generated.demographics.study_profile,
          exp_3d_printing: generated.demographics.exp_3d_printing,
          conf_troubleshooting: generated.demographics.conf_troubleshooting,
          fam_manufacturing: generated.demographics.fam_manufacturing,
        },
      });

      for (const task of generated.tasks) {
        const definition = getTaskDefinition(session.group_id, task.task_order);
        if (!definition) {
          throw new Error(`Missing task definition for ${session.group_id} task ${task.task_order}.`);
        }

        const { startTime, endTime } = taskTimeline[task.task_order - 1];

        await tx.task.upsert({
          where: {
            session_id_task_order: {
              session_id: session.id,
              task_order: task.task_order,
            },
          },
          update: {
            scenario_id: definition.scenario,
            tool_assigned: definition.tool,
            start_time: startTime,
            end_time: endTime,
            time_spent_seconds: task.time_spent_seconds,
            diagnosis_text: task.diagnosis_text,
            corrective_action_text: task.corrective_action_text,
            confidence_score: task.confidence_score,
            trust_t1: task.trust_t1,
            trust_t2: task.trust_t2,
            trust_t3: task.trust_t3,
            timed_out: task.timed_out,
          },
          create: {
            session_id: session.id,
            task_order: task.task_order,
            scenario_id: definition.scenario,
            tool_assigned: definition.tool,
            start_time: startTime,
            end_time: endTime,
            time_spent_seconds: task.time_spent_seconds,
            diagnosis_text: task.diagnosis_text,
            corrective_action_text: task.corrective_action_text,
            confidence_score: task.confidence_score,
            trust_t1: task.trust_t1,
            trust_t2: task.trust_t2,
            trust_t3: task.trust_t3,
            timed_out: task.timed_out,
          },
        });
      }

      await tx.postSession.upsert({
        where: { session_id: session.id },
        update: {
          rank_1: generated.post_session.rank_1,
          rank_2: generated.post_session.rank_2,
          rank_3: generated.post_session.rank_3,
          rank_justification: generated.post_session.rank_justification || null,
          open_comment: generated.post_session.open_comment || null,
        },
        create: {
          session_id: session.id,
          rank_1: generated.post_session.rank_1,
          rank_2: generated.post_session.rank_2,
          rank_3: generated.post_session.rank_3,
          rank_justification: generated.post_session.rank_justification || null,
          open_comment: generated.post_session.open_comment || null,
        },
      });
    });

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({
        ...cookiePayload,
        completedSteps,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json(
      {
        ok: true,
        nextPath: `/done?sessionId=${session.id}&locale=${cookiePayload.locale}`,
        model: getSyntheticModelName(),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate synthetic participant.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 400;
    return NextResponse.json({ message }, { status });
  }
}
