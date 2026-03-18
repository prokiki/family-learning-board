"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { SetupNotice } from "@/components/setup-notice";
import { StatusPill } from "@/components/status-pill";
import { formatDisplayDate, formatLocalDate } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { flattenHomeworkGroups, parseHomeworkGroups } from "@/lib/task-parser";
import type {
  SubjectTaskGroup,
  TaskDraft,
  TaskRecord,
  TaskStatus,
  TaskSource,
  TaskTemplateRecord,
} from "@/types/task";
import type { SupabaseClient } from "@supabase/supabase-js";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

function subjectPillClass(subject: string | null) {
  switch (subject) {
    case "语文":
      return "bg-[rgba(232,115,90,0.12)] text-[rgba(175,78,57,1)]";
    case "数学":
      return "bg-[rgba(91,155,213,0.12)] text-[rgba(58,107,160,1)]";
    case "英语":
      return "bg-[rgba(42,157,143,0.12)] text-[rgba(31,118,108,1)]";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function sourceLabel(source: TaskSource) {
  if (source === "imported") {
    return "导入";
  }

  if (source === "template") {
    return "固定";
  }

  return "手动";
}

function templateStateClass(isActive: boolean) {
  return isActive
    ? "bg-[rgba(76,175,80,0.12)] text-[rgba(53,133,57,1)]"
    : "bg-slate-100 text-[var(--text-secondary)]";
}

function sourcePillClass(source: TaskSource) {
  if (source === "imported") {
    return "bg-[rgba(91,155,213,0.12)] text-[rgba(58,107,160,1)]";
  }

  if (source === "template") {
    return "bg-[rgba(42,157,143,0.12)] text-[rgba(31,118,108,1)]";
  }

  return "bg-slate-100 text-[var(--text-secondary)]";
}

function subjectAccentClass(subject: string | null) {
  switch (subject) {
    case "语文":
      return "before:bg-[rgba(232,115,90,0.92)]";
    case "数学":
      return "before:bg-[rgba(91,155,213,0.92)]";
    case "英语":
      return "before:bg-[rgba(42,157,143,0.92)]";
    default:
      return "before:bg-[var(--primary)]";
  }
}

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

async function fetchTaskTemplates(supabase: SupabaseClient) {
  return supabase
    .from("task_templates")
    .select("*")
    .eq("board_id", boardId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export function ParentDashboard() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateRecord[]>([]);
  const [rawText, setRawText] = useState("");
  const [importGroups, setImportGroups] = useState<SubjectTaskGroup[]>([]);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDetails, setManualDetails] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateDetails, setTemplateDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const today = useMemo(() => formatLocalDate(), []);
  const importDrafts = useMemo(() => flattenHomeworkGroups(importGroups), [importGroups]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    let active = true;

    async function run() {
      setLoading(true);
      const [{ data, error }, templatesResult] = await Promise.all([
        fetchTodayTasks(client, today),
        fetchTaskTemplates(client),
      ]);

      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setTasks((data as TaskRecord[]) ?? []);
        setTemplates((templatesResult.data as TaskTemplateRecord[]) ?? []);
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
    setImportGroups(parseHomeworkGroups(rawText));
  }, [rawText]);

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
          const { data: templateData } = await fetchTaskTemplates(client);

          if (error) {
            setMessage(error.message);
            return;
          }

          setTasks((data as TaskRecord[]) ?? []);
          setTemplates((templateData as TaskTemplateRecord[]) ?? []);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [supabase, today]);

  async function insertTasks(drafts: TaskDraft[], source: TaskSource) {
    if (!supabase || drafts.length === 0) {
      return;
    }

    const client: SupabaseClient = supabase;

    const payload = drafts.map((draft, index) => ({
      board_id: boardId,
      due_date: today,
      subject: draft.subject ?? null,
      title: draft.title,
      details: draft.details ?? null,
      template_id: draft.templateId ?? null,
      status: "pending" as TaskStatus,
      sort_order: tasks.length + index,
      source,
      last_updated_by: "parent" as const,
    }));

    const { error } = await client.from("tasks").insert(payload);

    if (error) {
      if (error.message.includes("subject")) {
        setMessage("请先在 Supabase 执行 002_add_subject_to_tasks.sql，再刷新页面重试。");
      } else {
        setMessage(error.message);
      }
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
    startTransition(() => {
      void insertTasks(
        importDrafts.filter((draft) => draft.title.trim()),
        "imported",
      );
    });
  }

  function updateImportedTask(subjectIndex: number, taskIndex: number, title: string) {
    setImportGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex !== subjectIndex
          ? group
          : {
              ...group,
              tasks: group.tasks.map((task, currentTaskIndex) =>
                currentTaskIndex !== taskIndex ? task : { ...task, title },
              ),
            },
      ),
    );
  }

  function deleteImportedTask(subjectIndex: number, taskIndex: number) {
    setImportGroups((current) =>
      current
        .map((group, groupIndex) =>
          groupIndex !== subjectIndex
            ? group
            : {
                ...group,
                tasks: group.tasks.filter((_, currentTaskIndex) => currentTaskIndex !== taskIndex),
              },
        )
        .filter((group) => group.tasks.length > 0),
    );
  }

  function addImportedTask(subjectIndex: number) {
    setImportGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex !== subjectIndex
          ? group
          : {
              ...group,
              tasks: [...group.tasks, { subject: group.subject, title: "" }],
            },
      ),
    );
  }

  function createTemplate() {
    if (!supabase || !templateTitle.trim()) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const payload = {
          board_id: boardId,
          subject: templateSubject.trim() || null,
          title: templateTitle.trim(),
          details: templateDetails.trim() || null,
          is_active: true,
          sort_order: templates.length,
        };

        const { error } = await client.from("task_templates").insert(payload);

        if (error) {
          setMessage(error.message);
          return;
        }

        setTemplateTitle("");
        setTemplateSubject("");
        setTemplateDetails("");
        setMessage("已新增固定任务模板");
        const { data } = await fetchTaskTemplates(client);
        setTemplates((data as TaskTemplateRecord[]) ?? []);
      })();
    });
  }

  function toggleTemplate(id: string, isActive: boolean) {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const { error } = await client
          .from("task_templates")
          .update({ is_active: !isActive })
          .eq("id", id);

        if (error) {
          setMessage(error.message);
          return;
        }

        const { data } = await fetchTaskTemplates(client);
        setTemplates((data as TaskTemplateRecord[]) ?? []);
      })();
    });
  }

  function deleteTemplate(id: string) {
    if (!supabase) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const { error } = await client.from("task_templates").delete().eq("id", id);

        if (error) {
          setMessage(error.message);
          return;
        }

        const { data } = await fetchTaskTemplates(client);
        setTemplates((data as TaskTemplateRecord[]) ?? []);
      })();
    });
  }

  function addTemplatesToToday() {
    const activeTemplates = templates.filter((template) => template.is_active);
    const existingTemplateIds = new Set(
      tasks.map((task) => task.template_id).filter((templateId): templateId is string => Boolean(templateId)),
    );
    const drafts: TaskDraft[] = activeTemplates
      .filter((template) => !existingTemplateIds.has(template.id))
      .map((template) => ({
        templateId: template.id,
        subject: template.subject ?? undefined,
        title: template.title,
        details: template.details ?? undefined,
      }));

    if (drafts.length === 0) {
      setMessage("今天的固定任务已经都加入了");
      return;
    }

    startTransition(() => {
      void insertTasks(drafts, "template");
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
      <section className="soft-shadow rounded-[1.75rem] border border-[var(--line)] bg-card px-6 py-6 md:px-8 md:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">PARENT</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-[2rem]">
              今天的学习任务
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              {formatDisplayDate(today)}，固定设备会实时同步这里的内容。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:min-w-[320px]">
            <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/45 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-1 rounded-full bg-[var(--foreground)]" />
                <div>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{progress.total}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">总任务</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1rem] border border-[var(--line)] bg-[rgba(76,175,80,0.05)] px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-1 rounded-full bg-[var(--success)]" />
                <div>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{progress.done}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">已推进</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1rem] border border-[var(--line)] bg-[rgba(245,166,35,0.06)] px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-1 rounded-full bg-[var(--warning)]" />
                <div>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{progress.help}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">待协助</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!supabase ? <SetupNotice /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.3fr]">
        <div className="space-y-6">
          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--primary)]">MANUAL</p>
                <h2 className="mt-2 text-[1.5rem] font-semibold text-[var(--foreground)]">手动新增</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  适合临时增加当天的新任务，孩子端会马上同步显示。
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
              <div className="space-y-3">
              <input
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="例如：完成数学口算 2 页"
                className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              />
              <textarea
                value={manualDetails}
                onChange={(event) => setManualDetails(event.target.value)}
                placeholder="可选：备注难点、页码、截止时间"
                rows={3}
                className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              />
              <button
                type="button"
                disabled={!manualTitle.trim() || !supabase || isPending}
                onClick={handleManualCreate}
                className="w-full rounded-[12px] bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                添加到今日任务
              </button>
              </div>
            </div>
          </div>

          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--primary)]">TEMPLATE</p>
                <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">每天固定任务</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  先维护常用模板，再一键加入今天任务，避免每天重复录入。
                </p>
              </div>
              <button
                type="button"
                disabled={!supabase || isPending || templates.filter((item) => item.is_active).length === 0}
                onClick={addTemplatesToToday}
                className="rounded-[12px] border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                一键加入
              </button>
            </div>

            <div className="mt-4 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-[1.5fr_0.9fr]">
                <input
                  value={templateTitle}
                  onChange={(event) => setTemplateTitle(event.target.value)}
                  placeholder="固定任务标题，例如：英语听读 15 分钟"
                  className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                />
                <input
                  value={templateSubject}
                  onChange={(event) => setTemplateSubject(event.target.value)}
                  placeholder="学科，可选，例如：英语"
                  className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                />
              </div>
              <textarea
                value={templateDetails}
                onChange={(event) => setTemplateDetails(event.target.value)}
                placeholder="备注，可选"
                rows={2}
                className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              />
              <button
                type="button"
                disabled={!supabase || !templateTitle.trim() || isPending}
                onClick={createTemplate}
                className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-white px-5 py-3 text-base font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存为固定任务
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-[1rem] bg-[var(--card-alt)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                  还没有固定任务模板，先加一条每天都会出现的常规任务。
                </div>
              ) : (
                templates.map((template) => (
                  <article
                    key={template.id}
                    className={`relative overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/40 p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${subjectAccentClass(template.subject)}`}
                  >
                    <div className="flex flex-col gap-4 pl-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {template.subject ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subjectPillClass(template.subject)}`}>
                              {template.subject}
                            </span>
                          ) : null}
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${templateStateClass(template.is_active)}`}>
                            {template.is_active ? "启用中" : "已停用"}
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-[var(--foreground)] md:text-lg">
                          {template.title}
                        </h3>
                        {template.details ? (
                          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                            {template.details}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => toggleTemplate(template.id, template.is_active)}
                          className="rounded-[12px] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
                        >
                          {template.is_active ? "停用" : "启用"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTemplate(template.id)}
                          className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--error)]"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--primary)]">IMPORT</p>
            <h2 className="mt-2 text-[1.5rem] font-semibold text-[var(--foreground)]">导入预览</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              支持把钉钉群里的文字先按学科分组，再拆成孩子可执行的子任务。
            </p>
            <div className="mt-4 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="例如：语文：预习第5课，抄写生字两遍。数学：完成口算2页，订正错题。"
                rows={8}
                className="min-h-[120px] w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-4 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              />
            </div>
            <div className="mt-5 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/50 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">任务拆分预览</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    上方保留原始文本，下面按学科展示并支持逐条校对。
                  </p>
                </div>
                <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--text-secondary)]">
                  共 {importDrafts.filter((draft) => draft.title.trim()).length} 条子任务
                </p>
              </div>

              {importGroups.length === 0 ? (
                <div className="mt-4 rounded-[1rem] bg-[var(--card-alt)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                  贴入老师作业后，这里会显示按学科分组的预览。
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {importGroups.map((group, subjectIndex) => (
                    <section
                      key={`${group.subject}-${subjectIndex}`}
                      className="overflow-hidden rounded-[1rem] border border-[var(--line)] bg-white"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-[var(--line-light)] bg-[var(--card-alt)]/70 px-4 py-3">
                        <div className="min-w-0">
                          <div>
                            <h4 className="text-base font-semibold text-[var(--foreground)]">{group.subject}</h4>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {group.tasks.length} 条可执行子任务
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addImportedTask(subjectIndex)}
                          className="rounded-[12px] border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]"
                        >
                          补一条
                        </button>
                      </div>
                      <div className="space-y-2 p-4">
                        {group.tasks.map((task, taskIndex) => (
                          <div
                            key={`${group.subject}-${taskIndex}`}
                            className="flex items-center gap-2"
                          >
                            <span className="w-8 text-center text-sm font-semibold text-slate-400">
                              {taskIndex + 1}
                            </span>
                            <input
                              value={task.title}
                              onChange={(event) =>
                                updateImportedTask(subjectIndex, taskIndex, event.target.value)
                              }
                              placeholder={`补充 ${group.subject} 子任务`}
                              className="flex-1 rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                            />
                            <button
                              type="button"
                              onClick={() => deleteImportedTask(subjectIndex, taskIndex)}
                              className="rounded-[10px] px-3 py-2 text-sm font-semibold text-[var(--error)]"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  disabled={
                    !rawText.trim() ||
                    !supabase ||
                    isPending ||
                    importDrafts.filter((draft) => draft.title.trim()).length === 0
                  }
                  onClick={handleImport}
                  className="rounded-[12px] border border-[var(--primary)] bg-white px-5 py-3 text-base font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--primary)]">LIVE STATUS</p>
              <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">孩子端实时状态</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                家长可在这里确认完成，或删除当天任务。
              </p>
            </div>
            {message ? (
              <div className="rounded-full bg-[rgba(91,155,213,0.12)] px-4 py-2 text-sm font-medium text-[rgba(58,107,160,1)]">
                {message}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-6 rounded-[1rem] bg-[var(--card-alt)] p-6 text-[var(--text-secondary)]">
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
                  className={`soft-shadow relative overflow-hidden rounded-[1.15rem] border border-[var(--line)] p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${
                    subjectAccentClass(task.subject)
                  } ${
                    task.status === "confirmed_by_parent"
                      ? "bg-[var(--card-alt)] opacity-75"
                      : "bg-card"
                  }`}
                >
                  <div className="flex flex-col gap-4 pl-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={task.status} />
                          {task.subject ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subjectPillClass(task.subject)}`}>
                              {task.subject}
                            </span>
                          ) : null}
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourcePillClass(task.source)}`}>
                            {sourceLabel(task.source)}
                          </span>
                        </div>
                        <h3
                          className={`mt-3 text-lg font-medium text-[var(--foreground)] md:text-[1.125rem] ${
                            task.status === "confirmed_by_parent"
                              ? "line-through decoration-2"
                              : ""
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.details ? (
                          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                            {task.details}
                          </p>
                        ) : null}
                      </div>
                      {task.status === "confirmed_by_parent" ? (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(228,246,229,0.95)] text-xl">
                          ✅
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[var(--line-light)] pt-4 md:justify-start">
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task.id, "confirmed_by_parent")}
                        className="rounded-[12px] border border-[var(--success)] bg-[rgba(76,175,80,0.06)] px-4 py-2.5 text-sm font-semibold text-[var(--success)]"
                      >
                        ✓ 家长确认完成
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTaskStatus(task.id, "pending")}
                        className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)]/45 px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
                      >
                        ↺ 重置为待开始
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-[12px] border border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--error)]"
                      >
                        🗑 删除任务
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
