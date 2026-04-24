import type { RunEvent } from "@branch/shared";
import { EmptyState, Panel } from "./panel";

type VerifyEvent = Extract<RunEvent, { kind: "verification_result" }>;

export function VerifyPanel({ event }: { event: VerifyEvent | undefined }) {
  if (!event) {
    return (
      <Panel title="Federated verification">
        <EmptyState text="Waiting for Cosmo MCP tool call…" />
      </Panel>
    );
  }
  return (
    <Panel
      title="Federated verification"
      badge={
        <span
          className="text-[0.65rem] mono uppercase tracking-wider"
          style={{ color: event.ok ? "var(--accent)" : "var(--danger)" }}
        >
          {event.ok ? "passed" : "failed"}
        </span>
      }
    >
      <div className="mb-2 text-[0.65rem] mono uppercase tracking-wider text-[var(--muted)]">
        query
      </div>
      <pre className="text-xs mono bg-black/30 rounded p-3 border border-[var(--panel-border)] mb-3 leading-relaxed overflow-x-auto scrollbar-thin">
        {event.query}
      </pre>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[0.65rem] mono uppercase tracking-wider text-[var(--danger)]">
            before
          </div>
          <pre className="text-[0.7rem] mono bg-black/30 rounded p-2 border border-[var(--panel-border)] overflow-auto scrollbar-thin max-h-40 leading-snug">
            {JSON.stringify(event.before, null, 2)}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-[0.65rem] mono uppercase tracking-wider text-[var(--accent)]">
            after
          </div>
          <pre className="text-[0.7rem] mono bg-black/30 rounded p-2 border border-[var(--panel-border)] overflow-auto scrollbar-thin max-h-40 leading-snug">
            {JSON.stringify(event.after, null, 2)}
          </pre>
        </div>
      </div>
    </Panel>
  );
}
