export function SetupNotice() {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-[var(--warning-subtle)] p-5 text-[var(--warning)] md:p-6">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--warning)]">
        环境配置
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">还没连接 Supabase</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
        请先在 <code className="rounded bg-[var(--card-alt)] px-1.5 py-0.5 text-[var(--foreground)]">.env.local</code> 中填写{" "}
        <code className="rounded bg-[var(--card-alt)] px-1.5 py-0.5 text-[var(--foreground)]">NEXT_PUBLIC_SUPABASE_URL</code> 和{" "}
        <code className="rounded bg-[var(--card-alt)] px-1.5 py-0.5 text-[var(--foreground)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        ，再执行 SQL 初始化表结构。
      </p>
    </div>
  );
}
