"use client";

import { useState } from "react";
import Image from "next/image";
import { EmptyState, TaskListSkeleton } from "@/components/empty-state";
import { formatDisplayDate } from "@/lib/date";
import type { TaskAttachmentRecord, TaskRecord, TaskStatus } from "@/types/task";

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

function attachmentRoleLabel(role: TaskAttachmentRecord["role"]) {
  switch (role) {
    case "reference":
      return "参考图片";
    case "instruction":
      return "老师说明";
    case "parent_only":
      return "仅家长可见";
  }
}

/* ─────────────────────────── Header ─────────────────────────── */

export function ChildHeader({
  today,
  totalCount,
  inProgressCount,
  completedCount,
}: {
  today: string;
  totalCount: number;
  inProgressCount: number;
  completedCount: number;
}) {
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            学习看板
          </h1>
          <span className="text-sm text-[var(--text-tertiary)]">
            {today ? formatDisplayDate(today) : ""}
          </span>
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)]">
          <strong className="font-semibold text-[var(--primary)]">{completedCount}</strong>
          /{totalCount} 完成
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line-light)]">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
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
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--line)" strokeWidth="6" />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke={strokeColor}
              strokeWidth="6"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - timerProgress}
              className="transition-[stroke-dashoffset,stroke] duration-700 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tracking-tight text-[var(--foreground)] [font-variant-numeric:tabular-nums]">
              {formatTimer(timerState.secondsLeft)}
            </span>
          </div>
        </div>

        <span className="text-xs font-medium text-[var(--primary)]">
          {timerState.mode === "focus"
            ? timerState.isRunning
              ? "专注中"
              : "专注模式"
            : timerState.isRunning
              ? "休息中"
              : "休息模式"}
        </span>

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
  groups,
  attachmentGroups,
  today,
  currentTaskId,
  highlightedTaskId,
  isPending,
  onUpdateTask,
  onOpenAttachments,
  allTasksCompleted,
  loading,
  message,
}: {
  groups: GroupedTasks[];
  attachmentGroups: AttachmentGroup[];
  today: string;
  currentTaskId: string | null;
  highlightedTaskId: string | null;
  isPending: boolean;
  onUpdateTask: (id: string, status: TaskStatus) => void;
  onOpenAttachments: (subject: string) => void;
  allTasksCompleted: boolean;
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
        title="今天的任务还没到"
        description="家长一添加任务，这里就会马上出现。"
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
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* All Done Section */}
      {allTasksCompleted ? (
        <div className="rounded-[1.5rem] border border-[var(--line)] bg-card px-6 py-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-subtle)] text-xl font-bold text-[var(--success)]">
            ✓
          </div>
          <p className="mt-3 text-base font-semibold text-[var(--foreground)]">
            今天的任务全部完成了
          </p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">好好休息一下吧</p>
        </div>
      ) : null}
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
