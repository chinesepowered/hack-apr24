import type { RunEvent } from "@branch/shared";
import { EmptyState, Panel } from "./panel";

type PlanEvent = Extract<RunEvent, { kind: "plan_generated" }>;

export function PlanPanel({ event }: { event: PlanEvent | undefined }) {
  if (!event) {
    return (
      <Panel title="Plan">
        <EmptyState text="Waiting for planner agent…" />
      </Panel>
    );
  }
  const { plan } = event;
  return (
    <Panel title="Plan" badge={<span className="text-[0.65rem] mono text-[var(--muted)]">GLM 5.1</span>}>
      <div className="text-sm mb-3 leading-relaxed">{plan.summary}</div>

      {plan.affectedSubgraphs.length > 0 ? (
        <div className="flex gap-1.5 mb-3">
          {plan.affectedSubgraphs.map((sg) => (
            <span
              key={sg}
              className="text-[0.65rem] mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--panel-border)] text-[var(--accent-blue)]"
            >
              {sg}
            </span>
          ))}
        </div>
      ) : null}

      <ol className="space-y-2">
        {plan.steps.map((step, i) => (
          <li key={i} className="flex gap-3 slide-in">
            <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--panel-border)] text-[var(--muted)] flex items-center justify-center text-[0.65rem] mono mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[0.6rem] mono uppercase tracking-wider text-[var(--accent-amber)]">
                  {step.kind}
                </span>
                <span className="text-sm">{step.summary}</span>
              </div>
              {step.files.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {step.files.map((f) => (
                    <div key={f} className="text-[0.7rem] mono text-[var(--muted)] truncate">
                      {f}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
