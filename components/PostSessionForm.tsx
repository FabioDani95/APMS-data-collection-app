"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LikertScale } from "@/components/LikertScale";
import type { ToolCode } from "@/lib/types";

interface PostSessionFormProps {
  sessionId: number;
  labels: {
    confidence: string;
    requiredConfidence: string;
    rank1: string;
    rank2: string;
    rank3: string;
    justification: string;
    comment: string;
    submit: string;
    selectPlaceholder: string;
    distinctError: string;
    saveError: string;
    lowConfidence: string;
    highConfidence: string;
  };
  toolOptions: Array<{ value: ToolCode; label: string }>;
}

export function PostSessionForm({ sessionId, labels, toolOptions }: PostSessionFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    conf_troubleshooting: null as number | null,
    rank_1: "",
    rank_2: "",
    rank_3: "",
    rank_justification: "",
    open_comment: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const usedRanks = useMemo(
    () => new Set([form.rank_1, form.rank_2, form.rank_3].filter(Boolean)),
    [form.rank_1, form.rank_2, form.rank_3],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const unique = new Set([form.rank_1, form.rank_2, form.rank_3]);

    if (!form.conf_troubleshooting) {
      setError(labels.requiredConfidence);
      return;
    }

    if (!form.rank_1 || !form.rank_2 || !form.rank_3 || unique.size !== 3) {
      setError(labels.distinctError);
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/post-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        ...form,
      }),
    });

    if (!response.ok) {
      setSaving(false);
      setError(labels.saveError);
      return;
    }

    const data = (await response.json()) as { nextPath?: string };
    router.replace(data.nextPath || "/done");
    router.refresh();
  }

  function availableOptions(currentValue: string) {
    return toolOptions.filter((option) => !usedRanks.has(option.value) || option.value === currentValue);
  }

  const rankFields: Array<{ field: "rank_1" | "rank_2" | "rank_3"; label: string }> = [
    { field: "rank_1", label: labels.rank1 },
    { field: "rank_2", label: labels.rank2 },
    { field: "rank_3", label: labels.rank3 },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.confidence}</span>
        <LikertScale
          value={form.conf_troubleshooting}
          onChange={(value) => setForm((current) => ({ ...current, conf_troubleshooting: value }))}
          invalid={submitted && !form.conf_troubleshooting}
          lowLabel={labels.lowConfidence}
          highLabel={labels.highConfidence}
        />
      </div>

      {rankFields.map(({ field, label }) => (
        <label key={field} className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <select
            required
            value={form[field]}
            onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
          >
            <option value="">{labels.selectPlaceholder}</option>
            {availableOptions(form[field]).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.justification}</span>
        <textarea
          rows={5}
          value={form.rank_justification}
          onChange={(event) => setForm((current) => ({ ...current, rank_justification: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.comment}</span>
        <textarea
          rows={5}
          value={form.open_comment}
          onChange={(event) => setForm((current) => ({ ...current, open_comment: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
        />
      </label>

      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
