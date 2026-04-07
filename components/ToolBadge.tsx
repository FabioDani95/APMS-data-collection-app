import { cn } from "@/lib/utils";

interface ToolBadgeProps {
  color: "blue" | "green" | "amber";
  label: string;
}

const colorClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
};

export function ToolBadge({ color, label }: ToolBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
        colorClasses[color],
      )}
    >
      {label}
    </span>
  );
}
