import type { Phase } from "@branch/shared";
import type { PhaseStatus } from "../run-helpers";

interface PhaseItem {
  id: Phase;
  label: string;
  status: PhaseStatus;
}

export function PhaseTimeline({ phases }: { phases: PhaseItem[] }) {
  return (
    <div className="panel">
      <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
        {phases.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 shrink-0">
            <PhaseChip phase={p} />
            {i < phases.length - 1 ? (
              <div
                className={
                  "w-10 h-px " +
                  (p.status === "done"
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--panel-border)]")
                }
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseChip({ phase }: { phase: PhaseItem }) {
  const color =
    phase.status === "done"
      ? "var(--accent)"
      : phase.status === "active"
        ? "var(--accent-blue)"
        : "var(--muted)";
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--panel-border)]">
      <span
        className={phase.status === "active" ? "pulse-dot" : ""}
        style={{ color, fontSize: "0.8rem" }}
      >
        {phase.status === "done" ? "✓" : "●"}
      </span>
      <span
        className={
          "text-xs font-medium " +
          (phase.status === "pending" ? "text-[var(--muted)]" : "text-[var(--foreground)]")
        }
      >
        {phase.label}
      </span>
    </div>
  );
}
