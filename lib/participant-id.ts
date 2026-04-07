import { prisma } from "@/lib/prisma";

const PARTICIPANT_ID_PATTERN = /^(?:ID)?(\d+)$/i;

function formatParticipantId(sequence: number) {
  return `ID${sequence.toString().padStart(3, "0")}`;
}

export async function getNextParticipantId() {
  const existingSessions = await prisma.session.findMany({
    select: {
      participant_id: true,
    },
  });

  const maxSequence = existingSessions.reduce((max, session) => {
    const match = session.participant_id.match(PARTICIPANT_ID_PATTERN);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  let nextSequence = maxSequence + 1;

  while (true) {
    const candidate = formatParticipantId(nextSequence);
    const existing = await prisma.session.findUnique({
      where: {
        participant_id: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    nextSequence += 1;
  }
}
