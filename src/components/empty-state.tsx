interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-6 text-center shadow-[var(--shadow-sm)] md:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--line-light)] bg-[var(--card-alt)] text-xl text-[var(--primary)]">
        ✦
      </div>
      <h3 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-[26rem] text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}

/** Skeleton placeholder shown while data is loading. */
export function TaskListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skeleton-pulse rounded-[1rem] border border-[var(--line)] bg-card p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 rounded-[8px] bg-[var(--card-alt)]" />
            <div className="h-4 flex-1 rounded-[8px] bg-[var(--card-alt)]" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-8 w-20 rounded-[12px] bg-[var(--card-alt)]" />
            <div className="h-8 w-20 rounded-[12px] bg-[var(--card-alt)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single-card skeleton for report / summary views. */
export function CardSkeleton() {
  return (
    <div className="skeleton-pulse rounded-[1.5rem] border border-[var(--line)] bg-card p-6 shadow-[var(--shadow-sm)] md:p-8">
      <div className="mx-auto max-w-sm space-y-3">
        <div className="mx-auto h-5 w-32 rounded-[8px] bg-[var(--card-alt)]" />
        <div className="mx-auto h-4 w-48 rounded-[8px] bg-[var(--card-alt)]" />
        <div className="mx-auto h-4 w-40 rounded-[8px] bg-[var(--card-alt)]" />
      </div>
    </div>
  );
}
