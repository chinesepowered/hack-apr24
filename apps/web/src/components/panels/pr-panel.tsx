import type { RunEvent } from "@branch/shared";
import { EmptyState, MockBadge, Panel } from "./panel";

type PrEvent = Extract<RunEvent, { kind: "pr_opened" }>;

export function PrPanel({ event }: { event: PrEvent | undefined }) {
  if (!event) {
    return (
      <Panel title="Pull Request">
        <EmptyState text="PR not yet opened." />
      </Panel>
    );
  }
  const { pr } = event;
  return (
    <Panel title="Pull Request" badge={<MockBadge />}>
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] mono mb-1">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M5 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm0 4v5"
            stroke="#7ee787"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M11 3.5v5m0 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
            stroke="#7ee787"
            strokeWidth="1.2"
          />
        </svg>
        <span>#{pr.number}</span>
        <span className="text-[var(--accent)]">open</span>
      </div>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="block text-sm font-medium text-[var(--accent-blue)] hover:underline mb-2 truncate"
      >
        {pr.title}
      </a>
      <div className="text-[0.7rem] mono text-[var(--muted)] mb-2">
        <span className="text-[var(--accent)]">+{pr.additions}</span>
        {" / "}
        <span className="text-[var(--danger)]">−{pr.deletions}</span>
        {` across ${pr.filesChanged} file${pr.filesChanged === 1 ? "" : "s"}`}
      </div>
      <div className="text-[0.7rem] mono text-[var(--muted)] mb-2 truncate">
        branch: <span className="text-[var(--foreground)]">{pr.branch}</span>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
          PR body
        </summary>
        <pre className="mt-2 text-[0.7rem] mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded p-2 border border-[var(--panel-border)] max-h-64 overflow-auto scrollbar-thin">
          {pr.body}
        </pre>
      </details>
    </Panel>
  );
}
