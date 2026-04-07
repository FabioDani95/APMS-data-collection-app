import { z } from "zod";

export const localeSchema = z.enum(["en", "it"]);
export const groupSchema = z.enum(["G1", "G2", "G3", "G4", "G5", "G6"]);
export const toolSchema = z.enum(["KG", "LLM", "DOC"]);

export const adminSchema = z.object({
  group_id: groupSchema.optional(),
  locale: localeSchema.default("en"),
});

export const demographicsSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  age: z.number().int().min(18).max(99),
  gender: z.enum(["male", "female"]),
  study_profile: z.string().trim().min(1).max(200),
  exp_3d_printing: z.enum(["none", "basic", "intermediate", "advanced"]),
  conf_troubleshooting: z.number().int().min(1).max(7).optional().nullable(),
  fam_manufacturing: z.number().int().min(1).max(7),
});

export const syntheticParticipantSchema = z
  .object({
    participant_name: z.string().trim().max(80).optional().or(z.literal("")),
    age: z.number().int().min(18).max(99).optional().nullable(),
    gender: z.enum(["male", "female"]).optional().nullable(),
    study_profile_hint: z.string().trim().max(200).optional().or(z.literal("")),
    exp_3d_printing: z.enum(["none", "basic", "intermediate", "advanced"]).optional().nullable(),
    conf_troubleshooting: z.number().int().min(1).max(7).optional().nullable(),
    fam_manufacturing: z.number().int().min(1).max(7).optional().nullable(),
    preferred_tool: toolSchema.optional().nullable(),
    least_preferred_tool: toolSchema.optional().nullable(),
    answer_verbosity_percent: z.number().int().min(0).max(100).optional(),
    decisiveness_percent: z.number().int().min(0).max(100).optional(),
    tool_trust_percent: z.number().int().min(0).max(100).optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.preferred_tool ||
      !data.least_preferred_tool ||
      data.preferred_tool !== data.least_preferred_tool,
    {
      message: "Preferred and least preferred tools must be different.",
      path: ["least_preferred_tool"],
    },
  );

export const createTaskSchema = z.object({
  session_id: z.number().int().positive(),
  task_order: z.number().int().min(1).max(3),
  scenario_id: z.enum(["P1", "P2", "P3"]),
  tool_assigned: toolSchema,
});

export const partialTaskSchema = z.object({
  diagnosis_text: z.string().max(5000).optional(),
  corrective_action_text: z.string().max(5000).optional(),
  confidence_score: z.number().int().min(1).max(7).nullable().optional(),
  trust_t1: z.number().int().min(1).max(7).nullable().optional(),
  trust_t2: z.number().int().min(1).max(7).nullable().optional(),
  trust_t3: z.number().int().min(1).max(7).nullable().optional(),
  timed_out: z.boolean().optional(),
  intent: z.enum(["autosave", "timeout-draft", "timeout-continue", "complete"]).optional(),
});

export const postSessionSchema = z
  .object({
    session_id: z.number().int().positive(),
    conf_troubleshooting: z.number().int().min(1).max(7),
    rank_1: toolSchema,
    rank_2: toolSchema,
    rank_3: toolSchema,
    rank_justification: z.string().max(5000).optional().or(z.literal("")),
    open_comment: z.string().max(5000).optional().or(z.literal("")),
  })
  .refine((data) => new Set([data.rank_1, data.rank_2, data.rank_3]).size === 3, {
    message: "Rankings must be unique.",
    path: ["rank_3"],
  });
