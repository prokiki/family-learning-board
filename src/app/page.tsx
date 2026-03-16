import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,247,222,0.9),_rgba(255,255,255,1)_45%)] px-6 py-10 text-slate-900">
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(14,165,233,0.15),rgba(34,197,94,0.15))]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-12">
          <div className="max-w-3xl space-y-5">
            <p className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
              家庭学习看板 MVP
            </p>
            <h1 className="font-title text-4xl leading-tight text-slate-950 md:text-6xl">
              放学后，孩子一眼就知道今天先做什么。
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
              家长把老师作业整理成清晰任务，孩子在固定设备上大字查看、点按反馈，家长端实时看到完成情况。
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/parent"
              className="rounded-[1.75rem] bg-slate-950 px-6 py-6 text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-slate-300">
                Parent
              </p>
              <h2 className="mt-2 text-3xl font-bold">家长端</h2>
              <p className="mt-3 text-base leading-7 text-slate-200">
                创建今日任务、导入老师作业、实时查看孩子反馈。
              </p>
            </Link>
            <Link
              href="/child"
              className="rounded-[1.75rem] bg-gradient-to-br from-sky-400 via-cyan-300 to-lime-300 px-6 py-6 text-slate-950 shadow-lg transition hover:-translate-y-0.5"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-slate-700">
                Child
              </p>
              <h2 className="mt-2 font-title text-4xl">孩子看板</h2>
              <p className="mt-3 text-lg leading-8 text-slate-800">
                大按钮、大字、少导航，专注今天的任务和下一步。
              </p>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["老师作业导入", "支持把钉钉群里复制出的文字直接拆成任务。"],
            ["实时状态同步", "孩子点击“已完成”或“需要帮助”后，家长端立即刷新。"],
            ["易扩展架构", "为后续 OCR、拍照上传、奖励系统预留清晰结构。"],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-6 shadow-[0_15px_40px_rgba(15,23,42,0.06)]"
            >
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-600">{desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
