import { EmptyState } from "@/components/empty-state";
import { TASK_STATUS_META } from "@/lib/task-status";
import { formatDisplayDate } from "@/lib/date";
import type { TaskRecord, TaskStatus } from "@/types/task";

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

function subjectTheme(subject: string) {
  switch (subject) {
    case "英语":
      return {
        section: "border-[var(--line)] bg-[var(--subject-english-bg)]",
        stripe: "bg-[var(--subject-english)]",
        cardGlow: "",
      };
    case "数学":
      return {
        section: "border-[var(--line)] bg-[var(--subject-math-bg)]",
        stripe: "bg-[var(--subject-math)]",
        cardGlow: "",
      };
    case "语文":
      return {
        section: "border-[var(--line)] bg-[var(--subject-chinese-bg)]",
        stripe: "bg-[var(--subject-chinese)]",
        cardGlow: "",
      };
    default:
      return {
        section: "border-[var(--line)] bg-[var(--card-alt)]",
        stripe: "bg-[var(--primary)]",
        cardGlow: "",
      };
  }
}

function subjectSectionState(tasks: TaskRecord[], currentTaskId: string | null) {
  const allCompleted = tasks.every((task) => isCompletedStatus(task.status));
  const hasCurrent = tasks.some(
    (task) => task.id === currentTaskId && !isCompletedStatus(task.status),
  );

  if (allCompleted) {
    return {
      badgeClass: "bg-[var(--success-subtle)] text-[var(--success)]",
      metaText: "已完成",
    };
  }

  if (hasCurrent) {
    return {
      badgeClass: "bg-[var(--warning-subtle)] text-[var(--warning)]",
      metaText: "进行中",
    };
  }

  return {
    badgeClass: "bg-[var(--card)] text-[var(--text-secondary)]",
    metaText: "待完成",
  };
}

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
    <section className="soft-shadow rounded-[1.7rem] border border-[var(--line)] bg-card px-4 py-4 sm:px-5 md:px-8 md:py-6">
      <div className="flex flex-col gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--primary)] sm:text-sm">
            学习看板
          </p>
          <h1 className="mt-2 text-[1.9rem] font-semibold leading-tight text-[var(--foreground)] sm:text-3xl md:text-[2.25rem]">
            今天的学习任务
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            今天是 {formatDisplayDate(today)}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--card-alt)]/55 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="text-[var(--foreground)]">
              {completedCount}/{totalCount} 完成
            </span>
            <span className="text-[var(--text-secondary)]">
              {totalCount === 0
                ? "等待家长添加任务"
                : inProgressCount > 0
                  ? `正在做 ${inProgressCount} 项`
                  : progressPercent === 100
                    ? "今天全部完成"
                    : "继续完成今天的任务"}
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--line-light)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-3 text-xs font-medium tracking-[0.12em] text-[var(--text-secondary)]">
            {progressPercent}% 已完成
          </p>
        </div>
      </div>
    </section>
  );
}

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
  const ringTone =
    timerState.mode === "focus"
      ? "var(--primary)"
      : timerState.isRunning
        ? "var(--success)"
        : "var(--text-secondary)";
  const ringBackground = "var(--line)";

  return (
    <section className="soft-shadow rounded-[1.7rem] border border-[var(--line)] bg-card px-4 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-lg">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--primary)] sm:text-sm">
            番茄时钟
          </p>
          <h2 className="mt-2 text-[1.65rem] font-semibold leading-tight text-[var(--foreground)] sm:text-2xl md:text-[2rem]">
            {timerState.mode === "focus" ? "专注 20 分钟" : "休息 5 分钟"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            {timerState.mode === "focus"
              ? "专注做当前任务，到点后会自动提醒休息。"
              : "休息一下，结束后会自动开始下一轮专注。"}
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 self-stretch lg:items-end">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center lg:w-auto">
            <div
              className={`relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-card text-[var(--foreground)] sm:mx-0 sm:h-28 sm:w-28 md:h-32 md:w-32 ${
                timerState.isRunning ? "shadow-[var(--shadow-glow)]" : ""
              }`}
            >
              <svg
                viewBox="0 0 120 120"
                className={`absolute inset-0 h-full w-full -rotate-90 ${
                  timerState.notice ? "animate-pulse" : ""
                }`}
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={ringBackground}
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={ringTone}
                  strokeWidth="8"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={100 - timerProgress}
                  className="transition-[stroke-dashoffset,stroke] duration-700 ease-linear"
                />
              </svg>
              <div className="relative z-10 text-center">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--text-secondary)]">
                  {timerState.mode === "focus" ? "专注" : "休息"}
                </p>
                <p className="mt-1.5 text-[1.75rem] font-bold tracking-tight sm:mt-2 sm:text-3xl md:text-[2.2rem] [font-variant-numeric:tabular-nums]">
                  {formatTimer(timerState.secondsLeft)}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <div className="flex w-full rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)] p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => onSwitchMode("focus")}
                  className={`flex-1 rounded-[0.8rem] px-4 py-2 text-sm font-semibold md:text-base ${
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
                  className={`flex-1 rounded-[0.8rem] px-4 py-2 text-sm font-semibold md:text-base ${
                    timerState.mode === "break"
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  休息
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onStart}
                  disabled={timerState.isRunning}
                  className="rounded-[1rem] bg-[var(--primary)] px-3 py-3 text-sm font-semibold text-white disabled:bg-[var(--card-alt)] disabled:text-[var(--text-muted)] md:px-4 md:text-base"
                >
                  开始
                </button>
                <button
                  type="button"
                  onClick={onPause}
                  disabled={!timerState.isRunning}
                  className="rounded-[1rem] border border-[var(--line)] bg-card px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] disabled:bg-[var(--card-alt)] disabled:text-[var(--text-muted)] md:px-4 md:text-base"
                >
                  暂停
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-[1rem] border border-[var(--line)] bg-card px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] md:px-4 md:text-base"
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          {timerState.notice ? (
            <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] md:text-base">
              {timerState.notice}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ChildTasksSection({
  groups,
  currentTaskId,
  highlightedTaskId,
  isPending,
  onUpdateTask,
  allTasksCompleted,
  loading,
  message,
}: {
  groups: GroupedTasks[];
  currentTaskId: string | null;
  highlightedTaskId: string | null;
  isPending: boolean;
  onUpdateTask: (id: string, status: TaskStatus) => void;
  allTasksCompleted: boolean;
  loading: boolean;
  message: string | null;
}) {
  if (message) {
    return (
      <div className="mt-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--error-subtle)] px-5 py-4 text-base font-semibold text-[var(--error)]">
        {message}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-[1.8rem] bg-card p-8 text-center text-xl text-[var(--text-secondary)] shadow-lg">
        正在加载今天的任务...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          title="今天的任务还没到"
          description="家长一添加任务，这里就会马上出现。"
        />
      </div>
    );
  }

  return (
    <section className="space-y-4 md:space-y-5">
      <div className="px-1">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--text-secondary)]">
          今日任务
        </p>
      </div>

      <div className="grid gap-5 md:gap-6">
        {groups.map((group, groupIndex) => {
          const sectionState = subjectSectionState(group.tasks, currentTaskId);
          const theme = subjectTheme(group.subject);

          return (
            <section key={group.subject} className="space-y-3">
              <div
                className={`relative overflow-hidden rounded-[1.25rem] border px-5 py-4 ${theme.section}`}
              >
                <span className={`absolute inset-y-0 left-0 w-1.5 ${theme.stripe}`} />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="pl-1 text-2xl font-semibold text-[var(--foreground)] md:text-[2rem]">
                      {group.subject}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]">
                      {group.tasks.length} 个任务
                    </span>
                    <span
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${sectionState.badgeClass}`}
                    >
                      {sectionState.metaText}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:gap-5">
                {group.tasks.map((task, index) => {
                  const labels = actionLabels(task.status);
                  const meta = TASK_STATUS_META[task.status];
                  const isCompleted = isCompletedStatus(task.status);
                  const isCurrent = task.id === currentTaskId && !isCompleted;
                  const primaryButtonClass = isCompleted
                    ? "border border-[var(--line)] bg-[var(--success-subtle)] text-[var(--success)]"
                    : "border border-[var(--line)] bg-[var(--success-subtle)] text-[var(--success)] shadow-[var(--shadow-sm)]";
                  const helpButtonClass =
                    task.status === "needs_help"
                      ? "border border-[var(--line)] bg-[var(--warning-subtle)] text-[var(--warning)]"
                      : "border border-[var(--line)] bg-[var(--warning-subtle)] text-[var(--warning)]";
                  const weakButtonClass =
                    "border border-[var(--line)] bg-card text-[var(--text-secondary)]";

                  return (
                    <article
                      key={task.id}
                      className={`fade-slide-up soft-shadow relative overflow-hidden rounded-[1.5rem] border p-5 md:p-6 ${
                        isCurrent
                          ? `border-[var(--accent-muted)] bg-card shadow-[var(--shadow-md)] ${theme.cardGlow}`
                          : isCompleted
                            ? `border-[var(--line)] bg-[var(--card-alt)] opacity-80 ${theme.cardGlow}`
                            : `border-[var(--line)] bg-card ${theme.cardGlow}`
                      } ${highlightedTaskId === task.id ? "status-change-pulse" : ""}`}
                      style={{ animationDelay: `${groupIndex * 60 + index * 60}ms` }}
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${theme.stripe}`} />
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="pl-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
                              任务 {index + 1}
                            </p>
                            {isCurrent ? (
                              <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold tracking-[0.08em] text-white shadow-[var(--shadow-sm)]">
                                👉 现在做这个
                              </span>
                            ) : null}
                          </div>
                          <h2
                            className={`mt-3 text-3xl font-semibold leading-tight md:text-[2.2rem] ${
                              isCompleted
                                ? "text-[var(--text-secondary)] line-through decoration-2 decoration-[var(--text-tertiary)]"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {task.title}
                          </h2>
                          {task.details ? (
                            <p
                              className={`mt-3 max-w-3xl text-base leading-7 md:text-lg ${
                                isCompleted
                                  ? "text-[var(--text-muted)]"
                                  : "text-[var(--text-secondary)]"
                              }`}
                            >
                              {task.details}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success-subtle)] text-[1.1rem]">
                              ✅
                            </span>
                          ) : null}
                          <div
                            className={`rounded-full px-4 py-2 text-sm font-semibold md:text-base ${
                              isCompletedStatus(task.status)
                                ? "bg-[var(--success-subtle)] text-[var(--success)]"
                                : task.status === "needs_help"
                                  ? "bg-[var(--warning-subtle)] text-[var(--warning)]"
                                  : meta.tone
                            }`}
                          >
                            {meta.childLabel}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-3">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onUpdateTask(task.id, "in_progress")}
                          className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-lg font-semibold disabled:bg-[var(--card-alt)] disabled:text-[var(--text-muted)] md:text-[1.15rem] ${weakButtonClass} ${
                            isCompleted ? "opacity-70" : ""
                          }`}
                        >
                          {labels[0]}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onUpdateTask(task.id, "done_by_child")}
                          className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-xl font-semibold disabled:bg-[var(--card-alt)] disabled:text-[var(--text-muted)] md:text-[1.2rem] ${primaryButtonClass}`}
                        >
                          {labels[1]}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onUpdateTask(task.id, "needs_help")}
                          className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-lg font-semibold disabled:bg-[var(--card-alt)] disabled:text-[var(--text-muted)] md:text-[1.15rem] ${helpButtonClass}`}
                        >
                          {labels[2]}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {allTasksCompleted ? (
        <section className="soft-shadow fade-slide-up relative overflow-hidden rounded-[1.9rem] border border-[var(--line)] bg-card px-6 py-10 text-center md:px-8">
          <span
            className="confetti-piece left-[14%] bg-[rgba(232,115,90,0.55)]"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="confetti-piece left-[28%] bg-[rgba(245,166,35,0.5)]"
            style={{ animationDelay: "260ms" }}
          />
          <span
            className="confetti-piece left-[44%] bg-[rgba(91,155,213,0.45)]"
            style={{ animationDelay: "520ms" }}
          />
          <span
            className="confetti-piece left-[63%] bg-[rgba(42,157,143,0.45)]"
            style={{ animationDelay: "140ms" }}
          />
          <span
            className="confetti-piece left-[79%] bg-[rgba(155,142,196,0.4)]"
            style={{ animationDelay: "420ms" }}
          />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--warning-subtle)] text-3xl shadow-[var(--shadow-sm)]">
            🎉
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-[var(--foreground)]">
            太棒了，今天的任务全部搞定！
          </h2>
          <p className="mt-3 text-base text-[var(--text-secondary)]">休息一下吧 😊</p>
        </section>
      ) : null}
    </section>
  );
}
