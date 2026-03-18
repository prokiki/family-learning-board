import Link from "next/link";

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
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <section className="soft-shadow rounded-[1.75rem] border border-[var(--line)] bg-card px-8 py-8 md:px-12 md:py-10">
          <div className="max-w-3xl space-y-5">
            <p className="inline-flex rounded-full bg-[var(--primary-light)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">
              家庭学习看板 MVP
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.3] text-[var(--foreground)] md:text-[2rem]">
              放学后，孩子一眼就知道今天先做什么。
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
              家长把老师作业整理成清晰任务，孩子在固定设备上大字查看、点按反馈，家长端实时看到完成情况。
            </p>
          </div>
          <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2">
            <Link
              href="/parent"
              className="interactive-card soft-shadow group rounded-[1.25rem] border border-[var(--line)] bg-card px-7 py-7"
            >
              <div className="mb-5 h-10 w-1 rounded-full bg-[var(--primary)]" />
              <p className="section-kicker">PARENT</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">家长端</h2>
              <p className="mt-3 text-base leading-8 text-[var(--text-secondary)]">
                创建今日任务、导入老师作业、实时查看孩子反馈。
              </p>
            </Link>
            <Link
              href="/child"
              className="interactive-card soft-shadow group rounded-[1.25rem] border border-[var(--line)] bg-card px-7 py-7"
            >
              <div className="mb-5 h-10 w-1 rounded-full bg-[var(--warning)]" />
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--warning)]">CHILD</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">孩子看板</h2>
              <p className="mt-3 text-base leading-8 text-[var(--text-secondary)]">
                大按钮、大字、少导航，专注今天的任务和下一步。
              </p>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["file", "老师作业导入", "支持把钉钉群里复制出的文字直接拆成任务。"],
            ["sync", "实时状态同步", "孩子点击“已完成”或“需要帮助”后，家长端立即刷新。"],
            ["blocks", "易扩展架构", "为后续 OCR、拍照上传、奖励系统预留清晰结构。"],
          ].map(([icon, title, desc]) => (
            <div
              key={title}
              className="soft-shadow interactive-card rounded-[1.25rem] border border-[var(--line)] bg-card p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[var(--primary-light)]">
                <FeatureIcon type={icon as "file" | "sync" | "blocks"} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--foreground)]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
