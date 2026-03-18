"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useReducer,
  useState,
  useTransition,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { TASK_STATUS_META } from "@/lib/task-status";
import { formatDisplayDate, formatLocalDate } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TaskRecord, TaskStatus } from "@/types/task";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";
const FOCUS_MINUTES = 20;
const BREAK_MINUTES = 5;

type TimerMode = "focus" | "break";
type TimerState = {
  mode: TimerMode;
  secondsLeft: number;
  isRunning: boolean;
  notice: string | null;
};
type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "tick" }
  | { type: "switchMode"; mode: TimerMode }
  | { type: "reset" }
  | { type: "startFocus" }
  | { type: "phaseComplete" };

function getModeSeconds(mode: TimerMode) {
  return mode === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60;
}

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "start":
      return { ...state, isRunning: true, notice: null };
    case "pause":
      return { ...state, isRunning: false };
    case "tick":
      return {
        ...state,
        secondsLeft: Math.max(state.secondsLeft - 1, 0),
      };
    case "switchMode":
      return {
        mode: action.mode,
        secondsLeft: getModeSeconds(action.mode),
        isRunning: false,
        notice: null,
      };
    case "startFocus":
      return {
        mode: "focus",
        secondsLeft: getModeSeconds("focus"),
        isRunning: true,
        notice: null,
      };
    case "reset":
      return {
        ...state,
        isRunning: false,
        secondsLeft: getModeSeconds(state.mode),
        notice: null,
      };
    case "phaseComplete": {
      const nextMode: TimerMode = state.mode === "focus" ? "break" : "focus";

      return {
        mode: nextMode,
        secondsLeft: getModeSeconds(nextMode),
        isRunning: true,
        notice:
          state.mode === "focus"
            ? "专注时间到啦，休息 5 分钟吧。"
            : "休息时间结束，开始下一轮专注。",
      };
    }
  }
}

