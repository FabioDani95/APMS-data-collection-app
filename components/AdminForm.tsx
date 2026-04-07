"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { GroupCode, Locale } from "@/lib/types";

interface AdminFormProps {
  locale: Locale;
  initialGroupId: GroupCode;
  groupOptions: Array<{ value: GroupCode; label: string }>;
  labels: {
    group: string;
    groupHelp: string;
    interfaceLanguage: string;
    submit: string;
    genericError: string;
  };
}

export function AdminForm({ locale, initialGroupId, groupOptions, labels }: AdminFormProps) {
  const router = useRouter();
  const [groupId, setGroupId] = useState<GroupCode>(initialGroupId);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        group_id: groupId,
        locale: selectedLocale,
      }),
    });

    if (!response.ok) {
      setError(labels.genericError);
      setSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.group}</span>
        <p className="text-xs leading-6 text-slate-500">{labels.groupHelp}</p>
        <select
          value={groupId}
          onChange={(event) => setGroupId(event.target.value as GroupCode)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
        >
          {groupOptions.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.interfaceLanguage}</span>
        <select
          value={selectedLocale}
          onChange={(event) => setSelectedLocale(event.target.value as Locale)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
        >
          <option value="en">English</option>
          <option value="it">Italiano</option>
        </select>
      </label>

      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
