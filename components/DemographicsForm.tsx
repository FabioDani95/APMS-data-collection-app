"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { LikertScale } from "@/components/LikertScale";
import { LLMParticipantGenerator } from "@/components/LLMParticipantGenerator";
import type { Locale, ToolCode } from "@/lib/types";

interface DemographicsFormProps {
  sessionId: number;
  locale: Locale;
  toolOptions: Array<{ value: ToolCode; label: string }>;
  labels: {
    firstName: string;
    age: string;
    gender: string;
    genderOptions: Record<"male" | "female", string>;
    studyProfile: string;
    studyProfileHelp: string;
    studyProfilePlaceholder: string;
    experience: string;
    manufacturing: string;
    submit: string;
    experienceOptions: Record<string, string>;
    lowManufacturing: string;
    highManufacturing: string;
    saveError: string;
    generator: {
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
  };
}

export function DemographicsForm({ sessionId, labels, toolOptions }: DemographicsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    age: "",
    gender: "male" as "male" | "female",
    study_profile: "",
    exp_3d_printing: "none",
    fam_manufacturing: null as number | null,
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!form.fam_manufacturing) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        age: Number(form.age),
      }),
    });

    if (!response.ok) {
      setSaving(false);
      setError(labels.saveError);
      return;
    }

    router.replace("/instructions");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <LLMParticipantGenerator
        sessionId={sessionId}
        labels={labels.generator}
        experienceOptions={labels.experienceOptions}
        toolOptions={toolOptions}
      />

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">{labels.firstName}</span>
          <input
            required
            maxLength={80}
            value={form.first_name}
            onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{labels.age}</span>
            <input
              required
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
              onChange={(event) =>
                setForm((current) => ({ ...current, gender: event.target.value as "male" | "female" }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
            >
              {Object.entries(labels.genderOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">{labels.studyProfile}</span>
          <p className="text-xs leading-6 text-slate-500">{labels.studyProfileHelp}</p>
          <input
            required
            maxLength={200}
            placeholder={labels.studyProfilePlaceholder}
            value={form.study_profile}
            onChange={(event) => setForm((current) => ({ ...current, study_profile: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">{labels.experience}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(labels.experienceOptions).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="exp_3d_printing"
                  value={value}
                  checked={form.exp_3d_printing === value}
                  onChange={(event) => setForm((current) => ({ ...current, exp_3d_printing: event.target.value }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">{labels.manufacturing}</span>
          <LikertScale
            value={form.fam_manufacturing}
            onChange={(value) => setForm((current) => ({ ...current, fam_manufacturing: value }))}
            invalid={submitted && !form.fam_manufacturing}
            lowLabel={labels.lowManufacturing}
            highLabel={labels.highManufacturing}
          />
        </div>

        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {labels.submit}
        </button>
      </form>
    </div>
  );
}
