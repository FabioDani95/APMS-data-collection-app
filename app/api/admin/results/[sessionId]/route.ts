import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const nullableText = z.string().optional().nullable();
const nullableInt = z.number().int().min(1).max(7).optional().nullable();
const nullableDate = z.string().datetime().optional().nullable();

const adminResultUpdateSchema = z.object({
  session: z.object({
    participant_id: z.string().trim().min(1).max(80),
    group_id: z.enum(["G1", "G2", "G3", "G4", "G5", "G6"]),
    date: z.string().datetime(),
    first_name: nullableText,
    age: z.number().int().min(18).max(99).optional().nullable(),
    gender: z.enum(["male", "female"]).optional().nullable(),
    study_profile: nullableText,
    exp_3d_printing: z.enum(["none", "basic", "intermediate", "advanced"]).optional().nullable(),
    conf_troubleshooting: nullableInt,
    fam_manufacturing: nullableInt,
  }),
  task: z
    .object({
      id: z.number().int().positive(),
      task_order: z.number().int().min(1).max(3),
      scenario_id: z.enum(["P1", "P2", "P3"]).nullable(),
      tool_assigned: z.enum(["KG", "LLM", "DOC"]).nullable(),
      start_time: nullableDate,
      end_time: nullableDate,
      time_spent_seconds: z.number().int().min(0).optional().nullable(),
      timed_out: z.boolean().optional().nullable(),
      diagnosis_text: nullableText,
      corrective_action_text: nullableText,
      confidence_score: nullableInt,
      trust_t1: nullableInt,
      trust_t2: nullableInt,
      trust_t3: nullableInt,
    })
    .nullable(),
  postSession: z
    .object({
      rank_1: z.enum(["KG", "LLM", "DOC"]).optional().nullable(),
      rank_2: z.enum(["KG", "LLM", "DOC"]).optional().nullable(),
      rank_3: z.enum(["KG", "LLM", "DOC"]).optional().nullable(),
      rank_justification: nullableText,
      open_comment: nullableText,
    })
    .nullable(),
});

function normaliseOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

interface RouteProps {
  params: {
    sessionId: string;
  };
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const sessionId = Number(params.sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  try {
    const payload = adminResultUpdateSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: {
          participant_id: payload.session.participant_id.trim(),
          group_id: payload.session.group_id,
          created_at: new Date(payload.session.date),
          first_name: normaliseOptionalText(payload.session.first_name),
          age: payload.session.age ?? null,
          gender: payload.session.gender ?? null,
          study_profile: normaliseOptionalText(payload.session.study_profile),
          exp_3d_printing: payload.session.exp_3d_printing ?? null,
          conf_troubleshooting: payload.session.conf_troubleshooting ?? null,
          fam_manufacturing: payload.session.fam_manufacturing ?? null,
        },
      });

      if (payload.task) {
        await tx.task.update({
          where: {
            id: payload.task.id,
            session_id: sessionId,
          },
          data: {
            task_order: payload.task.task_order,
            scenario_id: payload.task.scenario_id ?? "",
            tool_assigned: payload.task.tool_assigned ?? "",
            start_time: payload.task.start_time ? new Date(payload.task.start_time) : null,
            end_time: payload.task.end_time ? new Date(payload.task.end_time) : null,
            time_spent_seconds: payload.task.time_spent_seconds ?? null,
            timed_out: payload.task.timed_out ?? false,
            diagnosis_text: normaliseOptionalText(payload.task.diagnosis_text),
            corrective_action_text: normaliseOptionalText(payload.task.corrective_action_text),
            confidence_score: payload.task.confidence_score ?? null,
            trust_t1: payload.task.trust_t1 ?? null,
            trust_t2: payload.task.trust_t2 ?? null,
            trust_t3: payload.task.trust_t3 ?? null,
          },
        });
      }

      if (payload.postSession) {
        const hasAnyRanking = payload.postSession.rank_1 && payload.postSession.rank_2 && payload.postSession.rank_3;
        const hasAnyText =
          normaliseOptionalText(payload.postSession.rank_justification) ||
          normaliseOptionalText(payload.postSession.open_comment);

        if (hasAnyRanking || hasAnyText) {
          await tx.postSession.upsert({
            where: { session_id: sessionId },
            update: {
              rank_1: payload.postSession.rank_1 ?? "KG",
              rank_2: payload.postSession.rank_2 ?? "LLM",
              rank_3: payload.postSession.rank_3 ?? "DOC",
              rank_justification: normaliseOptionalText(payload.postSession.rank_justification),
              open_comment: normaliseOptionalText(payload.postSession.open_comment),
            },
            create: {
              session_id: sessionId,
              rank_1: payload.postSession.rank_1 ?? "KG",
              rank_2: payload.postSession.rank_2 ?? "LLM",
              rank_3: payload.postSession.rank_3 ?? "DOC",
              rank_justification: normaliseOptionalText(payload.postSession.rank_justification),
              open_comment: normaliseOptionalText(payload.postSession.open_comment),
            },
          });
        } else {
          await tx.postSession.deleteMany({
            where: { session_id: sessionId },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Unable to update the session row." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const sessionId = Number(params.sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ message: "Invalid session id." }, { status: 400 });
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  return NextResponse.json({ ok: true });
}
