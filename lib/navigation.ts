import type { SessionCookiePayload } from "@/lib/types";

export const STEP_KEYS = {
  admin: "admin",
  demographics: "demographics",
  instructions: "instructions",
  task1: "task-1",
  task2: "task-2",
  task3: "task-3",
  postSession: "post-session",
} as const;

export function addCompletedStep(payload: SessionCookiePayload, step: string): SessionCookiePayload {
  if (payload.completedSteps.includes(step)) {
    return payload;
  }

  return {
    ...payload,
    completedSteps: [...payload.completedSteps, step],
  };
}

export function getCurrentRoute(completedSteps: string[]): string {
  if (!completedSteps.includes(STEP_KEYS.demographics)) {
    return "/";
  }

  if (!completedSteps.includes(STEP_KEYS.instructions)) {
    return "/instructions";
  }

  if (!completedSteps.includes(STEP_KEYS.task1)) {
    return "/task/1";
  }

  if (!completedSteps.includes(STEP_KEYS.task2)) {
    return "/task/2";
  }

  if (!completedSteps.includes(STEP_KEYS.task3)) {
    return "/task/3";
  }

  if (!completedSteps.includes(STEP_KEYS.postSession)) {
    return "/post-session";
  }

  return "/done";
}

export function nextRouteAfterTask(taskOrder: number): string {
  return taskOrder >= 3 ? "/post-session" : `/task/${taskOrder + 1}`;
}
