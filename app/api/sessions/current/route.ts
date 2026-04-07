import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { decodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

export async function DELETE() {
  const rawCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const sessionCookie = decodeSessionCookie(rawCookie);

  if (sessionCookie) {
    await prisma.session.deleteMany({
      where: {
        id: sessionCookie.sessionId,
      },
    });
  }

  cookies().delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ ok: true, nextPath: "/admin" });
}
