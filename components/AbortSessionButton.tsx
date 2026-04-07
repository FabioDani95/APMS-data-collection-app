"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AbortSessionButtonProps {
  visible: boolean;
  label: string;
  confirmMessage: string;
  genericError: string;
}

export function AbortSessionButton({
  visible,
  label,
  confirmMessage,
  genericError,
}: AbortSessionButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  async function handleAbort() {
    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/sessions/current", {
      method: "DELETE",
    });

    if (!response.ok) {
      setSubmitting(false);
      setError(genericError);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbort}
        disabled={submitting}
        className="fixed bottom-5 right-5 z-50 rounded-xl border border-rose-700 bg-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-panel transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>

      {error ? (
        <div className="fixed bottom-24 right-5 z-50 w-[min(88vw,360px)] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-panel">
          {error}
        </div>
      ) : null}
    </>
  );
}
