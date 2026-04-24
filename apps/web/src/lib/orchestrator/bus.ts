import type { RunEvent } from '@branch/shared'

type Listener = (event: RunEvent) => void

// Keyed by runId. Events are kept in memory so late subscribers can replay.
const subscribers = new Map<string, Set<Listener>>()
const history = new Map<string, RunEvent[]>()
const terminals = new Set<string>()

export function publish(event: RunEvent): void {
  const list = history.get(event.runId) ?? []
  list.push(event)
  history.set(event.runId, list)
  if (event.kind === 'run_completed') terminals.add(event.runId)
  for (const fn of subscribers.get(event.runId) ?? []) {
    try {
      fn(event)
    } catch {
      // Ignore listener errors — stream disconnects handle themselves
    }
  }
}

export function subscribe(runId: string, fn: Listener): () => void {
  let set = subscribers.get(runId)
  if (!set) {
    set = new Set()
    subscribers.set(runId, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set && set.size === 0) subscribers.delete(runId)
  }
}

export function replay(runId: string): RunEvent[] {
  return history.get(runId) ?? []
}

export function isTerminal(runId: string): boolean {
  return terminals.has(runId)
}

export function listRuns(): string[] {
  return [...history.keys()]
}
