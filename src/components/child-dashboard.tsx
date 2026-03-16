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
    orderedTasks.find((task) => !isCompletedStatus(task.status))?.id ??
    orderedTasks[0]?.id ??
    null;
  const groupedOrderedTasks = useMemo(() => groupTasksBySubject(orderedTasks), [orderedTasks]);

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#eef4fb_18%,#f8fafc_100%)] px-4 py-6 text-slate-900 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
        <section className="soft-shadow rounded-[2rem] border border-slate-200/80 bg-white/92 px-6 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Child Board
              </p>
              <h1 className="font-title mt-2 text-3xl leading-tight text-slate-950 md:text-5xl">
                先看第一项，
                <br />
                一项一项完成。
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600 md:text-xl">
                今天是 {formatDisplayDate(today)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:min-w-[18rem]">
              <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-center text-white">
                <p className="text-sm text-slate-300">全部</p>
                <p className="mt-1 text-3xl font-bold">{tasks.length}</p>
              </div>
              <div className="rounded-[1.5rem] bg-slate-100 px-4 py-4 text-center text-slate-700">
                <p className="text-sm">进行中</p>
                <p className="mt-1 text-3xl font-bold">
                  {tasks.filter((task) => task.status === "in_progress").length}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-emerald-50 px-4 py-4 text-center text-emerald-800">
                <p className="text-sm">完成</p>
                <p className="mt-1 text-3xl font-bold">
                  {tasks.filter((task) => isCompletedStatus(task.status)).length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="soft-shadow rounded-[2rem] border border-slate-200/80 bg-white/88 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                番茄时钟
              </p>
              <h2 className="font-title mt-2 text-2xl leading-tight text-slate-950 md:text-3xl">
                {timerState.mode === "focus" ? "专注 20 分钟" : "休息 5 分钟"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 md:text-lg">
                {timerState.mode === "focus"
                  ? "专注做当前任务，到点后会自动提醒休息。"
                  : "休息一下，结束后会自动开始下一轮专注。"}
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              <div className="flex items-center gap-4">
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] md:h-36 md:w-36">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#0f172a ${timerProgress * 3.6}deg, rgba(226,232,240,0.82) 0deg)`,
                      mask:
                        "radial-gradient(circle at center, transparent 66%, black 67%)",
                      WebkitMask:
                        "radial-gradient(circle at center, transparent 66%, black 67%)",
                    }}
                  />
                  <div className="relative z-10 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      {timerState.mode === "focus" ? "专注" : "休息"}
                    </p>
                    <p className="font-title mt-2 text-3xl md:text-4xl">
                      {formatTimer(timerState.secondsLeft)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => switchTimerMode("focus")}
                      className={`rounded-full px-4 py-2 text-sm font-bold md:text-base ${
                        timerState.mode === "focus"
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      专注
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTimerMode("break")}
                      className={`rounded-full px-4 py-2 text-sm font-bold md:text-base ${
                        timerState.mode === "break"
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700"
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
                      className="rounded-[1.1rem] bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400 md:text-base"
                    >
                      开始
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchTimer({ type: "pause" })}
                      disabled={!timerState.isRunning}
                      className="rounded-[1.1rem] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 disabled:bg-slate-100/80 disabled:text-slate-400 md:text-base"
                    >
                      暂停
                    </button>
                    <button
                      type="button"
                      onClick={resetTimer}
                      className="rounded-[1.1rem] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 md:text-base"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </div>

              {timerState.notice ? (
                <div className="rounded-[1.25rem] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800 md:text-base">
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
          <div className="mt-4 rounded-[1.5rem] bg-rose-100 px-5 py-4 text-base font-semibold text-rose-900">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[2rem] bg-white p-8 text-center text-xl text-slate-500 shadow-lg">
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
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  今日任务
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 md:text-3xl">
                  先做最上面的当前任务
                </h2>
              </div>
            </div>

            <div className="grid gap-5 md:gap-6">
            {groupedOrderedTasks.map((group) => (
              <section key={group.subject} className="space-y-3">
                <div className="px-1">
                  <h3 className="text-lg font-bold text-slate-700 md:text-xl">{group.subject}</h3>
                </div>
                <div className="grid gap-4 md:gap-5">
            {group.tasks.map((task, index) => {
              const labels = actionLabels(task.status);
              const meta = TASK_STATUS_META[task.status];
              const isCurrent = task.id === currentTaskId;
              const isCompleted = isCompletedStatus(task.status);
              const primaryButtonClass = isCompleted
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.22)]";
              const helpButtonClass =
                task.status === "needs_help"
                  ? "bg-amber-300 text-slate-950"
                  : "bg-amber-100 text-amber-900";
              const weakButtonClass = "bg-slate-100 text-slate-700";

              return (
                <article
                  key={task.id}
                  className={`soft-shadow rounded-[2rem] border p-5 md:p-7 ${
                    isCurrent
                      ? "border-slate-900 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.12)]"
                      : isCompleted
                        ? "border-slate-200 bg-slate-50/90 opacity-78"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          任务 {index + 1}
                        </p>
                        {isCurrent ? (
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                            当前任务
                          </span>
                        ) : null}
                      </div>
                      <h2 className="font-title mt-3 text-3xl leading-tight text-slate-950 md:text-5xl">
                        {task.title}
                      </h2>
                      {task.details ? (
                        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 md:text-xl">
                          {task.details}
                        </p>
                      ) : null}
                    </div>
                    <div
                      className={`rounded-full px-4 py-2 text-sm font-bold md:text-base ${meta.tone}`}
                    >
                      {meta.childLabel}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_0.9fr]">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "in_progress")}
                      className={`min-h-16 rounded-[1.5rem] px-4 py-4 text-lg font-bold disabled:bg-slate-200 disabled:text-slate-400 md:text-2xl ${weakButtonClass}`}
                    >
                      {labels[0]}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "done_by_child")}
                      className={`min-h-16 rounded-[1.5rem] px-4 py-4 text-xl font-bold disabled:bg-slate-200 disabled:text-slate-400 md:text-2xl ${primaryButtonClass}`}
                    >
                      {labels[1]}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "needs_help")}
                      className={`min-h-16 rounded-[1.5rem] px-4 py-4 text-lg font-bold disabled:bg-slate-200 disabled:text-slate-400 md:text-2xl ${helpButtonClass}`}
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
          </section>
        )}
      </div>
    </div>
  );
}
