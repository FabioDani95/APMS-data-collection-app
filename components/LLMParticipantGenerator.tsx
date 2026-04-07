"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { ToolCode } from "@/lib/types";

interface LLMParticipantGeneratorProps {
  sessionId: number;
  labels: {
    open: string;
    title: string;
    intro: string;
    warning: string;
    participantName: string;
    age: string;
    gender: string;
    genderOptions: Record<"male" | "female", string>;
    studyProfileHint: string;
    experience: string;
    confidence: string;
    manufacturing: string;
    preferredTool: string;
    leastPreferredTool: string;
    optionalTool: string;
    slidersTitle: string;
    answerVerbosity: string;
    decisiveness: string;
    toolTrust: string;
    sliderLow: string;
    sliderHigh: string;
    notes: string;
    cancel: string;
    submit: string;
    submitting: string;
    genericError: string;
    distinctToolError: string;
    experiencePlaceholder: string;
    likertPlaceholder: string;
  };
  experienceOptions: Record<string, string>;
  toolOptions: Array<{ value: ToolCode; label: string }>;
}

export function LLMParticipantGenerator({
  sessionId,
  labels,
  experienceOptions,
  toolOptions,
}: LLMParticipantGeneratorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    participant_name: "",
    age: "",
    gender: "",
    study_profile_hint: "",
    exp_3d_printing: "",
    conf_troubleshooting: "",
    fam_manufacturing: "",
    preferred_tool: "",
    least_preferred_tool: "",
    answer_verbosity_percent: 50,
    decisiveness_percent: 50,
    tool_trust_percent: 50,
    notes: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      form.preferred_tool &&
      form.least_preferred_tool &&
      form.preferred_tool === form.least_preferred_tool
    ) {
      setError(labels.distinctToolError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participant_name: form.participant_name,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        study_profile_hint: form.study_profile_hint,
        exp_3d_printing: form.exp_3d_printing || null,
        conf_troubleshooting: form.conf_troubleshooting ? Number(form.conf_troubleshooting) : null,
        fam_manufacturing: form.fam_manufacturing ? Number(form.fam_manufacturing) : null,
        preferred_tool: form.preferred_tool || null,
        least_preferred_tool: form.least_preferred_tool || null,
        answer_verbosity_percent: form.answer_verbosity_percent,
        decisiveness_percent: form.decisiveness_percent,
        tool_trust_percent: form.tool_trust_percent,
        notes: form.notes,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message || labels.genericError);
      setSubmitting(false);
      return;
    }

    const data = (await response.json()) as { nextPath?: string };
    router.replace(data.nextPath || "/done");
    router.refresh();
  }

  return (
    <>
      <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-900">{labels.open}</h3>
            <p className="text-sm leading-6 text-slate-700">{labels.warning}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-sky-300 bg-white px-4 py-3 text-sm font-semibold text-sky-900"
          >
            {labels.open}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-slate-950">{labels.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{labels.intro}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.participantName}</span>
                  <input
                    maxLength={80}
                    value={form.participant_name}
                    onChange={(event) => setForm((current) => ({ ...current, participant_name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.studyProfileHint}</span>
                  <input
                    maxLength={200}
                    value={form.study_profile_hint}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, study_profile_hint: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.age}</span>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={form.age}
                    onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.gender}</span>
                  <select
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.experiencePlaceholder}</option>
                    {Object.entries(labels.genderOptions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.experience}</span>
                  <select
                    value={form.exp_3d_printing}
                    onChange={(event) => setForm((current) => ({ ...current, exp_3d_printing: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.experiencePlaceholder}</option>
                    {Object.entries(experienceOptions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.confidence}</span>
                  <select
                    value={form.conf_troubleshooting}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, conf_troubleshooting: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.likertPlaceholder}</option>
                    {Array.from({ length: 7 }, (_, index) => String(index + 1)).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.manufacturing}</span>
                  <select
                    value={form.fam_manufacturing}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fam_manufacturing: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.likertPlaceholder}</option>
                    {Array.from({ length: 7 }, (_, index) => String(index + 1)).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.preferredTool}</span>
                  <select
                    value={form.preferred_tool}
                    onChange={(event) => setForm((current) => ({ ...current, preferred_tool: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.optionalTool}</option>
                    {toolOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">{labels.leastPreferredTool}</span>
                  <select
                    value={form.least_preferred_tool}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, least_preferred_tool: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">{labels.optionalTool}</option>
                    {toolOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {labels.slidersTitle}
                  </h4>
                </div>

                <div className="space-y-4">
                  {[
                    ["answer_verbosity_percent", labels.answerVerbosity],
                    ["decisiveness_percent", labels.decisiveness],
                    ["tool_trust_percent", labels.toolTrust],
                  ].map(([field, label]) => {
                    const key = field as keyof typeof form;
                    const value = Number(form[key]);

                    return (
                      <label key={field} className="block space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                          <span className="min-w-10 text-right text-sm font-semibold text-slate-900">{value}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={value}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, [field]: Number(event.target.value) }))
                          }
                          className="w-full accent-slate-900"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{labels.sliderLow}</span>
                          <span>{labels.sliderHigh}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{labels.notes}</span>
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                />
              </label>

              {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? labels.submitting : labels.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
