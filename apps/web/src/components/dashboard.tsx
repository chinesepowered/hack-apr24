"use client";

import type { Issue } from "@branch/shared";
import { useRunStream } from "./use-run-stream";
import { PHASES, phaseStatus, findEvent } from "./run-helpers";
import { PhaseTimeline } from "./panels/phase-timeline";
import { IssuePanel } from "./panels/issue-panel";
import { PlanPanel } from "./panels/plan-panel";
import { ForkPanel } from "./panels/fork-panel";
import { MigrationPanel } from "./panels/migration-panel";
import { VerifyPanel } from "./panels/verify-panel";
import { PrPanel } from "./panels/pr-panel";
import { ImagePanel } from "./panels/image-panel";
import { LogStream } from "./panels/log-stream";

export function Dashboard({ initialIssue }: { initialIssue: Issue }) {
  const run = useRunStream();

  const phases = PHASES.map((p) => ({ ...p, status: phaseStatus(run.events, p.id) }));
  const plan = findEvent(run.events, "plan_generated");
  const fork = findEvent(run.events, "fork_ready");
  const migration = findEvent(run.events, "migration_applied");
  const verify = findEvent(run.events, "verification_result");
  const pr = findEvent(run.events, "pr_opened");
  const image = findEvent(run.events, "image_built");
  const completed = findEvent(run.events, "run_completed");

  const isRunning = run.status === "streaming" || run.status === "connecting";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--panel-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-[var(--accent)] text-black font-bold flex items-center justify-center mono">
            B
          </div>
          <div>
            <div className="font-semibold tracking-tight">Branch</div>
            <div className="text-xs text-[var(--muted)]">
              autonomous feature-dev agent · demo mode
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} runId={run.runId} />
          <button
            type="button"
            onClick={() => run.start(1)}
            disabled={isRunning}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-black font-medium text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isRunning ? "Running…" : run.status === "done" ? "Run again" : "Run demo"}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4">
        <section className="col-span-12">
          <PhaseTimeline phases={phases} />
        </section>

        <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <IssuePanel issue={initialIssue} />
          <PlanPanel event={plan} />
        </section>

        <section className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <ForkPanel event={fork} />
          <MigrationPanel event={migration} />
          <VerifyPanel event={verify} />
        </section>

        <section className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <PrPanel event={pr} />
          <ImagePanel event={image} />
          <LogStream events={run.events} />
        </section>
      </main>

      {completed ? (
        <footer className="border-t border-[var(--panel-border)] px-6 py-3 text-sm text-[var(--muted)] flex items-center gap-3">
          <span className="text-[var(--accent)]">●</span>
          <span className="text-[var(--foreground)]">Run complete.</span>
          <span>{completed.summary}</span>
        </footer>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, runId }: { status: string; runId: string | null }) {
  const color =
    status === "streaming"
      ? "var(--accent-blue)"
      : status === "done"
        ? "var(--accent)"
        : status === "error"
          ? "var(--danger)"
          : "var(--muted)";
  const label =
    status === "idle"
      ? "idle"
      : status === "connecting"
        ? "connecting"
        : status === "streaming"
          ? "streaming"
          : status === "done"
            ? "done"
            : "error";
  return (
    <div className="flex items-center gap-2 text-xs mono">
      <span
        className={status === "streaming" ? "pulse-dot" : ""}
        style={{ color, fontSize: "0.75rem" }}
      >
        ●
      </span>
      <span className="text-[var(--muted)]">{label}</span>
      {runId ? <span className="text-[var(--muted)]">· {runId}</span> : null}
    </div>
  );
}
