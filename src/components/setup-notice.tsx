export function SetupNotice() {
  return (
    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <p className="text-base font-semibold">还没连接 Supabase</p>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        请先在 `.env.local` 中填写 `NEXT_PUBLIC_SUPABASE_URL` 和
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`，再执行 SQL 初始化表结构。
      </p>
    </div>
  );
}
