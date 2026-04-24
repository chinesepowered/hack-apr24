import type { RunEvent } from "@branch/shared";
import { EmptyState, Panel } from "./panel";

type MigrationEvent = Extract<RunEvent, { kind: "migration_applied" }>;

export function MigrationPanel({ event }: { event: MigrationEvent | undefined }) {
  if (!event) {
    return (
      <Panel title="Migration">
        <EmptyState text="Drizzle migration not yet generated." />
      </Panel>
    );
  }
  return (
    <Panel
      title="Migration"
      badge={
        <span className="text-[0.65rem] mono text-[var(--muted)]">
          {event.statementCount} statement{event.statementCount === 1 ? "" : "s"} · applied
        </span>
      }
    >
      <pre className="text-xs mono text-[var(--foreground)] bg-black/30 rounded p-3 border border-[var(--panel-border)] overflow-x-auto scrollbar-thin leading-relaxed">
        {highlightSql(event.sql)}
      </pre>
    </Panel>
  );
}

function highlightSql(sql: string) {
  // Simple keyword coloring without a syntax lib
  const keywords = /\b(ALTER|ADD|COLUMN|TABLE|CONSTRAINT|CHECK|CREATE|INDEX|IF|NOT|EXISTS|ON|WHERE|IS|NULL|OR|VARCHAR|INTEGER|TEXT|UUID)\b/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = keywords.exec(sql)) !== null) {
    if (match.index > last) parts.push(sql.slice(last, match.index));
    parts.push(
      <span key={`k-${match.index}`} style={{ color: "var(--accent-blue)" }}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < sql.length) parts.push(sql.slice(last));
  return parts;
}
