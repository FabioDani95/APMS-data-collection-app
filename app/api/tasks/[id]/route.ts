import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getTaskDefinition } from "@/lib/config";
import { addCompletedStep, nextRouteAfterTask, STEP_KEYS } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { partialTaskSchema } from "@/lib/validation";

const taskStepMap = {
  1: STEP_KEYS.task1,
  2: STEP_KEYS.task2,
  3: STEP_KEYS.task3,
} as const;

interface TaskRouteProps {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: TaskRouteProps) {
  const taskId = Number(params.id);
  const cookiePayload = decodeSessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload) {
    return NextResponse.json({ message: "Missing session cookie." }, { status: 403 });
  }

  try {
    const payload = partialTaskSchema.parse(await request.json());
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { session: true },
    });

    if (!task || task.session_id !== cookiePayload.sessionId) {
      return NextResponse.json({ message: "Task mismatch." }, { status: 403 });
    }

    const now = new Date();
    const intent = payload.intent ?? "autosave";
    const updateData: Record<string, unknown> = {};

    if (payload.diagnosis_text !== undefined) {
      updateData.diagnosis_text = payload.diagnosis_text;
    }
    if (payload.corrective_action_text !== undefined) {
      updateData.corrective_action_text = payload.corrective_action_text;
    }
    if (payload.confidence_score !== undefined) {
      updateData.confidence_score = payload.confidence_score;
    }
    if (payload.trust_t1 !== undefined) {
      updateData.trust_t1 = payload.trust_t1;
    }
    if (payload.trust_t2 !== undefined) {
      updateData.trust_t2 = payload.trust_t2;
    }
    if (payload.trust_t3 !== undefined) {
      updateData.trust_t3 = payload.trust_t3;
    }

    if (intent === "timeout-draft" && !task.end_time) {
      updateData.timed_out = true;
      updateData.end_time = now;
      if (task.start_time) {
        updateData.time_spent_seconds = Math.max(
          Math.floor((now.getTime() - task.start_time.getTime()) / 1000),
          0,
        );
      }
    }

    if (intent === "complete") {
      if (!payload.confidence_score || !payload.trust_t1 || !payload.trust_t2 || !payload.trust_t3) {
        return NextResponse.json({ message: "Required fields missing." }, { status: 400 });
      }

      updateData.end_time = task.end_time ?? now;
      updateData.timed_out = task.timed_out;
      if (task.start_time) {
        updateData.time_spent_seconds = Math.max(
          Math.floor(((task.end_time ?? now).getTime() - task.start_time.getTime()) / 1000),
          0,
        );
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.task.update({
        where: { id: task.id },
        data: updateData,
      });
    }

    if (intent === "autosave" || intent === "timeout-draft") {
      return NextResponse.json({ ok: true });
    }

    let nextCookie = addCompletedStep(cookiePayload, taskStepMap[task.task_order as keyof typeof taskStepMap]);
    const nextPath = nextRouteAfterTask(task.task_order);

    if (task.task_order < 3) {
      const nextOrder = task.task_order + 1;
      const nextDefinition = getTaskDefinition(task.session.group_id, nextOrder);

      if (!nextDefinition) {
        return NextResponse.json({ message: "Unable to determine the next task." }, { status: 500 });
      }

      await prisma.task.upsert({
        where: {
          session_id_task_order: {
            session_id: task.session_id,
            task_order: nextOrder,
          },
        },
        update: {},
        create: {
          session_id: task.session_id,
          task_order: nextOrder,
          scenario_id: nextDefinition.scenario,
          tool_assigned: nextDefinition.tool,
          start_time: new Date(),
        },
      });
    }

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie(nextCookie),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ ok: true, nextPath });
  } catch {
    return NextResponse.json({ message: "Invalid task payload." }, { status: 400 });
  }
}
