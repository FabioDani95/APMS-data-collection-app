"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Countdown } from "@/components/Countdown";
import { LikertScale } from "@/components/LikertScale";

type SaveIntent = "autosave" | "timeout-draft" | "timeout-continue" | "complete";

interface TaskClientProps {
  taskId: number;
  toolColor: "blue" | "green" | "amber";
  initialRemainingSeconds: number;
  initialValues: {
    diagnosis_text: string | null;
    corrective_action_text: string | null;
    confidence_score: number | null;
    trust_t1: number | null;
    trust_t2: number | null;
    trust_t3: number | null;
    timed_out: boolean;
    end_time: string | null;
  };
  trustQuestions: string[];
  labels: {
    diagnosis: string;
    action: string;
    confidence: string;
    trustBlock: string;
    submit: string;
    autosaving: string;
    autosaved: string;
    saving: string;
    requiredLikert: string;
    timeoutTitle: string;
    timeoutBody: string;
    continue: string;
    unloadMessage: string;
    saveError: string;
    scaleLow: string;
    scaleHigh: string;
  };
}

export function TaskClient({
  taskId,
  toolColor,
  initialRemainingSeconds,
  initialValues,
  trustQuestions,
  labels,
}: TaskClientProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    diagnosis_text: initialValues.diagnosis_text ?? "",
    corrective_action_text: initialValues.corrective_action_text ?? "",
    confidence_score: initialValues.confidence_score,
    trust_t1: initialValues.trust_t1,
    trust_t2: initialValues.trust_t2,
    trust_t3: initialValues.trust_t3,
  });
  const [secondsRemaining, setSecondsRemaining] = useState(initialRemainingSeconds);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(initialValues.timed_out);
  const [continueVisible, setContinueVisible] = useState(initialValues.timed_out);
  const timeoutPersistedRef = useRef(initialValues.timed_out || Boolean(initialValues.end_time));
  const lastAutosavedPayload = useRef<string>("");

  const persist = useCallback(
    async (intent: SaveIntent) => {
      const payload = {
        ...form,
        intent,
        timed_out: intent === "timeout-draft" || intent === "timeout-continue" ? true : undefined,
      };

      if (intent === "autosave") {
        setAutosaveState("saving");
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (intent === "autosave") {
          setAutosaveState("error");
        } else {
          setError(labels.saveError);
        }
        return null;
      }

      const result = (await response.json()) as { nextPath?: string };

      if (intent === "autosave") {
        setAutosaveState("saved");
        lastAutosavedPayload.current = JSON.stringify(form);
      }

      return result;
    },
    [form, labels.saveError, taskId],
  );

  useEffect(() => {
    if (timedOut || submitting) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitting, timedOut]);

  useEffect(() => {
    if (timedOut || submitting) {
      return;
    }

    const autosaveTimer = window.setInterval(async () => {
      const snapshot = JSON.stringify(form);
      if (snapshot === lastAutosavedPayload.current) {
        return;
      }

      await persist("autosave");
    }, 30000);

    return () => window.clearInterval(autosaveTimer);
  }, [form, persist, submitting, timedOut]);

  useEffect(() => {
    if (timedOut || timeoutPersistedRef.current || secondsRemaining > 0) {
      return;
    }

    timeoutPersistedRef.current = true;
    setTimedOut(true);

    void (async () => {
      await persist("timeout-draft");
      window.setTimeout(() => setContinueVisible(true), 5000);
    })();
  }, [persist, secondsRemaining, timedOut]);

  useEffect(() => {
    if (timedOut) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = labels.unloadMessage;
      return labels.unloadMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [labels.unloadMessage, timedOut]);

  async function handleSubmit() {
    setValidationAttempted(true);
    setError(null);

    if (!form.confidence_score || !form.trust_t1 || !form.trust_t2 || !form.trust_t3) {
      return;
    }

    setSubmitting(true);
    const result = await persist("complete");

    if (!result?.nextPath) {
      setSubmitting(false);
      return;
    }

    router.replace(result.nextPath);
    router.refresh();
  }

  async function handleTimeoutContinue() {
    setSubmitting(true);
    const result = await persist("timeout-continue");

    if (!result?.nextPath) {
      setSubmitting(false);
      return;
    }

    router.replace(result.nextPath);
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <div className="sticky top-4 z-10 space-y-3 bg-white pb-3">
        <Countdown secondsRemaining={secondsRemaining} />
        <div className="text-xs text-slate-500">
          {autosaveState === "saving" ? labels.autosaving : null}
          {autosaveState === "saved" ? labels.autosaved : null}
          {submitting ? labels.saving : null}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.diagnosis}</span>
        <textarea
          rows={6}
          disabled={timedOut || submitting}
          value={form.diagnosis_text}
          onChange={(event) => setForm((current) => ({ ...current, diagnosis_text: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.action}</span>
        <textarea
          rows={6}
          disabled={timedOut || submitting}
          value={form.corrective_action_text}
          onChange={(event) => setForm((current) => ({ ...current, corrective_action_text: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
        />
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">{labels.confidence}</span>
        <LikertScale
          value={form.confidence_score}
          onChange={(value) => setForm((current) => ({ ...current, confidence_score: value }))}
          color={toolColor}
          invalid={validationAttempted && !form.confidence_score}
          disabled={timedOut || submitting}
          lowLabel={labels.scaleLow}
          highLabel={labels.scaleHigh}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.trustBlock}</h2>
        {trustQuestions.map((question, index) => {
          const key = `trust_t${index + 1}` as "trust_t1" | "trust_t2" | "trust_t3";

          return (
            <div key={question} className="space-y-2">
              <p className="text-sm text-slate-700">{question}</p>
              <LikertScale
                value={form[key]}
                onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
                color={toolColor}
                invalid={validationAttempted && !form[key]}
                disabled={timedOut || submitting}
                lowLabel={labels.scaleLow}
                highLabel={labels.scaleHigh}
              />
            </div>
          );
        })}
      </section>

      {validationAttempted &&
      (!form.confidence_score || !form.trust_t1 || !form.trust_t2 || !form.trust_t3) ? (
        <p className="text-sm font-medium text-rose-700">{labels.requiredLikert}</p>
      ) : null}
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || timedOut}
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {labels.submit}
      </button>

      {timedOut ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-panel">
            <h2 className="text-xl font-semibold text-slate-950">{labels.timeoutTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{labels.timeoutBody}</p>
            {continueVisible ? (
              <button
                type="button"
                onClick={handleTimeoutContinue}
                disabled={submitting}
                className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {labels.continue}
              </button>
            ) : (
              <div className="mt-6 text-sm font-medium text-slate-500">{labels.saving}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
