import type { Issue } from "@branch/shared";
import { Panel } from "./panel";

export function IssuePanel({ issue }: { issue: Issue }) {
  return (
    <Panel title="GitHub Issue">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#7ee787" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="1.5" fill="#7ee787" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mono">
            <span>{issue.repo}</span>
            <span>#{issue.number}</span>
            <span>· opened by @{issue.author}</span>
          </div>
          <h2 className="text-base font-semibold mt-1 mb-2">{issue.title}</h2>
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap mono leading-relaxed">
            {issue.body}
          </pre>
        </div>
      </div>
    </Panel>
  );
}
