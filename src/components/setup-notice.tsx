export function SetupNotice() {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[rgba(245,166,35,0.24)] bg-[rgba(255,247,229,0.98)] p-5 text-[rgba(122,76,8,1)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-[rgba(201,107,8,1)]">
        SETUP
      </p>
      <p className="mt-2 text-lg font-semibold">还没连接 Supabase</p>
      <p className="mt-2 text-sm leading-6 text-[rgba(122,76,8,0.92)]">
        请先在 `.env.local` 中填写 `NEXT_PUBLIC_SUPABASE_URL` 和
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`，再执行 SQL 初始化表结构。
      </p>
    </div>
  );
}
