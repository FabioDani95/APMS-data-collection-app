import { resolveText, resolveTextList } from "@/lib/config";
import { type Locale, type ScenarioCode, type ToolCode } from "@/lib/types";
import { ToolBadge } from "@/components/ToolBadge";

interface ScenarioPanelProps {
  locale: Locale;
  scenarioId: ScenarioCode;
  scenario: {
    difficulty: number;
    subsystem: unknown;
    machine_state: unknown;
    process_parameters: unknown;
    observable_symptoms: unknown[];
    error_code: string;
    error_message: unknown;
  };
  toolLabel: string;
  toolColor: "blue" | "green" | "amber";
  labels: {
    scenario: string;
    difficulty: string;
    subsystem: string;
    machineState: string;
    processParameters: string;
    observableSymptoms: string;
    errorCode: string;
    errorMessage: string;
    accordionLabel: string;
  };
}

function ScenarioContent({
  locale,
  scenarioId,
  scenario,
  toolLabel,
  toolColor,
  labels,
}: ScenarioPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
          {labels.scenario} {scenarioId}
        </span>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
          {labels.difficulty} {scenario.difficulty}/3
        </span>
        <ToolBadge color={toolColor} label={toolLabel} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.subsystem}</h2>
        <p className="text-sm text-slate-700">{resolveText(scenario.subsystem as never, locale)}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.machineState}</h2>
        <p className="text-sm text-slate-700">{resolveText(scenario.machine_state as never, locale)}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          {labels.processParameters}
        </h2>
        <p className="text-sm text-slate-700">{resolveText(scenario.process_parameters as never, locale)}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          {labels.observableSymptoms}
        </h2>
        <ul className="space-y-2 pl-5 text-sm text-slate-700">
          {resolveTextList(scenario.observable_symptoms as never, locale).map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.errorCode}</h2>
        <code className="inline-block rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">{scenario.error_code}</code>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{labels.errorMessage}</h2>
        <p className="text-sm text-slate-700">{resolveText(scenario.error_message as never, locale)}</p>
      </section>
    </div>
  );
}

export function ScenarioPanel(props: ScenarioPanelProps) {
  return (
    <>
      <div className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-panel lg:block">
        <ScenarioContent {...props} />
      </div>

      <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel lg:hidden" open>
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900">
          {props.labels.accordionLabel}
        </summary>
        <div className="border-t border-slate-200 px-5 py-5">
          <ScenarioContent {...props} />
        </div>
      </details>
    </>
  );
}
