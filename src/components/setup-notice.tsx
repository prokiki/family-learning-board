export function SetupNotice() {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[rgba(234,140,0,0.2)] bg-[var(--warning-subtle)] p-5 text-[rgba(122,76,8,1)] md:p-6">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--warning)]">
        环境配置
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">还没连接 Supabase</p>
      <p className="mt-2 text-sm leading-6 text-[rgba(122,76,8,0.92)] md:text-base">
        请先在 <code className="rounded bg-white/80 px-1.5 py-0.5">.env.local</code> 中填写{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> 和{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        ，再执行 SQL 初始化表结构。
      </p>
    </div>
  );
}
