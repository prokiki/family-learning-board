"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { StatusPill } from "@/components/status-pill";
import { formatDisplayDate, formatLocalDate } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseHomeworkText } from "@/lib/task-parser";
import type { TaskDraft, TaskRecord, TaskStatus } from "@/types/task";
import type { SupabaseClient } from "@supabase/supabase-js";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

function summarizeProgress(tasks: TaskRecord[]) {
  return {
    total: tasks.length,
    done: tasks.filter(
      (task) =>
        task.status === "done_by_child" || task.status === "confirmed_by_parent",
    ).length,
    help: tasks.filter((task) => task.status === "needs_help").length,
  };
}

async function fetchTodayTasks(
  supabase: SupabaseClient,
  dueDate: string,
) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .eq("due_date", dueDate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export function ParentDashboard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [rawText, setRawText] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDetails, setManualDetails] = useState("");
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
      .channel(`tasks-parent-${boardId}-${today}`)
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

  async function insertTasks(drafts: TaskDraft[], source: "manual" | "imported") {
    if (!supabase || drafts.length === 0) {
      return;
    }

    const client: SupabaseClient = supabase;

    const payload = drafts.map((draft, index) => ({
      board_id: boardId,
      due_date: today,
      title: draft.title,
      details: draft.details ?? null,
      status: "pending" as TaskStatus,
      sort_order: tasks.length + index,
      source,
      last_updated_by: "parent" as const,
    }));

    const { error } = await client.from("tasks").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`已添加 ${drafts.length} 条任务`);
    setManualTitle("");
    setManualDetails("");
    setRawText("");
    const { data } = await fetchTodayTasks(client, today);
    setTasks((data as TaskRecord[]) ?? []);
  }

  function handleManualCreate() {
    startTransition(() => {
      void insertTasks(
        [{ title: manualTitle.trim(), details: manualDetails.trim() || undefined }].filter(
          (task) => task.title,
        ),
        "manual",
      );
    });
  }

  function handleImport() {
    const drafts = parseHomeworkText(rawText);

    startTransition(() => {
      void insertTasks(drafts, "imported");
    });
  }

  function updateTaskStatus(id: string, status: TaskStatus) {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const { error } = await client
          .from("tasks")
          .update({ status, last_updated_by: "parent" })
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

  function deleteTask(id: string) {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const { error } = await client.from("tasks").delete().eq("id", id);

        if (error) {
          setMessage(error.message);
          return;
        }

        const { data } = await fetchTodayTasks(client, today);
        setTasks((data as TaskRecord[]) ?? []);
      })();
    });
  }

  const progress = summarizeProgress(tasks);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="card-surface soft-shadow rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Parent Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950 md:text-5xl">
              今天的学习任务
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
              {formatDisplayDate(today)}，固定设备会实时同步这里的内容。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
              <p className="text-sm text-slate-300">总任务</p>
              <p className="mt-1 text-3xl font-bold">{progress.total}</p>
            </div>
            <div className="rounded-[1.5rem] bg-emerald-100 px-4 py-4 text-emerald-950">
              <p className="text-sm">已推进</p>
              <p className="mt-1 text-3xl font-bold">{progress.done}</p>
            </div>
            <div className="rounded-[1.5rem] bg-rose-100 px-4 py-4 text-rose-950">
              <p className="text-sm">待协助</p>
              <p className="mt-1 text-3xl font-bold">{progress.help}</p>
            </div>
          </div>
        </div>
      </section>

      {!supabase ? <SetupNotice /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.3fr]">
        <div className="space-y-6">
          <div className="card-surface soft-shadow rounded-[1.75rem] p-6">
            <h2 className="text-2xl font-bold text-slate-950">手动新增</h2>
            <div className="mt-4 space-y-3">
              <input
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="例如：完成数学口算 2 页"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-0 focus:border-sky-400"
              />
              <textarea
                value={manualDetails}
                onChange={(event) => setManualDetails(event.target.value)}
                placeholder="可选：备注难点、页码、截止时间"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400"
              />
              <button
                type="button"
                disabled={!manualTitle.trim() || !supabase || isPending}
                onClick={handleManualCreate}
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                添加到今日任务
              </button>
            </div>
          </div>

          <div className="card-surface soft-shadow rounded-[1.75rem] p-6">
            <h2 className="text-2xl font-bold text-slate-950">导入老师作业文本</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              支持把钉钉群里复制的文本贴进来，系统按换行、编号和语义做基础拆分。
            </p>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="例如：1. 语文：朗读课文第 5 课；2. 数学：口算 2 页；3. 英语：听读 15 分钟"
              rows={8}
              className="mt-4 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-base outline-none focus:border-sky-400"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                预计拆分为 {parseHomeworkText(rawText).length} 条任务
              </p>
              <button
                type="button"
                disabled={!rawText.trim() || !supabase || isPending}
                onClick={handleImport}
                className="rounded-2xl bg-amber-400 px-5 py-3 text-base font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-200"
              >
                拆分并导入
              </button>
            </div>
          </div>
        </div>

        <div className="card-surface soft-shadow rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">孩子端实时状态</h2>
              <p className="mt-1 text-sm text-slate-500">
                家长可在这里确认完成，或删除当天任务。
              </p>
            </div>
            {message ? (
              <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-900">
                {message}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-6 rounded-[1.5rem] bg-slate-100 p-6 text-slate-500">
              正在同步任务...
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="今天还没有任务"
                description="先在左侧添加任务，孩子端会立即出现大字卡片。"
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={task.status} />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {task.source === "imported" ? "导入" : "手动"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-bold text-slate-950">
                        {task.title}
                      </h3>
                      {task.details ? (
                        <p className="mt-2 text-base leading-7 text-slate-600">
                          {task.details}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 md:min-w-44">
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task.id, "confirmed_by_parent")}
                        className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        家长确认完成
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task.id, "pending")}
                        className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        重置为待开始
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
                      >
                        删除任务
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
