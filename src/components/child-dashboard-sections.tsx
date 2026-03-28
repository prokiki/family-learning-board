"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { EmptyState, TaskListSkeleton } from "@/components/empty-state";
import { formatDisplayDate } from "@/lib/date";
import type { TaskAttachmentRecord, TaskRecord, TaskStatus } from "@/types/task";

/* ─────────── AI 问一问 + 写作引导 ─────────── */

const WRITING_KEYWORDS = ["作文", "写作", "写话", "看图写话", "日记", "读后感", "观后感", "写一篇", "写一段"];

function isWritingTask(task: TaskRecord): boolean {
  const sub = (task.subject || "").trim();
  const title = task.title || "";
  const details = task.details || "";
  const text = `${sub} ${title} ${details}`;
  return WRITING_KEYWORDS.some((kw) => text.includes(kw));
}

type HelpCard = { explain: string; steps: string[]; check: string };

type MindmapPoint = { tip: string; example: string };
type MindmapSection = { name: string; color: string; points: MindmapPoint[] };
type MindmapData = { title: string; sections: MindmapSection[] };
type SampleData = { label: string; text: string; comment: string };

function TaskHelpButton({ boardId, task }: { boardId: string; task: TaskRecord }) {
  const writing = isWritingTask(task);
  const [open, setOpen] = useState(false);

  if (!open) {
    return writing ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-[10px] border border-dashed border-[var(--subject-chinese,#e8a735)] bg-[var(--warning-subtle)] px-3 py-2.5 text-xs font-semibold text-[var(--subject-chinese,#c47a20)] transition-colors"
      >
        ✏️ 不知道怎么写？点这里帮你理思路
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-[10px] border border-dashed border-[var(--line)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        💡 问一问
      </button>
    );
  }

  if (writing) {
    return <WritingAssistant boardId={boardId} task={task} onClose={() => setOpen(false)} />;
  }

  return <TaskHelpCard boardId={boardId} task={task} onClose={() => setOpen(false)} />;
}

/* ───── 非作文作业：作业攻略卡（卡片内展开） ───── */

function TaskHelpCard({ boardId, task, onClose }: { boardId: string; task: TaskRecord; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<HelpCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/task-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board: boardId, subject: task.subject || "", title: task.title, details: task.details || "" }),
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "加载失败");
        } else {
          setCard(data.card);
        }
      } catch {
        if (active) setError("网络异常");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [boardId, task]);

  return (
    <div className="mt-2 rounded-[12px] border border-[var(--primary)]/20 bg-[var(--primary-light)] p-3.5">
      {loading && (
        <div className="flex items-center gap-2 py-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">正在生成攻略...</p>
        </div>
      )}
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {card && !loading && (
        <div className="space-y-2.5">
          {/* 解释 */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-sm">📖</span>
            <p className="text-sm leading-6 text-[var(--foreground)]">{card.explain}</p>
          </div>
          {/* 步骤 */}
          {card.steps.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-sm">👣</span>
              <div className="space-y-1">
                {card.steps.map((step, i) => (
                  <p key={i} className="text-sm leading-6 text-[var(--foreground)]">
                    {card.steps.length > 1 ? `${i + 1}. ${step}` : step}
                  </p>
                ))}
              </div>
            </div>
          )}
          {/* 检查 */}
          {card.check && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-sm">✅</span>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{card.check}</p>
            </div>
          )}
        </div>
      )}
      {/* 收起按钮 */}
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-[8px] py-1 text-center text-xs text-[var(--text-muted)]"
      >
        收起
      </button>
    </div>
  );
}

/* ───── 作文任务：三步流程写作助手 ───── */

const WRITING_STEPS = [
  { key: "mindmap", label: "① 思维导图" },
  { key: "write", label: "② 分段写" },
  { key: "sample", label: "③ 赏析学习" },
] as const;

