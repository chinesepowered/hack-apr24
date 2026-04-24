"use client";

import { useState } from "react";
import type { RunEvent } from "@branch/shared";
import { EmptyState, MockBadge, Panel } from "./panel";
import { formatBytes, formatNumber } from "../run-helpers";

type ForkEvent = Extract<RunEvent, { kind: "fork_ready" }>;

export function ForkPanel({ event }: { event: ForkEvent | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!event) {
    return (
      <Panel title="Ghost fork">
        <EmptyState text="No fork yet. Ghost will copy-on-write from branch-prod." />
      </Panel>
    );
  }
  const { fork } = event;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fork.connectionString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };
  return (
    <Panel title="Ghost fork" badge={<MockBadge />}>
      <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
        <Stat label="fork" value={fork.name} />
        {fork.sizeBytes ? <Stat label="size" value={formatBytes(fork.sizeBytes)} /> : null}
        {fork.rowsCopied ? <Stat label="rows" value={formatNumber(fork.rowsCopied)} /> : null}
      </div>
      <div className="mb-1 text-[0.65rem] mono uppercase tracking-wider text-[var(--muted)]">
        read-write URL
      </div>
      <div className="flex items-center gap-2 bg-black/30 rounded px-3 py-2 border border-[var(--panel-border)]">
        <code className="flex-1 text-xs mono text-[var(--accent)] truncate">
          {fork.connectionString}
        </code>
        <button
          type="button"
          onClick={copy}
          className="text-[0.65rem] mono uppercase tracking-wider px-2 py-1 rounded bg-[var(--panel-border)] hover:bg-[var(--accent-blue)] hover:text-black transition"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {fork.readOnlyConnectionString ? (
        <>
          <div className="mt-3 mb-1 text-[0.65rem] mono uppercase tracking-wider text-[var(--muted)]">
            read-only URL
          </div>
          <code className="block text-xs mono text-[var(--muted)] truncate bg-black/30 rounded px-3 py-2 border border-[var(--panel-border)]">
            {fork.readOnlyConnectionString}
          </code>
        </>
      ) : null}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] mono uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-sm mono mt-0.5">{value}</div>
    </div>
  );
}
