import type { RunEvent } from "@branch/shared";
import { EmptyState, MockBadge, Panel } from "./panel";
import { formatBytes } from "../run-helpers";

type ImageEvent = Extract<RunEvent, { kind: "image_built" }>;

export function ImagePanel({ event }: { event: ImageEvent | undefined }) {
  if (!event) {
    return (
      <Panel title="Preview image">
        <EmptyState text="apko build pending." />
      </Panel>
    );
  }
  const { image } = event;
  const vulnRatio = image.cve.vanilla === 0 ? 0 : image.cve.chainguard / image.cve.vanilla;
  return (
    <Panel title="Preview image" badge={<MockBadge />}>
      <div className="text-xs mono text-[var(--accent-blue)] truncate mb-1">{image.ref}</div>
      <div className="text-[0.7rem] mono text-[var(--muted)] truncate mb-3">{image.digest}</div>

      <div className="text-[0.65rem] mono uppercase tracking-wider text-[var(--muted)] mb-1">
        CVE delta vs node:20
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl font-semibold mono" style={{ color: "var(--danger)" }}>
          {image.cve.vanilla}
        </div>
        <div className="text-[var(--muted)] mono">→</div>
        <div className="text-2xl font-semibold mono" style={{ color: "var(--accent)" }}>
          {image.cve.chainguard}
        </div>
        <div
          className="ml-auto text-xs mono px-2 py-0.5 rounded"
          style={{
            background: "rgba(126, 231, 135, 0.12)",
            color: "var(--accent)",
          }}
        >
          {image.cve.delta > 0 ? "+" : ""}
          {image.cve.delta}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--panel-border)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${(1 - vulnRatio) * 100}%` }}
        />
      </div>

      <div className="mt-3 text-[0.7rem] mono text-[var(--muted)]">
        size: <span className="text-[var(--foreground)]">{formatBytes(image.sizeBytes)}</span>
      </div>
    </Panel>
  );
}
