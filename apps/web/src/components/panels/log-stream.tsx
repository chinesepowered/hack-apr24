"use client";

import { useEffect, useRef } from "react";
import type { RunEvent } from "@branch/shared";
import { Panel } from "./panel";

export function LogStream({ events }: { events: RunEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const logs = events.filter(
    (e): e is Extract<RunEvent, { kind: "log" }> => e.kind === "log",
  );

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  return (
    <Panel title="Trace">
      <div
        ref={ref}
        className="h-48 overflow-y-auto scrollbar-thin bg-black/30 rounded p-2 border border-[var(--panel-border)]"
      >
        {logs.length === 0 ? (
          <div className="text-xs italic text-[var(--muted)]">waiting…</div>
        ) : (
          <ul className="space-y-1">
            {logs.map((log, i) => (
              <li key={i} className="text-[0.7rem] mono slide-in">
                <span className="text-[var(--muted)]">
                  {new Date(log.ts).toISOString().slice(11, 19)}
                </span>{" "}
                <span className="text-[var(--accent-amber)]">[{log.phase}]</span>{" "}
                <span
                  style={{
                    color: log.level === "error" ? "var(--danger)" : "var(--foreground)",
                  }}
                >
                  {log.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
