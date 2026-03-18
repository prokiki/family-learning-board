interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="soft-shadow rounded-[1.6rem] border border-[var(--line)] bg-white p-7 text-center md:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line-light)] bg-[var(--card-alt)] text-[1.7rem] text-[var(--primary)]">
        ✦
      </div>
      <h3 className="mt-5 text-[1.75rem] font-semibold text-[var(--foreground)] md:text-2xl">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-[28rem] text-base leading-7 text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}