async function fetchTodayTasks(supabase: SupabaseClient, dueDate: string) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .eq("due_date", dueDate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

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

function taskSortWeight(status: TaskStatus) {
  switch (status) {
    case "in_progress":
      return 0;
    case "pending":
      return 1;
    case "needs_help":
      return 2;
    case "done_by_child":
      return 3;
    case "confirmed_by_parent":
      return 4;
  }
}

function groupTasksBySubject(tasks: TaskRecord[]) {
  const grouped = new Map<string, TaskRecord[]>();

  for (const task of tasks) {
    const subject = task.subject?.trim() || "今日任务";
    const subjectTasks = grouped.get(subject) ?? [];
    subjectTasks.push(task);
    grouped.set(subject, subjectTasks);
  }

  return [...grouped.entries()].map(([subject, subjectTasks]) => ({
    subject,
    tasks: subjectTasks,
  }));
}

function subjectTheme(subject: string) {
  switch (subject) {
    case "英语":
      return {
        section: "border-[rgba(42,157,143,0.22)] bg-[rgba(227,245,242,0.92)]",
        stripe: "bg-[rgba(42,157,143,0.95)]",
        cardGlow: "shadow-[0_10px_24px_rgba(42,157,143,0.06)]",
      };
    case "数学":
      return {
        section: "border-[rgba(91,155,213,0.22)] bg-[rgba(232,242,251,0.96)]",
        stripe: "bg-[rgba(91,155,213,0.95)]",
        cardGlow: "shadow-[0_10px_24px_rgba(91,155,213,0.06)]",
      };
    case "语文":
      return {
        section: "border-[rgba(232,115,90,0.22)] bg-[rgba(253,238,233,0.96)]",
        stripe: "bg-[rgba(232,115,90,0.95)]",
        cardGlow: "shadow-[0_10px_24px_rgba(232,115,90,0.06)]",
      };
    default:
      return {
        section: "border-[rgba(42,157,143,0.18)] bg-[rgba(242,246,248,0.96)]",
        stripe: "bg-[var(--primary)]",
        cardGlow: "shadow-[0_10px_24px_rgba(42,157,143,0.04)]",
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
      badgeClass: "bg-[rgba(76,175,80,0.12)] text-[rgba(53,133,57,1)]",
      metaText: "已完成",
    };
  }

  if (hasCurrent) {
    return {
      badgeClass: "bg-[rgba(255,169,74,0.14)] text-[rgba(217,117,12,1)]",
      metaText: "进行中",
    };
  }

  return {
    badgeClass: "bg-slate-100 text-slate-700",
    metaText: "待完成",
  };
}

export function ChildDashboard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [timerState, dispatchTimer] = useReducer(timerReducer, {
    mode: "focus",
    secondsLeft: FOCUS_MINUTES * 60,
    isRunning: false,
    notice: null,
  });
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => formatLocalDate(), []);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerTotalSeconds = getModeSeconds(timerState.mode);
  const timerProgress =
    ((timerTotalSeconds - timerState.secondsLeft) / timerTotalSeconds) * 100;
  const orderedTasks = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        const weightDiff = taskSortWeight(left.status) - taskSortWeight(right.status);

        if (weightDiff !== 0) {
          return weightDiff;
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }

        return left.created_at.localeCompare(right.created_at);
      }),
    [tasks],
  );
  const currentTaskId =
    orderedTasks.find((task) => !isCompletedStatus(task.status))?.id ?? null;
  const groupedOrderedTasks = useMemo(() => groupTasksBySubject(orderedTasks), [orderedTasks]);
  const completedTaskCount = tasks.filter((task) => isCompletedStatus(task.status)).length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const allTasksCompleted = tasks.length > 0 && completedTaskCount === tasks.length;

  function getAudioContext() {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    return audioContextRef.current;
  }

  function primeTimerAudio() {
    const context = getAudioContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }
  }

  const playTimerSound = useEffectEvent(() => {
    const context = getAudioContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }

    const notes = [784, 988, 1175];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const startAt = context.currentTime + index * 0.18;
      const endAt = startAt + 0.16;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.24, startAt + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);
    });
  });

  useEffect(() => {
    if (!timerState.isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      dispatchTimer({ type: "tick" });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [timerState.isRunning]);

  useEffect(() => {
    if (!timerState.isRunning || timerState.secondsLeft > 0) {
      return;
    }

    dispatchTimer({ type: "phaseComplete" });

    try {
      playTimerSound();
    } catch {}
  }, [timerState.isRunning, timerState.secondsLeft]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    let active = true;

    async function run() {
      setLoading(true);
      const { data, error } = await fetchTodayTasks(client, today);

      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setTasks((data as TaskRecord[]) ?? []);
        setMessage(null);
      }

      setLoading(false);
    }

    void run();

    return () => {
      active = false;
    };
  }, [supabase, today]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    const channel = client
      .channel(`tasks-child-${boardId}-${today}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `board_id=eq.${boardId}`,
        },
        async () => {
          const { data, error } = await fetchTodayTasks(client, today);

          if (error) {
            setMessage(error.message);
            return;
          }

          setTasks((data as TaskRecord[]) ?? []);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [supabase, today]);

  function updateTask(id: string, status: TaskStatus) {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        if (status === "in_progress") {
          primeTimerAudio();
          dispatchTimer({ type: "startFocus" });
        }

        if (status === "done_by_child" || status === "confirmed_by_parent") {
          dispatchTimer({ type: "reset" });
        }

        const { error } = await client
          .from("tasks")
          .update({ status, last_updated_by: "child" })
          .eq("id", id);

        if (error) {
          setMessage(error.message);
          return;
        }

        const { data } = await fetchTodayTasks(client, today);
        setTasks((data as TaskRecord[]) ?? []);
      })();
    });
  }

  function switchTimerMode(mode: TimerMode) {
    dispatchTimer({ type: "switchMode", mode });
  }

  function resetTimer() {
    dispatchTimer({ type: "reset" });
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-[var(--foreground)] md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-5 md:space-y-6">
        <section className="soft-shadow rounded-[1.9rem] border border-[var(--line)] bg-white px-6 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">
                学习看板
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-[2.25rem]">
                今天的学习任务
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                今天是 {formatDisplayDate(today)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:min-w-[16rem]">
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white px-4 py-3 shadow-sm">
                <div className="border-l-[3px] border-[var(--foreground)] pl-3">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">全部</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{tasks.length}</p>
                </div>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white px-4 py-3 shadow-sm">
                <div className="border-l-[3px] border-[var(--warning)] pl-3">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">进行中</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{inProgressCount}</p>
                </div>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--line)] bg-white px-4 py-3 shadow-sm">
                <div className="border-l-[3px] border-[var(--success)] pl-3">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">完成</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{completedTaskCount}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="soft-shadow rounded-[1.9rem] border border-[var(--line)] bg-white px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">
                番茄时钟
              </p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-[var(--foreground)] md:text-[2rem]">
                {timerState.mode === "focus" ? "专注 20 分钟" : "休息 5 分钟"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                {timerState.mode === "focus"
                  ? "专注做当前任务，到点后会自动提醒休息。"
                  : "休息一下，结束后会自动开始下一轮专注。"}
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              <div className="flex items-center gap-4">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white text-[var(--foreground)] md:h-32 md:w-32">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(var(--primary) ${timerProgress * 3.6}deg, rgba(229,229,224,0.92) 0deg)`,
                      mask:
                        "radial-gradient(circle at center, transparent 68%, black 69%)",
                      WebkitMask:
                        "radial-gradient(circle at center, transparent 68%, black 69%)",
                    }}
                  />
                  <div className="relative z-10 text-center">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--text-secondary)]">
                      {timerState.mode === "focus" ? "专注" : "休息"}
                    </p>
                    <p className="mt-2 text-3xl font-bold md:text-[2.2rem]">
                      {formatTimer(timerState.secondsLeft)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)] p-1">
                    <button
                      type="button"
                      onClick={() => switchTimerMode("focus")}
                      className={`rounded-[0.8rem] px-4 py-2 text-sm font-semibold md:text-base ${
                        timerState.mode === "focus"
                          ? "bg-[var(--primary)] text-white"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      专注
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTimerMode("break")}
                      className={`rounded-[0.8rem] px-4 py-2 text-sm font-semibold md:text-base ${
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
                      onClick={() => {
                        primeTimerAudio();
                        dispatchTimer({ type: "start" });
                      }}
                      disabled={timerState.isRunning}
                      className="rounded-[1rem] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400 md:text-base"
                    >
                      开始
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchTimer({ type: "pause" })}
                      disabled={!timerState.isRunning}
                      className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] disabled:bg-slate-100/80 disabled:text-slate-400 md:text-base"
                    >
                      暂停
                    </button>
                    <button
                      type="button"
                      onClick={resetTimer}
                      className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] md:text-base"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </div>

              {timerState.notice ? (
                <div className="rounded-[1rem] bg-[var(--card-alt)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] md:text-base">
                  {timerState.notice}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {!supabase ? (
          <div className="mt-4">
            <SetupNotice />
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-[1.25rem] bg-rose-100 px-5 py-4 text-base font-semibold text-rose-900">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[1.8rem] bg-white p-8 text-center text-xl text-slate-500 shadow-lg">
            正在加载今天的任务...
          </div>
        ) : tasks.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="今天的任务还没到"
              description="家长一添加任务，这里就会马上出现。"
            />
          </div>
        ) : (
          <section className="space-y-4 md:space-y-5">
            <div className="px-1">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--text-secondary)]">
                今日任务
              </p>
            </div>

            <div className="grid gap-5 md:gap-6">
              {groupedOrderedTasks.map((group) => (
                <section key={group.subject} className="space-y-3">
                  {(() => {
                    const sectionState = subjectSectionState(group.tasks, currentTaskId);
                    const theme = subjectTheme(group.subject);

                    return (
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
                            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]">
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
                    );
                  })()}
                  <div className="grid gap-4 md:gap-5">
                    {group.tasks.map((task, index) => {
                      const labels = actionLabels(task.status);
                      const meta = TASK_STATUS_META[task.status];
                      const isCompleted = isCompletedStatus(task.status);
                      const isCurrent = task.id === currentTaskId && !isCompleted;
                      const theme = subjectTheme(group.subject);
                      const primaryButtonClass = isCompleted
                        ? "border border-[rgba(76,175,80,0.18)] bg-[rgba(228,246,229,0.95)] text-[rgba(53,133,57,1)]"
                        : "border border-[rgba(76,175,80,0.18)] bg-[rgba(228,246,229,0.95)] text-[rgba(53,133,57,1)] shadow-[0_8px_18px_rgba(76,175,80,0.08)]";
                      const helpButtonClass =
                        task.status === "needs_help"
                          ? "border border-[rgba(245,166,35,0.28)] bg-[rgba(255,239,208,0.98)] text-[rgba(201,107,8,1)]"
                          : "border border-[rgba(245,166,35,0.28)] bg-[rgba(255,247,229,0.98)] text-[rgba(201,107,8,1)]";
                      const weakButtonClass =
                        "border border-[var(--line)] bg-white text-[var(--text-secondary)]";

                      return (
                        <article
                          key={task.id}
                          className={`soft-shadow relative overflow-hidden rounded-[1.5rem] border p-5 md:p-6 ${
                            isCurrent
                              ? `border-[rgba(26,26,26,0.18)] bg-white shadow-[0_16px_36px_rgba(26,26,26,0.08)] ${theme.cardGlow}`
                              : isCompleted
                                ? `border-[var(--line)] bg-[var(--card-alt)] opacity-80 ${theme.cardGlow}`
                                : `border-[var(--line)] bg-white ${theme.cardGlow}`
                          }`}
                        >
                          <span className={`absolute inset-y-0 left-0 w-1 ${theme.stripe}`} />
                          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                            <div className="pl-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">
                                  任务 {index + 1}
                                </p>
                                {isCurrent ? (
                                  <span className="rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-semibold tracking-[0.08em] text-white">
                                    当前任务
                                  </span>
                                ) : null}
                              </div>
                              <h2
                                className={`mt-3 text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-[2.2rem] ${
                                  isCompleted ? "line-through decoration-2" : ""
                                }`}
                              >
                                {task.title}
                              </h2>
                              {task.details ? (
                                <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
                                  {task.details}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3">
                              {isCompleted ? (
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(228,246,229,0.95)] text-xl">
                                  ✅
                                </span>
                              ) : null}
                              <div
                                className={`rounded-full px-4 py-2 text-sm font-semibold md:text-base ${
                                  isCompletedStatus(task.status)
                                    ? "bg-[rgba(228,246,229,0.95)] text-[rgba(53,133,57,1)]"
                                    : task.status === "needs_help"
                                      ? "bg-[rgba(255,247,229,0.98)] text-[rgba(201,107,8,1)]"
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
                              onClick={() => updateTask(task.id, "in_progress")}
                              className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-lg font-semibold disabled:bg-slate-200 disabled:text-slate-400 md:text-[1.15rem] ${weakButtonClass} ${
                                isCompleted ? "opacity-70" : ""
                              }`}
                            >
                              {labels[0]}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => updateTask(task.id, "done_by_child")}
                              className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-xl font-semibold disabled:bg-slate-200 disabled:text-slate-400 md:text-[1.2rem] ${primaryButtonClass}`}
                            >
                              {labels[1]}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => updateTask(task.id, "needs_help")}
                              className={`min-h-[3.75rem] rounded-[1rem] px-4 py-4 text-lg font-semibold disabled:bg-slate-200 disabled:text-slate-400 md:text-[1.15rem] ${helpButtonClass}`}
                            >
                              {labels[2]}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {allTasksCompleted ? (
              <section className="soft-shadow rounded-[1.9rem] border border-[var(--line)] bg-white px-6 py-10 text-center md:px-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,244,214,0.96)] text-3xl shadow-[0_10px_24px_rgba(245,166,35,0.12)]">
                  🎉
                </div>
                <h2 className="mt-5 text-3xl font-semibold text-[var(--foreground)]">
                  太棒了，今天的任务全部搞定！
                </h2>
                <p className="mt-3 text-base text-[var(--text-secondary)]">
                  休息一下吧，明天继续加油。
                </p>
              </section>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
