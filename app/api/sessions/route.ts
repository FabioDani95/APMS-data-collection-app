import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGroupProgress, getRecommendedGroup } from "@/lib/group-assignment";
import { STEP_KEYS } from "@/lib/navigation";
import { getNextParticipantId } from "@/lib/participant-id";
import { prisma } from "@/lib/prisma";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { adminSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = adminSchema.parse(await request.json());
    const participantId = await getNextParticipantId();
    const completedSessions = await prisma.postSession.findMany({
      select: {
        session: {
          select: {
            group_id: true,
          },
        },
      },
    });
    const recommendedGroupId = getRecommendedGroup(
      buildGroupProgress(completedSessions.map((entry) => entry.session.group_id)),
    );
    const groupId = payload.group_id ?? recommendedGroupId;

    const session = await prisma.session.create({
      data: {
        participant_id: participantId,
        group_id: groupId,
      },
    });

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({
        sessionId: session.id,
        locale: payload.locale,
        completedSteps: [STEP_KEYS.admin],
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ session_id: session.id, participant_id: participantId }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid session payload." }, { status: 400 });
  }
}
