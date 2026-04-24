import type { ReactNode } from "react";

export function Panel({
  title,
  badge,
  children,
  scroll = false,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="panel flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-[var(--panel-border)] flex items-center justify-between shrink-0">
        <div className="text-[0.7rem] tracking-wider uppercase text-[var(--muted)] font-medium">
          {title}
        </div>
        {badge}
      </div>
      <div className={`p-4 ${scroll ? "overflow-auto scrollbar-thin" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-sm text-[var(--muted)] italic py-6 text-center">
      {text}
    </div>
  );
}

export function MockBadge() {
  return (
    <span className="text-[0.65rem] mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-[var(--accent-amber)] text-[var(--accent-amber)]">
      mock
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="text-[0.65rem] mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-[var(--accent)] text-[var(--accent)]">
      live
    </span>
  );
}
