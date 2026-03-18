"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SetupNotice } from "@/components/setup-notice";
import {
  ImportPreviewSection,
  LiveStatusSection,
  ManualTaskSection,
  ParentHeader,
  TemplatesSection,
} from "@/components/parent-dashboard-sections";
import { formatDisplayDate, formatLocalDate } from "@/lib/date";
import { flattenHomeworkGroups, parseHomeworkGroups } from "@/lib/task-parser";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

async function fetchTodayTasks(supabase: SupabaseClient, dueDate: string) {
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
  const progress = useMemo(() => summarizeProgress(tasks), [tasks]);

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
      tasks
        .map((task) => task.template_id)
        .filter((templateId): templateId is string => Boolean(templateId)),
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

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <ParentHeader todayLabel={formatDisplayDate(today)} progress={progress} />

      {!supabase ? <SetupNotice /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.3fr]">
        <div className="space-y-6">
          <ManualTaskSection
            title={manualTitle}
            details={manualDetails}
            onTitleChange={setManualTitle}
            onDetailsChange={setManualDetails}
            onCreate={handleManualCreate}
            disabled={!manualTitle.trim() || !supabase || isPending}
          />

          <TemplatesSection
            templates={templates}
            title={templateTitle}
            subject={templateSubject}
            details={templateDetails}
            onTitleChange={setTemplateTitle}
            onSubjectChange={setTemplateSubject}
            onDetailsChange={setTemplateDetails}
            onCreate={createTemplate}
            onAddToToday={addTemplatesToToday}
            onToggle={toggleTemplate}
            onDelete={deleteTemplate}
            createDisabled={!supabase || !templateTitle.trim() || isPending}
            addDisabled={
              !supabase || isPending || templates.filter((item) => item.is_active).length === 0
            }
          />

          <ImportPreviewSection
            rawText={rawText}
            groups={importGroups}
            drafts={importDrafts}
            onRawTextChange={setRawText}
            onTaskUpdate={updateImportedTask}
            onTaskDelete={deleteImportedTask}
            onTaskAdd={addImportedTask}
            onImport={handleImport}
            importDisabled={
              !rawText.trim() ||
              !supabase ||
              isPending ||
              importDrafts.filter((draft) => draft.title.trim()).length === 0
            }
          />
        </div>

        <LiveStatusSection
          tasks={tasks}
          loading={loading}
          message={message}
          onStatusChange={updateTaskStatus}
          onDelete={deleteTask}
        />
      </section>
    </div>
  );
}
