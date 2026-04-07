"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ScenarioCode, ToolCode } from "@/lib/types";

interface InstructionsStartButtonProps {
  sessionId: number;
  taskOrder: number;
  scenarioId: ScenarioCode;
  toolAssigned: ToolCode;
  label: string;
}

export function InstructionsStartButton({
  sessionId,
  taskOrder,
  scenarioId,
  toolAssigned,
  label,
}: InstructionsStartButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    setSubmitting(true);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        task_order: taskOrder,
        scenario_id: scenarioId,
        tool_assigned: toolAssigned,
      }),
    });

    if (!response.ok) {
      setSubmitting(false);
      return;
    }

    router.replace("/task/1");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={submitting}
      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
