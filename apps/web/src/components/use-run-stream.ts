"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent } from "@branch/shared";

export interface RunState {
  runId: string | null;
  events: RunEvent[];
  status: "idle" | "connecting" | "streaming" | "done" | "error";
  error?: string;
}

const initial: RunState = { runId: null, events: [], status: "idle" };

export function useRunStream() {
  const [state, setState] = useState<RunState>(initial);
  const esRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const start = useCallback(async (speed = 1) => {
    stop();
    setState({ runId: null, events: [], status: "connecting" });
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed }),
    });
    if (!res.ok) {
      setState({ runId: null, events: [], status: "error", error: `HTTP ${res.status}` });
      return;
    }
    const { runId } = (await res.json()) as { runId: string };
    const es = new EventSource(`/api/runs/${runId}/events`);
    esRef.current = es;
    setState({ runId, events: [], status: "streaming" });
    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as RunEvent;
        setState((s) => ({ ...s, events: [...s.events, event] }));
        if (event.kind === "run_completed") {
          es.close();
          setState((s) => ({ ...s, status: "done" }));
        }
      } catch {
        // Ignore parse errors
      }
    };
    es.onerror = () => {
      setState((s) => (s.status === "done" ? s : { ...s, status: "error", error: "stream error" }));
    };
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop };
}
