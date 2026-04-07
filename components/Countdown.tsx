"use client";

import { cn } from "@/lib/utils";

interface CountdownProps {
  secondsRemaining: number;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(totalSeconds % 60, 0)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function Countdown({ secondsRemaining }: CountdownProps) {
  const urgent = secondsRemaining <= 60;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-center shadow-sm",
        urgent ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timer</div>
      <div className="mt-1 font-mono text-3xl font-bold">{formatTime(secondsRemaining)}</div>
    </div>
  );
}