function WritingAssistant({ boardId, task, onClose }: { boardId: string; task: TaskRecord; onClose: () => void }) {
  const [step, setStep] = useState<"mindmap" | "write" | "sample">("mindmap");
  const [loading, setLoading] = useState(true); // 自动加载思维导图
  const [mindmap, setMindmap] = useState<MindmapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 分段写作状态
  const [drafts, setDrafts] = useState<string[]>([]);
  const [feedbacks, setFeedbacks] = useState<(string | null)[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null);

  // 赏析状态
  const [samples, setSamples] = useState<SampleData[] | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  // 自动加载思维导图
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/writing-mindmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board: boardId, title: task.title, details: task.details || "" }),
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "思维导图生成失败");
        } else {
          setMindmap(data.mindmap);
          // 初始化分段草稿
          setDrafts(data.mindmap.sections.map(() => ""));
          setFeedbacks(data.mindmap.sections.map(() => null));
        }
      } catch {
        if (active) setError("网络异常，请重试");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [boardId, task]);

  // 获取每段反馈
  const getFeedback = useCallback(async (sectionIndex: number) => {
    if (!mindmap || !drafts[sectionIndex]?.trim()) return;
    setFeedbackLoading(sectionIndex);
    try {
      const res = await fetch("/api/writing-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: boardId,
          title: task.title,
          section_name: mindmap.sections[sectionIndex].name,
          text: drafts[sectionIndex],
        }),
      });
      const data = await res.json();
      setFeedbacks((prev) => {
        const next = [...prev];
        next[sectionIndex] = !res.ok ? (data.error || "反馈失败") : data.feedback;
        return next;
      });
    } catch {
      setFeedbacks((prev) => { const n = [...prev]; n[sectionIndex] = "网络异常"; return n; });
    } finally {
      setFeedbackLoading(null);
    }
  }, [boardId, task, mindmap, drafts]);

  // 加载赏析
  const loadSamples = useCallback(async () => {
    setSampleLoading(true);
    try {
      const res = await fetch("/api/writing-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: boardId, title: task.title, details: task.details || "" }),
      });
      const data = await res.json();
      if (res.ok && data.samples) setSamples(data.samples);
    } catch { /* ignore */ } finally {
      setSampleLoading(false);
    }
  }, [boardId, task]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        {/* 顶栏 */}
        <div className="mb-6">
          <button type="button" onClick={onClose} className="nav-button">← 返回任务</button>
          <p className="mt-4 text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">写作小帮手</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{task.title}</h1>
          {task.details && <p className="mt-1 text-sm text-[var(--text-secondary)]">{task.details}</p>}
        </div>

        {/* 步骤指示器 */}
        <div className="mb-6 flex gap-2">
          {WRITING_STEPS.map((s) => (
            <button key={s.key} type="button" onClick={() => {
              if (s.key === "sample" && !samples && !sampleLoading) loadSamples();
              setStep(s.key as typeof step);
            }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                step === s.key ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--line)] bg-card text-[var(--text-secondary)]"
              }`}>{s.label}</button>
          ))}
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5 md:p-6">
            <div className="flex items-center gap-2 py-8">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              <p className="text-base text-[var(--text-muted)]">正在拆解作文思路...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5 md:p-6">
            <p className="text-base text-[var(--error)]">{error}</p>
          </div>
        )}

        {/* 步骤 1：思维导图 */}
        {!loading && mindmap && step === "mindmap" && (
          <div className="space-y-4">
            <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5 md:p-6">
              <MindmapView data={mindmap} />
            </div>
            <button type="button" onClick={() => setStep("write")}
              className="w-full rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white">
              看懂了，开始写 →
            </button>
          </div>
        )}

        {/* 步骤 2：分段写作 */}
        {!loading && mindmap && step === "write" && (
          <div className="space-y-4">
            {mindmap.sections.map((section, si) => {
              const s = SECTION_STYLES[section.color] || SECTION_STYLES.sky;
              return (
                <div key={si} className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5 md:p-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                    <span className="text-base font-bold" style={{ color: s.name }}>{section.name}</span>
                  </div>
                  {/* 要点提示 */}
                  <div className="mb-3 space-y-2 rounded-[10px] border border-[var(--line-light)] bg-[var(--card-alt)] p-3">
                    {section.points.map((pt, pi) => (
                      <div key={pi}>
                        <p className="text-sm text-[var(--text-secondary)]">‣ {pt.tip}</p>
                        {pt.example && (
                          <p className="mt-0.5 pl-4 text-sm italic leading-6" style={{ color: s.name }}>“{pt.example}”</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* 输入框 */}
                  <textarea
                    value={drafts[si] || ""}
                    onChange={(e) => setDrafts((prev) => { const n = [...prev]; n[si] = e.target.value; return n; })}
                    placeholder="在这里写这一段..."
                    rows={4}
                    className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base leading-8 outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                  />
                  {/* 反馈按钮 */}
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" disabled={!drafts[si]?.trim() || feedbackLoading === si}
                      onClick={() => getFeedback(si)}
                      className="rounded-full border border-[var(--line)] bg-card px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-40">
                      {feedbackLoading === si ? "评价中..." : "✨ 帮我看看这段写得怎么样"}
                    </button>
                  </div>
                  {/* 反馈内容 */}
                  {feedbacks[si] && (
                    <div className="mt-3 rounded-[10px] border border-[var(--line-light)] bg-[var(--primary-light)] p-3">
                      <p className="text-sm leading-7 text-[var(--foreground)]">{feedbacks[si]}</p>
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={() => { if (!samples && !sampleLoading) loadSamples(); setStep("sample"); }}
              className="w-full rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white">
              写完了，看看别人怎么写 →
            </button>
          </div>
        )}

        {/* 步骤 3：赏析学习 */}
        {!loading && step === "sample" && (
          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">精彩片段赏析</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">看看同样的题目，别人是怎么写的</p>
            {sampleLoading && (
              <div className="flex items-center gap-2 py-8">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                <p className="text-base text-[var(--text-muted)]">正在生成精彩片段...</p>
              </div>
            )}
            {samples && (
              <div className="mt-4 space-y-4">
                {samples.map((sample, i) => (
                  <div key={i} className="rounded-[12px] border border-[var(--line-light)] bg-[var(--card-alt)] p-4">
                    <p className="text-xs font-bold text-[var(--primary)]">{sample.label}</p>
                    <p className="mt-2 text-base leading-8 text-[var(--foreground)]">“{sample.text}”</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">💡 {sample.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── 思维导图可视化 ───────── */

const SECTION_STYLES: Record<string, { bg: string; border: string; dot: string; name: string }> = {
  rose:    { bg: "rgba(244,63,94,0.08)",  border: "rgba(244,63,94,0.25)",  dot: "#f43f5e", name: "#e11d48" },
  amber:   { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#f59e0b", name: "#d97706" },
  sky:     { bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.25)", dot: "#0ea5e9", name: "#0284c7" },
  emerald: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", dot: "#10b981", name: "#059669" },
};

function MindmapView({ data }: { data: MindmapData }) {
  return (
    <div className="space-y-3">
      {/* 根节点 */}
      <div className="rounded-[12px] bg-[var(--primary)] px-5 py-3 text-center text-lg font-bold text-white">
        {data.title}
      </div>

      {/* 段落分支 */}
      <div className="space-y-3">
        {data.sections.map((section, si) => {
          const s = SECTION_STYLES[section.color] || SECTION_STYLES.sky;
          return (
            <div
              key={si}
              className="rounded-[12px] border p-4"
              style={{ backgroundColor: s.bg, borderColor: s.border }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.dot }}
                />
                <span className="text-base font-bold" style={{ color: s.name }}>
                  {section.name}
                </span>
              </div>
              <div className="mt-3 ml-[22px] space-y-3">
                {section.points.map((point, pi) => (
                  <div key={pi}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-sm" style={{ color: s.dot }}>‣</span>
                      <p className="text-sm leading-7 text-[var(--foreground)]">{point.tip}</p>
                    </div>
                    {point.example && (
                      <p className="ml-[18px] mt-1 text-sm italic leading-6 text-[var(--text-secondary)]">
                        “{point.example}”
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-[var(--text-muted)]">沿着导图，每个要点写 1-2 句话，拼起来就是一篇完整作文</p>
    </div>
  );
}

type TimerMode = "focus" | "break";
type TimerState = {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  notice: string | null;
};

type GroupedTasks = {
  subject: string;
  tasks: TaskRecord[];
};

type AttachmentGroup = {
  subject: string;
  attachments: TaskAttachmentRecord[];
};

function actionLabels(status: TaskStatus) {
  switch (status) {
    case "pending":
      return ["开始做", "完成啦", "需要帮助"] as const;
    case "in_progress":
      return ["继续做", "完成啦", "需要帮助"] as const;
    case "done_by_child":
      return ["再检查一下", "我做完啦", "还是需要帮助"] as const;
    case "needs_help":
      return ["先自己试试", "我做完啦", "等家长来帮"] as const;
    case "confirmed_by_parent":
      return ["再做一遍", "已确认", "需要帮助"] as const;
  }
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function isCompletedStatus(status: TaskStatus) {
  return status === "done_by_child" || status === "confirmed_by_parent";
}

function subjectSectionClass(subject: string) {
  switch (subject) {
    case "语文":
      return "border-l-[3px] border-l-[var(--subject-chinese)] bg-[var(--subject-chinese-bg)]";
    case "数学":
      return "border-l-[3px] border-l-[var(--subject-math)] bg-[var(--subject-math-bg)]";
    case "英语":
      return "border-l-[3px] border-l-[var(--subject-english)] bg-[var(--subject-english-bg)]";
    default:
      return "border-l-[3px] border-l-[var(--primary)] bg-[var(--card-alt)]";
  }
}

function subjectLabelClass(subject: string) {
  switch (subject) {
    case "语文":
      return "text-[var(--subject-chinese)]";
    case "数学":
      return "text-[var(--subject-math)]";
    case "英语":
      return "text-[var(--subject-english)]";
    default:
      return "text-[var(--primary)]";
  }
}

function statusPillClass(status: TaskStatus) {
  switch (status) {
    case "in_progress":
      return "bg-[var(--accent-subtle)] text-[var(--primary)]";
    case "pending":
      return "bg-[var(--card-alt)] text-[var(--text-tertiary)]";
    case "done_by_child":
    case "confirmed_by_parent":
      return "bg-[var(--success-subtle)] text-[var(--success)]";
    case "needs_help":
      return "bg-[var(--warning-subtle)] text-[var(--warning)]";
  }
}

function statusPillLabel(status: TaskStatus) {
  switch (status) {
    case "pending":
      return "待开始";
    case "in_progress":
      return "进行中";
    case "done_by_child":
      return "✓ 已完成";
    case "confirmed_by_parent":
      return "✓ 已确认";
    case "needs_help":
      return "需要帮助";
  }
}

/* ─────────────────────────── Header ─────────────────────────── */

export function ChildHeader({
  today,
}: {
  today: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          学习看板
        </h1>
        <span className="text-sm text-[var(--text-tertiary)]">
          {today ? formatDisplayDate(today) : ""}
        </span>
      </div>
    </section>
  );
}

/* ─────────────────────────── Pomodoro ─────────────────────────── */

export function PomodoroSection({
  timerState,
  timerProgress,
  onSwitchMode,
  onStart,
  onPause,
  onReset,
}: {
  timerState: TimerState;
  timerProgress: number;
  onSwitchMode: (mode: TimerMode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const strokeColor = timerState.mode === "focus" ? "var(--primary)" : "var(--success)";

  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-card px-6 py-7 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col items-center gap-5">
        <span className="text-xs font-medium tracking-[0.06em] text-[var(--text-tertiary)]">
          专注时钟
        </span>

        {/* Timer Ring */}
        <div className="relative h-44 w-44">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx="80" cy="80" r="68" fill="none" stroke="var(--line)" strokeWidth="8" strokeOpacity="0.5" />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - timerProgress}
              className="transition-[stroke-dashoffset,stroke] duration-700 ease-linear"
              style={{ filter: timerState.isRunning ? `drop-shadow(0 0 6px ${strokeColor})` : 'none' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {timerState.secondsLeft === 0 && !timerState.isRunning ? (
              <span className="text-2xl font-bold text-[var(--primary)]">时间到</span>
            ) : (
              <span className="text-4xl font-bold tracking-tight text-[var(--foreground)] [font-variant-numeric:tabular-nums]">
                {formatTimer(timerState.secondsLeft)}
              </span>
            )}
            <span className="mt-1 text-xs font-medium text-[var(--text-muted)]">
              {timerState.mode === "focus"
                ? timerState.isRunning ? "专注中" : "专注模式"
                : timerState.isRunning ? "休息中" : "休息模式"}
            </span>
          </div>
        </div>

        {/* Mode Switch */}
        <div className="flex w-full rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] p-0.5">
          <button
            type="button"
            onClick={() => onSwitchMode("focus")}
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
              timerState.mode === "focus"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)]"
            }`}
          >
            专注
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode("break")}
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
              timerState.mode === "break"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)]"
            }`}
          >
            休息
          </button>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onReset}
            className="min-h-[44px] rounded-[12px] border border-[var(--line)] bg-transparent px-5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-alt)]"
          >
            重置
          </button>
          {timerState.isRunning ? (
            <button
              type="button"
              onClick={onPause}
              className="min-h-[44px] rounded-[12px] bg-[var(--primary)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              暂停
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="min-h-[44px] rounded-[12px] bg-[var(--primary)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              开始
            </button>
          )}
        </div>

        {timerState.notice ? (
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)]">
            {timerState.notice}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────── Tasks ─────────────────────────── */

export function ChildTasksSection({
  boardId,
  groups,
  attachmentGroups,
  today,
  highlightedTaskId,
  isPending,
  onUpdateTask,
  onOpenAttachments,
  loading,
  message,
}: {
  boardId: string;
  groups: GroupedTasks[];
  attachmentGroups: AttachmentGroup[];
  today: string;
  highlightedTaskId: string | null;
  isPending: boolean;
  onUpdateTask: (id: string, status: TaskStatus) => void;
  onOpenAttachments: (subject: string) => void;
  loading: boolean;
  message: string | null;
}) {
  if (message) {
    return (
      <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--error-subtle)] px-5 py-4 text-base font-semibold text-[var(--error)]">
        {message}
      </div>
    );
  }

  if (loading) {
    return <TaskListSkeleton rows={4} />;
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        title="今天的作业还没到"
        description="家长一添加作业，这里就会马上出现。"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const attachmentGroup = attachmentGroups.find((item) => item.subject === group.subject);

        return (
          <section
            key={group.subject}
            className={`rounded-[1.5rem] p-5 ${subjectSectionClass(group.subject)}`}
          >
            {/* Subject Header */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={`text-xs font-semibold tracking-[0.02em] ${subjectLabelClass(group.subject)}`}>
                {group.subject}
              </span>
            </div>

            {/* 参考图片提示条 */}
            {attachmentGroup ? (
              <button
                type="button"
                onClick={() => onOpenAttachments(group.subject)}
                className="mb-3 flex w-full items-center gap-3 rounded-[1rem] border border-[var(--primary)]/25 bg-[var(--primary-light)] p-2.5 text-left"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface-3)]">
                  <Image
                    src={attachmentGroup.attachments[0].public_url}
                    alt="参考图片"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--primary)]">
                    老师发了 {attachmentGroup.attachments.length} 张参考图片
                  </p>
                  {attachmentGroup.attachments[0].note ? (
                    <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                      {attachmentGroup.attachments[0].note}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">查看 &rsaquo;</span>
              </button>
            ) : null}

            {/* Task Cards Grid — 2 columns on iPad+ */}
            <div className="grid gap-3 md:grid-cols-2">
              {group.tasks.map((task) => {
                const labels = actionLabels(task.status);
                const completed = isCompletedStatus(task.status);

                return (
                  <article
                    key={task.id}
                    className={`rounded-[1rem] border border-[var(--line)] bg-card p-4 shadow-[var(--shadow-sm)] ${
                      completed ? "opacity-60" : ""
                    } ${highlightedTaskId === task.id ? "status-change-pulse" : ""}`}
                  >
                    {/* Card Header: Title + Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-lg font-semibold leading-snug ${
                            completed
                              ? "text-[var(--text-tertiary)] line-through decoration-[1.5px]"
                              : "text-[var(--foreground)]"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.details ? (
                          <p className={`mt-1 text-sm leading-relaxed ${
                            completed ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
                          }`}>
                            {task.details}
                          </p>
                        ) : null}
                        {task.due_date !== today ? (
                          <span className="mt-1.5 inline-block rounded-full bg-[var(--card-alt)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                            之前没完成
                          </span>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass(task.status)}`}>
                        {statusPillLabel(task.status)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 flex gap-2">
                      {completed ? (
                        <button
                          type="button"
                          disabled
                          className="flex-1 rounded-[12px] border-[1.5px] border-transparent bg-[var(--success-subtle)] px-3 py-3 text-sm font-medium text-[var(--success)] min-h-[48px]"
                        >
                          ✓ 已完成
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onUpdateTask(task.id, "in_progress")}
                            className="child-btn-start flex-1 min-h-[48px] rounded-[12px] border-[1.5px] border-[var(--accent-muted)] bg-transparent px-3 py-3 text-sm font-medium text-[var(--primary)] disabled:opacity-40"
                          >
                            {labels[0]}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onUpdateTask(task.id, "done_by_child")}
                            className="child-btn-complete flex-1 min-h-[48px] rounded-[12px] border-[1.5px] border-[var(--success)] bg-[var(--success)] px-3 py-3 text-sm font-medium text-white disabled:opacity-40"
                          >
                            {labels[1]}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onUpdateTask(task.id, "needs_help")}
                            className="child-btn-help flex-1 min-h-[48px] rounded-[12px] border-[1.5px] border-[var(--warning-subtle)] bg-transparent px-3 py-3 text-sm font-medium text-[var(--warning)] disabled:opacity-40"
                          >
                            {labels[2]}
                          </button>
                        </>
                      )}
                    </div>

                    {/* AI 问一问 */}
                    {!completed && <TaskHelpButton boardId={boardId} task={task} />}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}


    </div>
  );
}

