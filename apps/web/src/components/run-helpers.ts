import type { Phase, RunEvent } from "@branch/shared";

export const PHASES: { id: Phase; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "fork", label: "Fork DB" },
  { id: "migrate", label: "Migrate" },
  { id: "verify", label: "Verify" },
  { id: "pr", label: "Open PR" },
  { id: "image", label: "Build image" },
];

export type PhaseStatus = "pending" | "active" | "done";

export function phaseStatus(events: RunEvent[], phase: Phase): PhaseStatus {
  let started = false;
  let completed = false;
  for (const e of events) {
    if (e.kind === "phase_started" && e.phase === phase) started = true;
    if (e.kind === "phase_completed" && e.phase === phase) completed = true;
  }
  if (completed) return "done";
  if (started) return "active";
  return "pending";
}

export function logsFor(events: RunEvent[], phase: Phase): Extract<RunEvent, { kind: "log" }>[] {
  const out: Extract<RunEvent, { kind: "log" }>[] = [];
  for (const e of events) if (e.kind === "log" && e.phase === phase) out.push(e);
  return out;
}

export function findEvent<K extends RunEvent["kind"]>(
  events: RunEvent[],
  kind: K,
): Extract<RunEvent, { kind: K }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]?.kind === kind) return events[i] as Extract<RunEvent, { kind: K }>;
  }
  return undefined;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
