interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="soft-shadow rounded-[1.6rem] border border-[var(--line)] bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--card-alt)] text-2xl">
        ✦
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
