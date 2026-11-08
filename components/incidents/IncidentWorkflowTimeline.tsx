import { Check, ClipboardList, UserCheck, Wrench, CheckCircle2 } from "lucide-react";
import { IncidentStatus, incidentStatusLabel } from "@/types/enums";

const steps = [
  { status: IncidentStatus.REPORTED, icon: ClipboardList },
  { status: IncidentStatus.ASSIGNED, icon: UserCheck },
  { status: IncidentStatus.IN_PROGRESS, icon: Wrench },
  { status: IncidentStatus.RESOLVED, icon: CheckCircle2 },
] as const;

export function IncidentWorkflowTimeline({ status }: { status: IncidentStatus }) {
  const currentIndex = steps.findIndex((step) => step.status === status);

  return (
    <ol
      aria-label="Progression de la réclamation"
      className="grid grid-cols-4 gap-2"
    >
      {steps.map(({ status: stepStatus, icon: Icon }, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;

        return (
          <li key={stepStatus} className="relative min-w-0 text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-5 h-0.5 w-full ${
                  index <= currentIndex ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <span
              className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border ${
                current
                  ? "border-sky-500 bg-sky-600 text-white ring-4 ring-sky-500/15"
                  : complete
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span
              className={`mt-2 block text-[11px] font-semibold sm:text-xs ${
                current
                  ? "text-sky-700 dark:text-sky-300"
                  : complete
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {incidentStatusLabel[stepStatus]}
            </span>
            <span className="sr-only">
              {current ? "Étape en cours" : complete ? "Étape terminée" : "Étape à venir"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
