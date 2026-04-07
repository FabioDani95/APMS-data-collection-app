import { prisma } from "@/lib/prisma";

export const exportColumns = [
  "session_id",
  "participant_id",
  "group_id",
  "date",
  "first_name",
  "age",
  "gender",
  "study_profile",
  "exp_3d_printing",
  "conf_troubleshooting",
  "fam_manufacturing",
  "task_order",
  "scenario_id",
  "tool_assigned",
  "start_time",
  "end_time",
  "time_spent_seconds",
  "timed_out",
  "diagnosis_text",
  "corrective_action_text",
  "confidence_score",
  "trust_t1",
  "trust_t2",
  "trust_t3",
  "rank_1",
  "rank_2",
  "rank_3",
  "rank_justification",
  "open_comment",
] as const;

export type ExportColumn = (typeof exportColumns)[number];
export type ExportValue = string | number | boolean | Date | null;
export type ExportRow = Record<ExportColumn, ExportValue>;

export interface AdminResultRow extends ExportRow {
  row_id: string;
  task_id: number | null;
  post_session_id: number | null;
}

export function normaliseExportValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.replace(/\r?\n/g, "\\n");
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export async function getAdminResultRows(): Promise<AdminResultRow[]> {
  const sessions = await prisma.session.findMany({
    include: {
      tasks: {
        orderBy: {
          task_order: "asc",
        },
      },
      post_session: true,
    },
    orderBy: {
      id: "desc",
    },
  });

  const rows: AdminResultRow[] = [];

  sessions.forEach((session) => {
    const base = {
      session_id: session.id,
      participant_id: session.participant_id,
      group_id: session.group_id,
      date: session.created_at,
      first_name: session.first_name,
      age: session.age,
      gender: session.gender,
      study_profile: session.study_profile,
      exp_3d_printing: session.exp_3d_printing,
      conf_troubleshooting: session.conf_troubleshooting,
      fam_manufacturing: session.fam_manufacturing,
      rank_1: session.post_session?.rank_1 ?? null,
      rank_2: session.post_session?.rank_2 ?? null,
      rank_3: session.post_session?.rank_3 ?? null,
      rank_justification: session.post_session?.rank_justification ?? null,
      open_comment: session.post_session?.open_comment ?? null,
      post_session_id: session.post_session?.id ?? null,
    };

    if (session.tasks.length === 0) {
      rows.push({
        row_id: `${session.id}-session`,
        task_id: null,
        ...base,
        task_order: null,
        scenario_id: null,
        tool_assigned: null,
        start_time: null,
        end_time: null,
        time_spent_seconds: null,
        timed_out: null,
        diagnosis_text: null,
        corrective_action_text: null,
        confidence_score: null,
        trust_t1: null,
        trust_t2: null,
        trust_t3: null,
      });
      return;
    }

    session.tasks.forEach((task) => {
      rows.push({
        row_id: `${session.id}-${task.id}`,
        task_id: task.id,
        ...base,
        task_order: task.task_order,
        scenario_id: task.scenario_id,
        tool_assigned: task.tool_assigned,
        start_time: task.start_time,
        end_time: task.end_time,
        time_spent_seconds: task.time_spent_seconds,
        timed_out: task.timed_out,
        diagnosis_text: task.diagnosis_text,
        corrective_action_text: task.corrective_action_text,
        confidence_score: task.confidence_score,
        trust_t1: task.trust_t1,
        trust_t2: task.trust_t2,
        trust_t3: task.trust_t3,
      });
    });
  });

  return rows;
}
