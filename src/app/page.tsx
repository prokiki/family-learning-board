"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_BOARD = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID || "";

export default function Home() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authBoard, setAuthBoard] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [showParentLogin, setShowParentLogin] = useState(false);

  /* 检查是否已登录 */
  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.board) {
          setAuthBoard(data.board);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "验证失败");
        return;
      }
      router.push(`/parent?board=${data.board}`);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleParentEntry() {
    if (authBoard) {
      router.push(`/parent?board=${authBoard}`);
    } else {
      setShowParentLogin(true);
    }
  }

  function handleChildEntry() {
    router.push(`/child?board=${authBoard || DEFAULT_BOARD}`);
  }

  if (checking) return null;

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 md:py-14">
      <div className="mx-auto max-w-[480px]">
        <div className="mb-6 flex items-center justify-between px-2">
          <p className="text-sm font-semibold tracking-[0.14em] text-[var(--text-secondary)]">
            家庭学习看板
          </p>
          <ThemeToggle />
        </div>

        <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6 sm:p-7">
          <h1 className="text-2xl font-semibold leading-tight text-[var(--foreground)] sm:text-3xl">
            放学后，孩子一眼就知道该做什么。
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            家长把老师作业整理成清晰任务，孩子在固定设备上大字查看、点按反馈。
          </p>

          {/* 孩子看板入口 */}
          <div className="mt-7">
            <button
              type="button"
              onClick={handleChildEntry}
              className="w-full rounded-[12px] bg-[var(--primary)] px-4 py-3.5 text-base font-semibold text-white"
            >
              进入孩子看板
            </button>
          </div>

          {/* 分隔线 */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs text-[var(--text-muted)]">家长区域</span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {/* 家长入口 */}
          {showParentLogin && !authBoard ? (
            <form onSubmit={handleLogin}>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入家长密码"
                  autoFocus
                  className="min-w-0 flex-1 rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  disabled={loading || !password.trim()}
                  className="shrink-0 rounded-[12px] bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] disabled:opacity-50"
                >
                  {loading ? "验证中..." : "进入"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm font-medium text-[var(--error)]">{error}</p>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={handleParentEntry}
              className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]"
            >
              进入家长端
            </button>
          )}
        </div>

        {/* 功能亮点 */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 px-1">
          {[
            ["📋", "作业导入", "AI 智能拆分"],
            ["🔄", "实时同步", "状态即时更新"],
            ["⏱", "专注计时", "番茄钟模式"],
          ].map(([icon, title, desc]) => (
            <div
              key={title}
              className="rounded-[0.875rem] border border-[var(--line-light)] bg-transparent p-3 text-center"
            >
              <p className="text-lg opacity-75">{icon}</p>
              <p className="mt-1.5 text-xs font-semibold text-[var(--foreground)]">{title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">{desc}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
