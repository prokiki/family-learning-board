import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

function FeatureIcon({ type }: { type: "file" | "sync" | "blocks" }) {
  const common = "h-6 w-6 text-[var(--primary)]";

  if (type === "file") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    );
  }

  if (type === "sync") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
        <path d="M3 12a9 9 0 0 1 15.3-6.3L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.3 6.3L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M17.5 14v7" />
      <path d="M14 17.5h7" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 md:py-14">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-4 flex items-center justify-between px-2">
          <p className="text-sm font-semibold tracking-[0.14em] text-[var(--text-secondary)]">
            家庭学习看板
          </p>
          <ThemeToggle />
        </div>

        <section className="soft-shadow rounded-[2rem] border border-[var(--line)] bg-card p-4 sm:p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-4 md:gap-5">
            <div className="rounded-[1.6rem] border border-[var(--line)] bg-card px-6 py-7 md:col-span-2 md:row-span-2 md:min-h-[428px] md:px-8 md:py-8">
              <div className="space-y-4">
                <h1 className="max-w-[14ch] text-[2rem] font-semibold leading-[1.15] text-[var(--foreground)] sm:max-w-[12ch] sm:text-[2.5rem] md:text-[2.7rem]">
                  放学后，孩子一眼就知道该做什么。
                </h1>
                <p className="max-w-[30rem] text-base leading-8 text-[var(--text-secondary)] md:text-lg">
                  家长把老师作业整理成清晰任务，孩子在固定设备上大字查看、点按反馈，家长端实时看到完成情况。
                </p>
              </div>
            </div>

            <Link
              href="/parent"
              className="interactive-card soft-shadow group flex min-h-[204px] flex-col rounded-[1.45rem] border border-[var(--line)] bg-card px-6 py-6 md:col-span-2 md:px-7"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <h2 className="mt-3 text-[1.8rem] font-semibold leading-tight text-[var(--foreground)]">
                    家长端
                  </h2>
                  <p className="mt-3 max-w-[18rem] text-base leading-8 text-[var(--text-secondary)]">
                    创建今日任务、导入老师作业、实时查看孩子反馈。
                  </p>
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <p className="rounded-full bg-[var(--primary-light)] px-3 py-1.5 text-sm font-semibold text-[var(--primary)]">
                    今天任务一目了然
                  </p>
                  <span className="text-2xl font-semibold text-[var(--primary)]">→</span>
                </div>
              </div>
            </Link>
            <Link
              href="/child"
              className="interactive-card soft-shadow group flex min-h-[204px] flex-col rounded-[1.45rem] border border-[var(--line)] bg-card px-6 py-6 md:col-span-2 md:px-7"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <h2 className="mt-3 text-[1.8rem] font-semibold leading-tight text-[var(--foreground)]">
                    孩子看板
                  </h2>
                  <p className="mt-3 max-w-[18rem] text-base leading-8 text-[var(--text-secondary)]">
                    大按钮、大字、少导航，专注今天的任务和下一步。
                  </p>
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <p className="rounded-full bg-[var(--warning-subtle)] px-3 py-1.5 text-sm font-semibold text-[var(--warning)]">
                    今天做什么很清楚
                  </p>
                  <span className="text-2xl font-semibold text-[var(--warning)]">→</span>
                </div>
              </div>
            </Link>

            <div className="grid gap-4 md:col-span-4 md:grid-cols-4 md:gap-5">
              {[
                ["file", "老师作业导入", "支持把钉钉群里复制出的文字直接拆成任务。"],
                ["sync", "实时状态同步", "孩子点击“已完成”或“需要帮助”后，家长端立即刷新。"],
                ["blocks", "易扩展架构", "为后续 OCR、拍照上传、奖励系统预留清晰结构。"],
              ].map(([icon, title, desc], index) => (
                <div
                  key={title}
                  className={`rounded-[1.35rem] border border-[var(--line)] bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.025)] md:p-7 ${
                    index === 1 ? "md:col-span-2" : "md:col-span-1"
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[var(--primary-light)]">
                    <FeatureIcon type={icon as "file" | "sync" | "blocks"} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--foreground)]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
