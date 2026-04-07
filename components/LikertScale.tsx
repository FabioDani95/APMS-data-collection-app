"use client";

import { cn } from "@/lib/utils";

interface LikertScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  color?: "blue" | "green" | "amber";
  required?: boolean;
  invalid?: boolean;
  lowLabel?: string;
  highLabel?: string;
  disabled?: boolean;
}

const activeClasses = {
  blue: "border-blue-600 bg-blue-600 text-white",
  green: "border-emerald-600 bg-emerald-600 text-white",
  amber: "border-amber-500 bg-amber-500 text-white",
};

export function LikertScale({
  value,
  onChange,
  color = "blue",
  invalid = false,
  lowLabel,
  highLabel,
  disabled = false,
}: LikertScaleProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, index) => {
          const option = index + 1;
          const selected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              disabled={disabled}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                invalid ? "border-rose-400" : "border-slate-300",
                !selected && "bg-white text-slate-700 hover:border-slate-500",
                selected && activeClasses[color],
              )}
              aria-pressed={selected}
            >
              {option}
            </button>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-xs text-slate-500">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
