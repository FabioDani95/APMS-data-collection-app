import fs from "node:fs";
import path from "node:path";

import { StudyConfig, type Locale, type LocalizedText, type ToolCode } from "@/lib/types";

const CONFIG_PATH = path.join(process.cwd(), "config", "study.json");

let cachedConfig: StudyConfig | null = null;

export function getStudyConfig(): StudyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  cachedConfig = JSON.parse(raw) as StudyConfig;
  return cachedConfig;
}

export function resolveText(value: LocalizedText, locale: Locale): string {
  if (typeof value === "string") {
    return value;
  }

  return value[locale] ?? value.en;
}

export function resolveTextList(values: LocalizedText[], locale: Locale): string[] {
  return values.map((value) => resolveText(value, locale));
}

export function getTaskDefinition(groupId: string, taskOrder: number) {
  const config = getStudyConfig();
  const sequence = config.latin_square[groupId as keyof typeof config.latin_square];

  if (!sequence || taskOrder < 1 || taskOrder > sequence.length) {
    return null;
  }

  return sequence[taskOrder - 1];
}

export function getToolColor(tool: ToolCode) {
  return getStudyConfig().tools[tool].color;
}
