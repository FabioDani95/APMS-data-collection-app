import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { addCompletedStep, STEP_KEYS } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { demographicsSchema } from "@/lib/validation";

interface SessionRouteProps {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: SessionRouteProps) {
  const id = Number(params.id);
  const cookiePayload = decodeSessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload || cookiePayload.sessionId !== id) {
    return NextResponse.json({ message: "Session mismatch." }, { status: 403 });
  }

  try {
    const payload = demographicsSchema.parse(await request.json());

    await prisma.session.update({
      where: { id },
      data: payload,
    });

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie(addCompletedStep(cookiePayload, STEP_KEYS.demographics)),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ ok: true, nextPath: "/instructions" });
  } catch {
    return NextResponse.json({ message: "Invalid demographics payload." }, { status: 400 });
  }
}
