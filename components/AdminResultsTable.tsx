"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminResultRow } from "@/lib/export";

interface AdminResultsTableProps {
  rows: AdminResultRow[];
  labels: {
    title: string;
    intro: string;
    downloadCsv: string;
    noResults: string;
    overviewSessions: string;
    overviewRows: string;
    overviewCompleted: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    deleteConfirm: string;
    saveError: string;
    deleteError: string;
    sessionSection: string;
    taskSection: string;
    postSection: string;
    participantId: string;
    group: string;
    date: string;
    firstName: string;
    age: string;
    gender: string;
    studyProfile: string;
    experience: string;
    troubleshooting: string;
    manufacturing: string;
    taskOrder: string;
    scenario: string;
    tool: string;
    startTime: string;
    endTime: string;
    timeSpent: string;
    timedOut: string;
    diagnosis: string;
    correctiveAction: string;
    confidence: string;
    trust1: string;
    trust2: string;
    trust3: string;
    rank1: string;
    rank2: string;
    rank3: string;
    rankJustification: string;
    openComment: string;
    noTask: string;
    booleanTrue: string;
    booleanFalse: string;
  };
}

type EditableRow = {
  participant_id: string;
  group_id: string;
  date: string;
  first_name: string;
  age: string;
  gender: string;
  study_profile: string;
  exp_3d_printing: string;
  conf_troubleshooting: string;
  fam_manufacturing: string;
  task_order: string;
  scenario_id: string;
  tool_assigned: string;
  start_time: string;
  end_time: string;
  time_spent_seconds: string;
  timed_out: string;
  diagnosis_text: string;
  corrective_action_text: string;
  confidence_score: string;
  trust_t1: string;
  trust_t2: string;
  trust_t3: string;
  rank_1: string;
  rank_2: string;
  rank_3: string;
  rank_justification: string;
  open_comment: string;
};

function sessionIdOf(row: AdminResultRow) {
  return Number(row.session_id);
}

function toInputDateTime(value: string | number | boolean | Date | null) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 16);
  }

  if (typeof value === "string") {
    return value.includes("T") ? value.slice(0, 16) : value;
  }

  return String(value);
}

function toEditableRow(row: AdminResultRow): EditableRow {
  return {
    participant_id: String(row.participant_id ?? ""),
    group_id: String(row.group_id ?? ""),
    date: toInputDateTime(row.date),
    first_name: String(row.first_name ?? ""),
    age: String(row.age ?? ""),
    gender: String(row.gender ?? ""),
    study_profile: String(row.study_profile ?? ""),
    exp_3d_printing: String(row.exp_3d_printing ?? ""),
    conf_troubleshooting: String(row.conf_troubleshooting ?? ""),
    fam_manufacturing: String(row.fam_manufacturing ?? ""),
    task_order: String(row.task_order ?? ""),
    scenario_id: String(row.scenario_id ?? ""),
    tool_assigned: String(row.tool_assigned ?? ""),
    start_time: toInputDateTime(row.start_time),
    end_time: toInputDateTime(row.end_time),
    time_spent_seconds: String(row.time_spent_seconds ?? ""),
    timed_out: row.timed_out === null ? "" : String(Boolean(row.timed_out)),
    diagnosis_text: String(row.diagnosis_text ?? ""),
    corrective_action_text: String(row.corrective_action_text ?? ""),
    confidence_score: String(row.confidence_score ?? ""),
    trust_t1: String(row.trust_t1 ?? ""),
    trust_t2: String(row.trust_t2 ?? ""),
    trust_t3: String(row.trust_t3 ?? ""),
    rank_1: String(row.rank_1 ?? ""),
    rank_2: String(row.rank_2 ?? ""),
    rank_3: String(row.rank_3 ?? ""),
    rank_justification: String(row.rank_justification ?? ""),
    open_comment: String(row.open_comment ?? ""),
  };
}

function preview(text: string | number | boolean | Date | null) {
  if (text === null || text === undefined || text === "") {
    return "—";
  }

  const value = text instanceof Date ? text.toISOString() : String(text);
  return value.length > 90 ? `${value.slice(0, 90)}…` : value;
}

function displayValue(value: string | number | boolean | Date | null) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

function coerceNullableInt(value: string) {
  return value ? Number(value) : null;
}

function coerceNullableDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AdminResultsTable({ rows, labels }: AdminResultsTableProps) {
  const router = useRouter();
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedSessions = useMemo(() => {
    return new Set(rows.filter((row) => row.rank_1 && row.rank_2 && row.rank_3).map((row) => sessionIdOf(row))).size;
  }, [rows]);

  async function handleDelete(sessionId: number) {
    if (!window.confirm(labels.deleteConfirm)) {
      return;
    }

    const response = await fetch(`/api/admin/results/${sessionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(labels.deleteError);
      return;
    }

    router.refresh();
  }

  async function handleSave(row: AdminResultRow) {
    if (!draft) {
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/admin/results/${sessionIdOf(row)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          participant_id: draft.participant_id,
          group_id: draft.group_id,
          date: new Date(draft.date).toISOString(),
          first_name: draft.first_name || null,
          age: draft.age ? Number(draft.age) : null,
          gender: draft.gender || null,
          study_profile: draft.study_profile || null,
          exp_3d_printing: draft.exp_3d_printing || null,
          conf_troubleshooting: coerceNullableInt(draft.conf_troubleshooting),
          fam_manufacturing: coerceNullableInt(draft.fam_manufacturing),
        },
        task: row.task_id
          ? {
              id: row.task_id,
              task_order: Number(draft.task_order),
              scenario_id: draft.scenario_id || null,
              tool_assigned: draft.tool_assigned || null,
              start_time: coerceNullableDate(draft.start_time),
              end_time: coerceNullableDate(draft.end_time),
              time_spent_seconds: draft.time_spent_seconds ? Number(draft.time_spent_seconds) : null,
              timed_out: draft.timed_out === "" ? null : draft.timed_out === "true",
              diagnosis_text: draft.diagnosis_text || null,
              corrective_action_text: draft.corrective_action_text || null,
              confidence_score: coerceNullableInt(draft.confidence_score),
              trust_t1: coerceNullableInt(draft.trust_t1),
              trust_t2: coerceNullableInt(draft.trust_t2),
              trust_t3: coerceNullableInt(draft.trust_t3),
            }
          : null,
        postSession: {
          rank_1: draft.rank_1 || null,
          rank_2: draft.rank_2 || null,
          rank_3: draft.rank_3 || null,
          rank_justification: draft.rank_justification || null,
          open_comment: draft.open_comment || null,
        },
      }),
    });

    if (!response.ok) {
      setSaving(false);
      setError(labels.saveError);
      return;
    }

    setSaving(false);
    setEditingRowId(null);
    setDraft(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-ink">{labels.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{labels.intro}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {labels.overviewSessions}: {new Set(rows.map((row) => sessionIdOf(row))).size}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {labels.overviewRows}: {rows.length}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {labels.overviewCompleted}: {completedSessions}
            </span>
          </div>
        </div>
        <a
          href="/api/export"
          className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          {labels.downloadCsv}
        </a>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-panel">
          {labels.noResults}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const isEditing = editingRowId === row.row_id;

            return (
              <section key={row.row_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.participantId}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{displayValue(row.participant_id)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.group}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{displayValue(row.group_id)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.taskOrder}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {row.task_order === null ? labels.noTask : displayValue(row.task_order)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.scenario}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{displayValue(row.scenario_id)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.tool}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{displayValue(row.tool_assigned)}</div>
                    </div>
                    <div className="sm:col-span-2 xl:col-span-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.diagnosis}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{preview(row.diagnosis_text)}</div>
                    </div>
                    <div className="sm:col-span-2 xl:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.correctiveAction}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{preview(row.corrective_action_text)}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRowId(isEditing ? null : row.row_id);
                        setDraft(isEditing ? null : toEditableRow(row));
                        setError(null);
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {isEditing ? labels.cancel : labels.edit}
                    </button>
                    <button
                      type="button"
                        onClick={() => handleDelete(sessionIdOf(row))}
                      className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      {labels.delete}
                    </button>
                  </div>
                </div>

                {isEditing && draft ? (
                  <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.sessionSection}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.participantId}</span>
                          <input
                            value={draft.participant_id}
                            onChange={(event) => setDraft({ ...draft, participant_id: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.group}</span>
                          <select
                            value={draft.group_id}
                            onChange={(event) => setDraft({ ...draft, group_id: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            {["G1", "G2", "G3", "G4", "G5", "G6"].map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.date}</span>
                          <input
                            type="datetime-local"
                            value={draft.date}
                            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.firstName}</span>
                          <input
                            value={draft.first_name}
                            onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.age}</span>
                          <input
                            type="number"
                            min="18"
                            max="99"
                            value={draft.age}
                            onChange={(event) => setDraft({ ...draft, age: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.gender}</span>
                          <select
                            value={draft.gender}
                            onChange={(event) => setDraft({ ...draft, gender: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">—</option>
                            {["male", "female"].map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.studyProfile}</span>
                          <input
                            value={draft.study_profile}
                            onChange={(event) => setDraft({ ...draft, study_profile: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.experience}</span>
                          <select
                            value={draft.exp_3d_printing}
                            onChange={(event) => setDraft({ ...draft, exp_3d_printing: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">—</option>
                            {["none", "basic", "intermediate", "advanced"].map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.troubleshooting}</span>
                          <input
                            type="number"
                            min="1"
                            max="7"
                            value={draft.conf_troubleshooting}
                            onChange={(event) => setDraft({ ...draft, conf_troubleshooting: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-700">{labels.manufacturing}</span>
                          <input
                            type="number"
                            min="1"
                            max="7"
                            value={draft.fam_manufacturing}
                            onChange={(event) => setDraft({ ...draft, fam_manufacturing: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </section>

                    {row.task_id ? (
                      <section className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {labels.taskSection}
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.taskOrder}</span>
                            <input
                              type="number"
                              min="1"
                              max="3"
                              value={draft.task_order}
                              onChange={(event) => setDraft({ ...draft, task_order: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.scenario}</span>
                            <select
                              value={draft.scenario_id}
                              onChange={(event) => setDraft({ ...draft, scenario_id: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              {["P1", "P2", "P3"].map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.tool}</span>
                            <select
                              value={draft.tool_assigned}
                              onChange={(event) => setDraft({ ...draft, tool_assigned: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              {["KG", "LLM", "DOC"].map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.startTime}</span>
                            <input
                              type="datetime-local"
                              value={draft.start_time}
                              onChange={(event) => setDraft({ ...draft, start_time: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.endTime}</span>
                            <input
                              type="datetime-local"
                              value={draft.end_time}
                              onChange={(event) => setDraft({ ...draft, end_time: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.timeSpent}</span>
                            <input
                              type="number"
                              min="0"
                              value={draft.time_spent_seconds}
                              onChange={(event) => setDraft({ ...draft, time_spent_seconds: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.timedOut}</span>
                            <select
                              value={draft.timed_out}
                              onChange={(event) => setDraft({ ...draft, timed_out: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              <option value="true">{labels.booleanTrue}</option>
                              <option value="false">{labels.booleanFalse}</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.confidence}</span>
                            <input
                              type="number"
                              min="1"
                              max="7"
                              value={draft.confidence_score}
                              onChange={(event) => setDraft({ ...draft, confidence_score: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.trust1}</span>
                            <input
                              type="number"
                              min="1"
                              max="7"
                              value={draft.trust_t1}
                              onChange={(event) => setDraft({ ...draft, trust_t1: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.trust2}</span>
                            <input
                              type="number"
                              min="1"
                              max="7"
                              value={draft.trust_t2}
                              onChange={(event) => setDraft({ ...draft, trust_t2: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm text-slate-700">{labels.trust3}</span>
                            <input
                              type="number"
                              min="1"
                              max="7"
                              value={draft.trust_t3}
                              onChange={(event) => setDraft({ ...draft, trust_t3: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                        <label className="block space-y-2">
                          <span className="text-sm text-slate-700">{labels.diagnosis}</span>
                          <textarea
                            rows={4}
                            value={draft.diagnosis_text}
                            onChange={(event) => setDraft({ ...draft, diagnosis_text: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-sm text-slate-700">{labels.correctiveAction}</span>
                          <textarea
                            rows={4}
                            value={draft.corrective_action_text}
                            onChange={(event) => setDraft({ ...draft, corrective_action_text: event.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                      </section>
                    ) : null}

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {labels.postSection}
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["rank_1", labels.rank1],
                          ["rank_2", labels.rank2],
                          ["rank_3", labels.rank3],
                        ].map(([field, fieldLabel]) => (
                          <label key={field} className="space-y-2">
                            <span className="text-sm text-slate-700">{fieldLabel}</span>
                            <select
                              value={draft[field as keyof EditableRow]}
                              onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">—</option>
                              {["KG", "LLM", "DOC"].map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <label className="block space-y-2">
                        <span className="text-sm text-slate-700">{labels.rankJustification}</span>
                        <textarea
                          rows={4}
                          value={draft.rank_justification}
                          onChange={(event) => setDraft({ ...draft, rank_justification: event.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm text-slate-700">{labels.openComment}</span>
                        <textarea
                          rows={4}
                          value={draft.open_comment}
                          onChange={(event) => setDraft({ ...draft, open_comment: event.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                    </section>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(row)}
                        disabled={saving}
                        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {labels.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRowId(null);
                          setDraft(null);
                          setError(null);
                        }}
                        className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                      >
                        {labels.cancel}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
