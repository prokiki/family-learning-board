"use client";

import { useState } from "react";
import Image from "next/image";
import { EmptyState } from "@/components/empty-state";
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
      return "border-l-[3px] border-l-[var(--subject-chinese)] bg-[rgba(234,67,53,0.04)]";
    case "数学":
      return "border-l-[3px] border-l-[var(--subject-math)] bg-[rgba(66,133,244,0.04)]";
    case "英语":
      return "border-l-[3px] border-l-[var(--subject-english)] bg-[rgba(26,138,125,0.04)]";
    default:
      return "border-l-[3px] border-l-[var(--primary)] bg-[var(--card-alt)]/30";
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
      return "bg-[rgba(26,138,125,0.1)] text-[var(--primary)]";
    case "pending":
      return "bg-[rgba(0,0,0,0.04)] text-[var(--text-tertiary)]";
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
            className="min-h-[44px] rounded-[12px] border border-[var(--line)] bg-transparent px-5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[rgba(0,0,0,0.03)]"
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
    return (
      <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-8 text-center text-lg text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
        正在加载今天的任务...
      </div>
    );
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
              {attachmentGroup ? (
                <button
                  type="button"
                  onClick={() => onOpenAttachments(group.subject)}
                  className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-1.5 text-xs font-medium text-[var(--primary)]"
                >
                  查看参考图片
                </button>
              ) : null}
            </div>

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
                            className="child-btn-start flex-1 min-h-[48px] rounded-[12px] border-[1.5px] border-[rgba(26,138,125,0.3)] bg-transparent px-3 py-3 text-sm font-medium text-[var(--primary)] disabled:opacity-40"
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
                            className="child-btn-help flex-1 min-h-[48px] rounded-[12px] border-[1.5px] border-[rgba(234,140,0,0.3)] bg-transparent px-3 py-3 text-sm font-medium text-[var(--warning)] disabled:opacity-40"
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
  const [zoomed, setZoomed] = useState(false);

  if (!group) {
    return null;
  }

  const activeAttachment = group.attachments[selectedIndex] ?? group.attachments[0];
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < group.attachments.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-3 py-4 md:px-6 md:py-6">
        <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-card shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--line-light)] px-4 py-4 md:px-6">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[var(--primary)]">
                参考图片
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--foreground)] md:text-2xl">
                {group.subject}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
            >
              关闭
            </button>
          </div>
          <div className="max-h-[calc(94vh-88px)] overflow-y-auto p-4 md:p-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/55 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--info-subtle)] px-3 py-1 text-xs font-semibold text-[var(--info)]">
                      {attachmentRoleLabel(activeAttachment.role)}
                    </span>
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      第 {selectedIndex + 1} 张 / 共 {group.attachments.length} 张
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canGoPrev}
                      onClick={() => {
                        setSelectedIndex((current) => Math.max(current - 1, 0));
                        setZoomed(false);
                      }}
                      className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
                    >
                      上一张
                    </button>
                    <button
                      type="button"
                      disabled={!canGoNext}
                      onClick={() => {
                        setSelectedIndex((current) =>
                          Math.min(current + 1, group.attachments.length - 1),
                        );
                        setZoomed(false);
                      }}
                      className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
                    >
                      下一张
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomed(true)}
                  className="group relative block min-h-[52vh] w-full overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--surface-3)] text-left md:min-h-[62vh]"
                >
                  <Image
                    src={activeAttachment.public_url}
                    alt={activeAttachment.note ?? `${group.subject} 参考图片 ${selectedIndex + 1}`}
                    fill
                    sizes="(max-width: 1280px) 100vw, 900px"
                    className="object-contain p-3 md:p-5"
                    priority
                  />
                  <div className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white">
                    点一下放大看
                  </div>
                </button>

                {group.attachments.length > 1 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {group.attachments.map((attachment, index) => (
                      <button
                        key={attachment.id}
                        type="button"
                        onClick={() => {
                          setSelectedIndex(index);
                          setZoomed(false);
                        }}
                        className={`relative overflow-hidden rounded-[1rem] border ${
                          index === selectedIndex
                            ? "border-[var(--primary)] shadow-[var(--shadow-glow)]"
                            : "border-[var(--line)]"
                        }`}
                      >
                        <div className="relative h-24 w-full bg-[var(--surface-3)]">
                          <Image
                            src={attachment.public_url}
                            alt={attachment.note ?? `${group.subject} 缩略图 ${index + 1}`}
                            fill
                            sizes="120px"
                            className="object-contain p-2"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              <aside className="space-y-4">
                <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/55 p-4">
                  <p className="text-sm font-semibold tracking-[0.14em] text-[var(--primary)]">
                    老师提示
                  </p>
                  <p className="mt-3 text-base leading-8 text-[var(--foreground)]">
                    {activeAttachment.note || "先认真看这张参考图片，再继续完成下面的任务。"}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[var(--line)] bg-card p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">怎么看更清楚</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                    横屏看会更清楚。点中间大图可以再放大一层，更适合看整页单词、抄写模版和页码要求。
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {zoomed ? (
        <div className="fixed inset-0 z-50 bg-black/90 px-3 py-4 md:px-6 md:py-6">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4">
              <div className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                第 {selectedIndex + 1} 张 / 共 {group.attachments.length} 张
              </div>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="rounded-[12px] border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white"
              >
                关闭放大
              </button>
            </div>
            <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-[1rem] border border-white/10 bg-black/40">
              <Image
                src={activeAttachment.public_url}
                alt={activeAttachment.note ?? `${group.subject} 放大参考图片 ${selectedIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain p-2 md:p-4"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
