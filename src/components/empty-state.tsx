interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="card-surface soft-shadow rounded-[1.75rem] p-8 text-center">
      <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}
