"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SetupNotice } from "@/components/setup-notice";
import {
  AttachmentSection,
  HistoricalTasksNotice,
  ImportPreviewSection,
  LiveStatusSection,
  ManualTaskSection,
  ParentHeader,
  TemplatesSection,
} from "@/components/parent-dashboard-sections";
import { useLocalDate } from "@/hooks/use-local-date";
import { formatDisplayDate, shiftLocalDate } from "@/lib/date";
import { flattenHomeworkGroups, parseHomeworkGroups } from "@/lib/task-parser";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AttachmentRole,
  SubjectTaskGroup,
  TaskAttachmentRecord,
  TaskDraft,
  TaskRecord,
  TaskStatus,
  TaskSource,
  TaskTemplateRecord,
} from "@/types/task";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function fetchTodayTasks(supabase: SupabaseClient, dueDate: string, boardId: string) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .lte("due_date", dueDate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

function fetchTaskTemplates(supabase: SupabaseClient, boardId: string) {
  return supabase
    .from("task_templates")
    .select("*")
    .eq("board_id", boardId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

function fetchTaskAttachments(supabase: SupabaseClient, dueDate: string, boardId: string) {
  return supabase
    .from("task_attachments")
    .select("*")
    .eq("board_id", boardId)
    .lte("due_date", dueDate)
    .order("subject", { ascending: true })
    .order("due_date", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

function isCompletedStatus(status: TaskStatus) {
  return status === "done_by_child" || status === "confirmed_by_parent";
}

function filterVisibleTasks(tasks: TaskRecord[], selectedDate: string, includeCarryover: boolean) {
  if (!includeCarryover) {
    return tasks.filter((task) => task.due_date === selectedDate);
  }

  return tasks.filter(
    (task) => task.due_date === selectedDate || !isCompletedStatus(task.status),
  );
}

function filterAttachmentsForVisibleTasks(
  attachments: TaskAttachmentRecord[],
  tasks: TaskRecord[],
) {
  const visibleKeys = new Set(
    tasks.map((task) => `${task.due_date}::${task.subject?.trim() || "今日任务"}`),
  );

  return attachments.filter((attachment) =>
    visibleKeys.has(`${attachment.due_date}::${attachment.subject?.trim() || "今日任务"}`),
  );
}

/** 图片转 base64（压缩到 1200px 宽度以内） */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 1200;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ParentDashboard({ boardId }: { boardId: string }) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateRecord[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [rawText, setRawText] = useState("");
  const [importGroups, setImportGroups] = useState<SubjectTaskGroup[]>([]);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualDetails, setManualDetails] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateDetails, setTemplateDetails] = useState("");
  const [attachmentSubject, setAttachmentSubject] = useState("语文");
  const [attachmentNote, setAttachmentNote] = useState("");
  const [attachmentRole, setAttachmentRole] = useState<AttachmentRole>("reference");
  const [attachmentVisibleToChild, setAttachmentVisibleToChild] = useState(true);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"import" | "manual" | "template" | "attachment">("import");
  const [aiParsing, setAiParsing] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const today = useLocalDate();
  const [selectedDate, setSelectedDate] = useState("");
  const yesterday = useMemo(() => (today ? shiftLocalDate(today, -1) : ""), [today]);
  const importDrafts = useMemo(() => flattenHomeworkGroups(importGroups), [importGroups]);
  const progress = useMemo(() => summarizeProgress(tasks), [tasks]);
  const effectiveSelectedDate = selectedDate || today;
  const isTodaySelected = effectiveSelectedDate === today;
  const tasksRef = useRef<TaskRecord[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!supabase || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;
    let active = true;

    async function run() {
      setLoading(true);
      const [{ data, error }, templatesResult, attachmentsResult] = await Promise.all([
        fetchTodayTasks(client, effectiveSelectedDate, boardId),
        fetchTaskTemplates(client, boardId),
        fetchTaskAttachments(client, effectiveSelectedDate, boardId),
      ]);

      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        const nextTasks = filterVisibleTasks(
          (data as TaskRecord[]) ?? [],
          effectiveSelectedDate,
          isTodaySelected,
        );
        setTemplates((templatesResult.data as TaskTemplateRecord[]) ?? []);
        setTasks(nextTasks);
        setAttachments(
          filterAttachmentsForVisibleTasks(
            (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
            nextTasks,
          ),
        );
        setMessage(null);
      }

      setLoading(false);
    }

    void run();

    return () => {
      active = false;
    };
  }, [supabase, effectiveSelectedDate, isTodaySelected, boardId]);

  useEffect(() => {
    setImportGroups(parseHomeworkGroups(rawText));
  }, [rawText]);

  async function handleOCR(file: File) {
    if (ocrScanning) return;
    setOcrScanning(true);
    setMessage(null);
    try {
      /* 压缩图片到合理大小 */
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/ocr-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, board: boardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "识别失败");
        return;
      }
      if (data.text) {
        setRawText((prev) => (prev ? `${prev}\n${data.text}` : data.text));
        setMessage("拍照识别完成，可继续 AI 解析");
      } else {
        setMessage("未识别到文字内容");
      }
    } catch (err) {
      setMessage(`识别异常：${err instanceof Error ? err.message : "请重试"}`);
    } finally {
      setOcrScanning(false);
    }
  }

  async function handleAIParse() {
    if (!rawText.trim() || aiParsing) return;
    setAiParsing(true);
    try {
      const response = await fetch("/api/parse-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, board: boardId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "AI 解析失败");
        return;
      }
      if (Array.isArray(data.groups) && data.groups.length > 0) {
        /* 兼容两种格式：[{subject,tasks:[...]}] 或 [{title,details}] */
        const firstItem = data.groups[0];
        const normalized = firstItem.tasks
          ? data.groups.map((g: { subject: string; tasks: { title: string; details?: string }[] }) => ({
              subject: g.subject || "其他",
              tasks: (g.tasks || []).map((t: { title: string; details?: string }) => ({ title: t.title, details: t.details || undefined })),
            }))
          : [{
              subject: firstItem.subject || "其他",
              tasks: data.groups.map((t: { title: string; details?: string }) => ({ title: t.title, details: t.details || undefined })),
            }];
        setImportGroups(normalized.filter((g: { tasks: unknown[] }) => g.tasks.length > 0));
        setMessage("AI 解析完成，请校对后确认导入");
      } else {
        setMessage("未解析出任务，请检查输入内容");
      }
    } catch (err) {
      setMessage(`AI 服务异常：${err instanceof Error ? err.message : "请稍后重试"}`);
    } finally {
      setAiParsing(false);
    }
  }

  useEffect(() => {
    if (!supabase || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;

    const channel = client
      .channel(`tasks-parent-${boardId}-${effectiveSelectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `board_id=eq.${boardId}`,
        },
        async () => {
          const [{ data, error }, { data: templateData }, { data: attachmentData }] = await Promise.all([
            fetchTodayTasks(client, effectiveSelectedDate, boardId),
            fetchTaskTemplates(client, boardId),
            fetchTaskAttachments(client, effectiveSelectedDate, boardId),
          ]);

          if (error) {
            setMessage(error.message);
            return;
          }

          const nextTasks = filterVisibleTasks(
            (data as TaskRecord[]) ?? [],
            effectiveSelectedDate,
            isTodaySelected,
          );
          setTemplates((templateData as TaskTemplateRecord[]) ?? []);
          setTasks(nextTasks);
          setAttachments(
            filterAttachmentsForVisibleTasks(
              (attachmentData as TaskAttachmentRecord[]) ?? [],
              nextTasks,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_attachments",
          filter: `board_id=eq.${boardId}`,
        },
        async () => {
          const { data, error } = await fetchTaskAttachments(client, effectiveSelectedDate, boardId);

          if (error) {
            setMessage(error.message);
            return;
          }

          setAttachments(
            filterAttachmentsForVisibleTasks(
              (data as TaskAttachmentRecord[]) ?? [],
              tasksRef.current,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [supabase, effectiveSelectedDate, isTodaySelected, boardId]);

  useEffect(() => {
    if (!highlightedTaskId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedTaskId((current) => (current === highlightedTaskId ? null : current));
    }, 520);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedTaskId]);

  async function insertTasks(drafts: TaskDraft[], source: TaskSource) {
    if (!supabase || drafts.length === 0 || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;
    const payload = drafts.map((draft, index) => ({
      board_id: boardId,
      due_date: effectiveSelectedDate,
      subject: draft.subject ?? null,
      title: draft.title,
      details: draft.details ?? null,
      template_id: draft.templateId ?? null,
      status: "pending" as TaskStatus,
      sort_order: tasks.length + index,
      source,
      category: "school",
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
    const [{ data }, attachmentsResult] = await Promise.all([
      fetchTodayTasks(client, effectiveSelectedDate, boardId),
      fetchTaskAttachments(client, effectiveSelectedDate, boardId),
    ]);
    const nextTasks = filterVisibleTasks(
      (data as TaskRecord[]) ?? [],
      effectiveSelectedDate,
      isTodaySelected,
    );
    setTasks(nextTasks);
    setAttachments(
      filterAttachmentsForVisibleTasks(
        (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
        nextTasks,
      ),
    );
  }

  function handleManualCreate() {
    startTransition(() => {
      void insertTasks(
        [{ subject: manualSubject.trim() || undefined, title: manualTitle.trim(), details: manualDetails.trim() || undefined }].filter(
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
        const { data } = await fetchTaskTemplates(client, boardId);
        setTemplates((data as TaskTemplateRecord[]) ?? []);
      })();
    });
  }

  function toggleTemplate(id: string, isActive: boolean) {
    if (!supabase || !effectiveSelectedDate) {
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

        const { data } = await fetchTaskTemplates(client, boardId);
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

        const { data } = await fetchTaskTemplates(client, boardId);
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
    if (!supabase || !effectiveSelectedDate) {
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

        const [{ data }, attachmentsResult] = await Promise.all([
          fetchTodayTasks(client, effectiveSelectedDate, boardId),
          fetchTaskAttachments(client, effectiveSelectedDate, boardId),
        ]);
        const nextTasks = filterVisibleTasks(
          (data as TaskRecord[]) ?? [],
          effectiveSelectedDate,
          isTodaySelected,
        );
        setTasks(nextTasks);
        setAttachments(
          filterAttachmentsForVisibleTasks(
            (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
            nextTasks,
          ),
        );
        setHighlightedTaskId(id);
      })();
    });
  }

  async function uploadAttachment(file: File | null) {
    if (!supabase || !file || !attachmentSubject.trim() || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;
    const normalizedRole = attachmentRole;
    const visibleToChild = normalizedRole === "parent_only" ? false : attachmentVisibleToChild;
    const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const storagePath = `${boardId}/${effectiveSelectedDate}/${Date.now()}-${safeName || "teacher-reference"}.${fileExt}`;

    setUploadingAttachment(true);

    const uploadResult = await client.storage
      .from("teacher-attachments")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadResult.error) {
      setUploadingAttachment(false);
      setMessage(uploadResult.error.message);
      return;
    }

    const publicUrlResult = client.storage.from("teacher-attachments").getPublicUrl(storagePath);
    const nextSortOrder =
      attachments.filter(
        (attachment) => (attachment.subject?.trim() || "其他") === attachmentSubject.trim(),
      ).length;

    const { error } = await client.from("task_attachments").insert({
      board_id: boardId,
      due_date: effectiveSelectedDate,
      subject: attachmentSubject.trim(),
      storage_path: storagePath,
      public_url: publicUrlResult.data.publicUrl,
      note: attachmentNote.trim() || null,
      role: normalizedRole,
      visible_to_child: visibleToChild,
      sort_order: nextSortOrder,
    });

    setUploadingAttachment(false);

    if (error) {
      await client.storage.from("teacher-attachments").remove([storagePath]);
      setMessage(error.message);
      return;
    }

    setAttachmentNote("");
    setAttachmentRole("reference");
    setAttachmentVisibleToChild(true);
    /* 学科保留上次选择，方便连续上传同一学科的多张图片 */
    setMessage("已保存老师图片资料");
    const { data } = await fetchTaskAttachments(client, effectiveSelectedDate, boardId);
    setAttachments(
      filterAttachmentsForVisibleTasks(
        (data as TaskAttachmentRecord[]) ?? [],
        tasksRef.current,
      ),
    );
  }

  function deleteAttachment(attachment: TaskAttachmentRecord) {
    if (!supabase || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;

    startTransition(() => {
      void (async () => {
        const { error } = await client.from("task_attachments").delete().eq("id", attachment.id);

        if (error) {
          setMessage(error.message);
          return;
        }

        await client.storage.from("teacher-attachments").remove([attachment.storage_path]);

        const sameSubject = attachments.filter(
          (item) =>
            item.id !== attachment.id &&
            (item.subject?.trim() || "其他") === (attachment.subject?.trim() || "其他"),
        );

        await Promise.all(
          sameSubject.map((item, index) =>
            client.from("task_attachments").update({ sort_order: index }).eq("id", item.id),
          ),
        );

        const { data } = await fetchTaskAttachments(client, effectiveSelectedDate, boardId);
        setAttachments(
          filterAttachmentsForVisibleTasks(
            (data as TaskAttachmentRecord[]) ?? [],
            tasksRef.current,
          ),
        );
      })();
    });
  }

  function moveAttachment(attachment: TaskAttachmentRecord, direction: "up" | "down") {
    if (!supabase || !effectiveSelectedDate) {
      return;
    }

    const client: SupabaseClient = supabase;
    const groupItems = attachments
      .filter(
        (item) =>
          (item.subject?.trim() || "其他") === (attachment.subject?.trim() || "其他"),
      )
      .sort((left, right) => left.sort_order - right.sort_order);
    const currentIndex = groupItems.findIndex((item) => item.id === attachment.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groupItems.length) {
      return;
    }

    const reordered = [...groupItems];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    startTransition(() => {
      void (async () => {
        await Promise.all(
          reordered.map((item, index) =>
            client.from("task_attachments").update({ sort_order: index }).eq("id", item.id),
          ),
        );

        const { data } = await fetchTaskAttachments(client, effectiveSelectedDate, boardId);
        setAttachments(
          filterAttachmentsForVisibleTasks(
            (data as TaskAttachmentRecord[]) ?? [],
            tasksRef.current,
          ),
        );
      })();
    });
  }

  function deleteTask(id: string) {
    if (!supabase || !effectiveSelectedDate) {
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

        const [{ data }, attachmentsResult] = await Promise.all([
          fetchTodayTasks(client, effectiveSelectedDate, boardId),
          fetchTaskAttachments(client, effectiveSelectedDate, boardId),
        ]);
        const nextTasks = filterVisibleTasks(
          (data as TaskRecord[]) ?? [],
          effectiveSelectedDate,
          isTodaySelected,
        );
        setTasks(nextTasks);
        setAttachments(
          filterAttachmentsForVisibleTasks(
            (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
            nextTasks,
          ),
        );
      })();
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <ParentHeader
        todayLabel={effectiveSelectedDate ? formatDisplayDate(effectiveSelectedDate) : "今天"}
        progress={progress}
        selectedDate={effectiveSelectedDate}
        yesterdayDate={yesterday}
        onDateChange={setSelectedDate}
        onJumpToToday={() => setSelectedDate(today)}
        onJumpToYesterday={() => setSelectedDate(yesterday)}
        isToday={isTodaySelected}
      />

      {!supabase ? <SetupNotice /> : null}

      <section className="grid gap-6 overflow-hidden lg:grid-cols-[0.98fr_1.22fr] xl:grid-cols-[1.05fr_1.3fr]">
        <div className="min-w-0 space-y-6">
          {isTodaySelected ? (
            <div>
              {/* Tab Bar */}
              <div className="mb-4 flex gap-1.5 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/60 p-1.5">
                {([
                  ["import", "作业导入"],
                  ["manual", "手动新增"],
                  ["template", "固定模板"],
                  ["attachment", "图片资料"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 rounded-[12px] px-2 py-2.5 text-sm font-semibold transition-colors ${
                      activeTab === key
                        ? "bg-card text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "import" ? (
                <ImportPreviewSection
                  rawText={rawText}
                  groups={importGroups}
                  drafts={importDrafts}
                  onRawTextChange={setRawText}
                  onAIParse={handleAIParse}
                  aiParsing={aiParsing}
                  ocrScanning={ocrScanning}
                  onOCR={handleOCR}
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
              ) : null}

              {activeTab === "manual" ? (
                <ManualTaskSection
                  title={manualTitle}
                  subject={manualSubject}
                  details={manualDetails}
                  onTitleChange={setManualTitle}
                  onSubjectChange={setManualSubject}
                  onDetailsChange={setManualDetails}
                  onCreate={handleManualCreate}
                  disabled={!manualTitle.trim() || !supabase || isPending}
                />
              ) : null}

              {activeTab === "template" ? (
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
              ) : null}

              {activeTab === "attachment" ? (
                <AttachmentSection
                  attachments={attachments}
                  subject={attachmentSubject}
                  note={attachmentNote}
                  role={attachmentRole}
                  visibleToChild={attachmentVisibleToChild}
                  uploading={uploadingAttachment}
                  disabled={!supabase || isPending || uploadingAttachment}
                  onSubjectChange={setAttachmentSubject}
                  onNoteChange={setAttachmentNote}
                  onRoleChange={(value) => {
                    setAttachmentRole(value);
                    if (value === "parent_only") {
                      setAttachmentVisibleToChild(false);
                    }
                  }}
                  onVisibleToChildChange={setAttachmentVisibleToChild}
                  onUpload={(file) => {
                    startTransition(() => {
                      void uploadAttachment(file);
                    });
                  }}
                  onDelete={deleteAttachment}
                  onMove={moveAttachment}
                />
              ) : null}
            </div>
          ) : (
            <HistoricalTasksNotice selectedDateLabel={effectiveSelectedDate ? formatDisplayDate(effectiveSelectedDate) : "这一天"} />
          )}
        </div>

        <LiveStatusSection
          tasks={tasks}
          selectedDate={effectiveSelectedDate}
          loading={loading}
          message={message}
          highlightedTaskId={highlightedTaskId}
          onStatusChange={updateTaskStatus}
          onDelete={deleteTask}
          readOnly={!isTodaySelected}
          emptyDescription={
            isTodaySelected
              ? "先在左侧添加任务，孩子端会立即出现大字卡片。"
              : "这一天还没有保存任务记录。"
          }
        />
      </section>
    </div>
  );
}
