export type Locale = "en" | "it";

export type LocalizedText = string | Record<Locale, string>;

export type ToolCode = "KG" | "LLM" | "DOC";
export type GroupCode = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
export type ScenarioCode = "P1" | "P2" | "P3";

export interface StudyConfig {
  study_title: LocalizedText;
  task_duration_seconds: number;
  likert_labels: {
    confidence: Record<Locale, { low: string; high: string }>;
    manufacturing: Record<Locale, { low: string; high: string }>;
  };
  instructions: {
    overview: Record<Locale, string[]>;
    rules: Record<Locale, string[]>;
    tools: Record<
      ToolCode,
      {
        usage_steps: Record<Locale, string[]>;
        you_may: Record<Locale, string[]>;
        you_may_not: Record<Locale, string[]>;
      }
    >;
  };
  latin_square: Record<GroupCode, Array<{ scenario: ScenarioCode; tool: ToolCode }>>;
  scenarios: Record<
    ScenarioCode,
    {
      difficulty: number;
      subsystem: LocalizedText;
      machine_state: LocalizedText;
      process_parameters: LocalizedText;
      observable_symptoms: LocalizedText[];
      error_code: string;
      error_message: LocalizedText;
    }
  >;
  tools: Record<
    ToolCode,
    {
      label: LocalizedText;
      color: "blue" | "green" | "amber";
    }
  >;
  trust_questions: LocalizedText[];
}

export interface SessionCookiePayload {
  sessionId: number;
  completedSteps: string[];
  locale: Locale;
}
