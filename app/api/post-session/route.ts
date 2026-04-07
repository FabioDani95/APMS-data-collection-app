import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { addCompletedStep, STEP_KEYS } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { postSessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const cookiePayload = decodeSessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload) {
    return NextResponse.json({ message: "Missing session cookie." }, { status: 403 });
  }

  try {
    const payload = postSessionSchema.parse(await request.json());

    if (payload.session_id !== cookiePayload.sessionId) {
      return NextResponse.json({ message: "Session mismatch." }, { status: 403 });
    }

    await prisma.postSession.upsert({
      where: { session_id: payload.session_id },
      update: {
        rank_1: payload.rank_1,
        rank_2: payload.rank_2,
        rank_3: payload.rank_3,
        rank_justification: payload.rank_justification || null,
        open_comment: payload.open_comment || null,
      },
      create: {
        session_id: payload.session_id,
        rank_1: payload.rank_1,
        rank_2: payload.rank_2,
        rank_3: payload.rank_3,
        rank_justification: payload.rank_justification || null,
        open_comment: payload.open_comment || null,
      },
    });

    await prisma.session.update({
      where: { id: payload.session_id },
      data: {
        conf_troubleshooting: payload.conf_troubleshooting,
      },
    });

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie(addCompletedStep(cookiePayload, STEP_KEYS.postSession)),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json(
      {
        ok: true,
        nextPath: `/done?sessionId=${payload.session_id}&locale=${cookiePayload.locale}`,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: "Invalid post-session payload." }, { status: 400 });
  }
}
