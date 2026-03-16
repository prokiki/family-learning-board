"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

export function ChildDashboard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerNotice, setTimerNotice] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => formatLocalDate(), []);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerTotalSeconds =
    timerMode === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60;
  const timerProgress = ((timerTotalSeconds - secondsLeft) / timerTotalSeconds) * 100;

  function playTimerSound() {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    const context = audioContextRef.current;

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
  }

  useEffect(() => {
    if (!isTimerRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          const nextMode: TimerMode = timerMode === "focus" ? "break" : "focus";
          const nextSeconds =
            nextMode === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60;

          setTimerMode(nextMode);
          setSecondsLeft(nextSeconds);
          setTimerNotice(
            timerMode === "focus"
              ? "专注时间到啦，休息 5 分钟吧。"
              : "休息时间结束，开始下一轮专注。",
          );
          playTimerSound();
          return nextSeconds;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isTimerRunning, timerMode]);

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
    setTimerMode(mode);
    setIsTimerRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60);
    setTimerNotice(null);
  }

  function resetTimer() {
    setIsTimerRunning(false);
    setSecondsLeft(timerTotalSeconds);
    setTimerNotice(null);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.25),rgba(255,255,255,1)_55%)] px-4 py-5 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl">
        <section className="soft-shadow rounded-[2rem] border border-white/70 bg-white/90 p-6 md:p-8">
          <p className="text-base font-semibold text-sky-700">今日任务</p>
          <h1 className="font-title mt-3 text-4xl leading-tight text-slate-950 md:text-6xl">
            放学啦，
            <br />
            一步一步来。
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600 md:text-2xl">
            今天是 {formatDisplayDate(today)}
          </p>
        </section>

        <section className="soft-shadow mt-6 rounded-[2rem] border border-cyan-100 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(255,255,255,0.96),rgba(250,204,21,0.18))] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-base font-semibold uppercase tracking-[0.2em] text-sky-700">
                番茄时钟
              </p>
              <h2 className="font-title mt-3 text-3xl leading-tight text-slate-950 md:text-5xl">
                {timerMode === "focus" ? "专心学习时间" : "休息一下时间"}
              </h2>
              <p className="mt-3 text-lg leading-8 text-slate-600 md:text-2xl">
                {timerMode === "focus"
                  ? "先专心做一会儿，再休息，会更轻松。"
                  : "喝口水，活动一下，准备下一轮。"}
              </p>
            </div>

            <div className="rounded-[2rem] bg-white/90 p-5 shadow-[0_18px_40px_rgba(14,165,233,0.14)]">
              <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border-[12px] border-white bg-slate-950 text-white md:h-60 md:w-60">
                <div
                  className="absolute h-52 w-52 rounded-full md:h-60 md:w-60"
                  style={{
                    background: `conic-gradient(#0f172a ${timerProgress * 3.6}deg, rgba(226,232,240,0.7) 0deg)`,
                    mask:
                      "radial-gradient(circle at center, transparent 68%, black 69%)",
                    WebkitMask:
                      "radial-gradient(circle at center, transparent 68%, black 69%)",
                  }}
                />
                <div className="relative z-10 text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
                    {timerMode === "focus" ? `${FOCUS_MINUTES} 分钟专注` : `${BREAK_MINUTES} 分钟休息`}
                  </p>
                  <p className="font-title mt-3 text-5xl md:text-6xl">
                    {formatTimer(secondsLeft)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_1.2fr_1.2fr]">
            <button
              type="button"
              onClick={() => switchTimerMode("focus")}
              className={`min-h-16 rounded-[1.5rem] px-4 py-4 text-xl font-bold md:text-2xl ${
                timerMode === "focus"
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              专注 20 分钟
            </button>
            <button
              type="button"
              onClick={() => switchTimerMode("break")}
              className={`min-h-16 rounded-[1.5rem] px-4 py-4 text-xl font-bold md:text-2xl ${
                timerMode === "break"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-white text-slate-700"
              }`}
            >
              休息 5 分钟
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerNotice(null);
                setIsTimerRunning(true);
              }}
              disabled={isTimerRunning}
              className="min-h-16 rounded-[1.5rem] bg-emerald-400 px-4 py-4 text-xl font-bold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400 md:text-2xl"
            >
              开始循环
            </button>
            <button
              type="button"
              onClick={() => setIsTimerRunning(false)}
              disabled={!isTimerRunning}
              className="min-h-16 rounded-[1.5rem] bg-sky-200 px-4 py-4 text-xl font-bold text-slate-950 disabled:bg-slate-200 disabled:text-slate-400 md:text-2xl"
            >
              暂停
            </button>
            <button
              type="button"
              onClick={resetTimer}
              className="min-h-16 rounded-[1.5rem] bg-white px-4 py-4 text-xl font-bold text-slate-700 md:text-2xl"
            >
              重置
            </button>
          </div>

          {timerNotice ? (
            <div className="mt-4 rounded-[1.5rem] bg-amber-300 px-5 py-4 text-center text-xl font-bold text-slate-950 md:text-2xl">
              {timerNotice}
            </div>
          ) : null}
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
          <div className="mt-6 grid gap-5">
            {tasks.map((task, index) => {
              const labels = actionLabels(task.status);
              const meta = TASK_STATUS_META[task.status];

              return (
                <article
                  key={task.id}
                  className="soft-shadow rounded-[2rem] border border-slate-200 bg-white p-5 md:p-7"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                        任务 {index + 1}
                      </p>
                      <h2 className="mt-3 font-title text-3xl leading-tight text-slate-950 md:text-5xl">
                        {task.title}
                      </h2>
                      {task.details ? (
                        <p className="mt-3 text-lg leading-8 text-slate-600 md:text-2xl">
                          {task.details}
                        </p>
                      ) : null}
                    </div>
                    <div className={`rounded-full px-4 py-2 text-base font-bold ${meta.tone}`}>
                      {meta.childLabel}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "in_progress")}
                      className="min-h-16 rounded-[1.5rem] bg-slate-950 px-4 py-4 text-xl font-bold text-white disabled:bg-slate-300 md:text-2xl"
                    >
                      {labels[0]}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "done_by_child")}
                      className="min-h-16 rounded-[1.5rem] bg-emerald-400 px-4 py-4 text-xl font-bold text-slate-950 disabled:bg-slate-200 md:text-2xl"
                    >
                      {labels[1]}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateTask(task.id, "needs_help")}
                      className="min-h-16 rounded-[1.5rem] bg-amber-300 px-4 py-4 text-xl font-bold text-slate-950 disabled:bg-slate-200 md:text-2xl"
                    >
                      {labels[2]}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
