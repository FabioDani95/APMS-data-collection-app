import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { addCompletedStep, STEP_KEYS } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { createTaskSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const cookiePayload = decodeSessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload) {
    return NextResponse.json({ message: "Missing session cookie." }, { status: 403 });
  }

  try {
    const payload = createTaskSchema.parse(await request.json());

    if (payload.session_id !== cookiePayload.sessionId) {
      return NextResponse.json({ message: "Session mismatch." }, { status: 403 });
    }

    const task = await prisma.task.upsert({
      where: {
        session_id_task_order: {
          session_id: payload.session_id,
          task_order: payload.task_order,
        },
      },
      update: {},
      create: {
        session_id: payload.session_id,
        task_order: payload.task_order,
        scenario_id: payload.scenario_id,
        tool_assigned: payload.tool_assigned,
        start_time: new Date(),
      },
    });

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie(addCompletedStep(cookiePayload, STEP_KEYS.instructions)),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ task_id: task.id, nextPath: `/task/${payload.task_order}` }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid task payload." }, { status: 400 });
  }
}
