"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { TASK_STATUS_META } from "@/lib/task-status";
import { formatDisplayDate, formatLocalDate } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TaskRecord, TaskStatus } from "@/types/task";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

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

export function ChildDashboard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => formatLocalDate(), []);

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