/* ─────────────────────────── Attachment Modal ─────────────────────────── */

export function AttachmentModal({
  group,
  onClose,
}: {
  group: AttachmentGroup | null;
  onClose: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (!group) {
    return null;
  }

  const activeAttachment = group.attachments[selectedIndex] ?? group.attachments[0];
  const total = group.attachments.length;

  function goPrev() {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  }
  function goNext() {
    setSelectedIndex((i) => Math.min(i + 1, total - 1));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX === null) return;
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (diff > 60) goPrev();
        else if (diff < -60) goNext();
        setTouchStartX(null);
      }}
    >
      {/* 顶栏 */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
            {group.subject}
          </span>
          <span className="text-sm text-white/60">
            {selectedIndex + 1} / {total}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] bg-white/15 px-3 py-1.5 text-sm font-semibold text-white"
        >
          关闭
        </button>
      </div>

      {/* 主图区域 */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Image
          src={activeAttachment.public_url}
          alt={activeAttachment.note ?? `${group.subject} 参考图片 ${selectedIndex + 1}`}
          fill
          sizes="100vw"
          className="object-contain p-2"
          priority
        />

        {/* 左右切换按钮（iPad / 横屏） */}
        {selectedIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-lg text-white"
          >
            ‹
          </button>
        )}
        {selectedIndex < total - 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-lg text-white"
          >
            ›
          </button>
        )}
      </div>

      {/* 底部：老师提示 + 缩略图 */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        {activeAttachment.note ? (
          <p className="mb-2 rounded-[10px] bg-white/10 px-3 py-2 text-sm leading-6 text-white/90">
            {activeAttachment.note}
          </p>
        ) : null}

        {total > 1 ? (
          <div className="flex gap-2 overflow-x-auto py-1">
            {group.attachments.map((attachment, index) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border-2 ${
                  index === selectedIndex
                    ? "border-white"
                    : "border-transparent opacity-50"
                }`}
              >
                <Image
                  src={attachment.public_url}
                  alt={`缩略图 ${index + 1}`}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
