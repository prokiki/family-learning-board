"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SetupNotice } from "@/components/setup-notice";
import {
  AttachmentModal,
  ChildHeader,
  ChildTasksSection,
  PomodoroSection,
} from "@/components/child-dashboard-sections";
import { useLocalDate } from "@/hooks/use-local-date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TaskAttachmentRecord, TaskRecord, TaskStatus } from "@/types/task";
import { LearningCalendar } from "@/components/learning-calendar";

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
      return { ...state, secondsLeft: Math.max(state.secondsLeft - 1, 0) };
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

async function fetchTodayTasks(supabase: SupabaseClient, dueDate: string, boardId: string) {
  const result = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .lte("due_date", dueDate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (result.error) {
    return result;
  }

  const visibleTasks = ((result.data as TaskRecord[]) ?? []).filter(
    (task) => task.due_date === dueDate || !isCompletedStatus(task.status),
  );

  return { ...result, data: visibleTasks };
}

async function fetchTodayAttachments(supabase: SupabaseClient, dueDate: string, boardId: string) {
  return supabase
    .from("task_attachments")
    .select("*")
    .eq("board_id", boardId)
    .lte("due_date", dueDate)
    .eq("visible_to_child", true)
    .neq("role", "parent_only")
    .order("subject", { ascending: true })
    .order("due_date", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
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

  /* 主科优先，其余按首次出现顺序 */
  const priority: Record<string, number> = { "语文": 0, "数学": 1, "英语": 2 };
  return [...grouped.entries()]
    .map(([subject, subjectTasks]) => ({ subject, tasks: subjectTasks }))
    .sort((a, b) => (priority[a.subject] ?? 99) - (priority[b.subject] ?? 99));
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

export function ChildDashboard({ boardId }: { boardId: string }) {
  const today = useLocalDate();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [openAttachmentSubject, setOpenAttachmentSubject] = useState<string | null>(null);
  const [timerState, dispatchTimer] = useReducer(timerReducer, {
    mode: "focus",
    secondsLeft: FOCUS_MINUTES * 60,
    isRunning: false,
    notice: null,
  });
  const supabase = getSupabaseBrowserClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isPending, startTransition] = useTransition();
  const [dailyPlan, setDailyPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"school" | "extra">("school");
  const [extraTitle, setExtraTitle] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tasksRef = useRef<TaskRecord[]>([]);
  const timerTotalSeconds = getModeSeconds(timerState.mode);
  const timerProgress =
    ((timerTotalSeconds - timerState.secondsLeft) / timerTotalSeconds) * 100;
  const schoolTasks = useMemo(() => tasks.filter((t) => t.category !== "extra"), [tasks]);
  const extraTasks = useMemo(() => tasks.filter((t) => t.category === "extra"), [tasks]);
  const activeTasks = activeTab === "school" ? schoolTasks : extraTasks;

  const orderedTasks = useMemo(
    () =>
      [...activeTasks].sort((left, right) => {
        const weightDiff = taskSortWeight(left.status) - taskSortWeight(right.status);

        if (weightDiff !== 0) {
          return weightDiff;
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }

        return left.created_at.localeCompare(right.created_at);
      }),
    [activeTasks],
  );
  const groupedOrderedTasks = useMemo(() => groupTasksBySubject(orderedTasks), [orderedTasks]);
  const groupedAttachments = useMemo(
    () =>
      [...attachments].reduce<{ subject: string; attachments: TaskAttachmentRecord[] }[]>(
        (acc, attachment) => {
          const subject = attachment.subject?.trim() || "今日任务";
          const current = acc.find((item) => item.subject === subject);

          if (current) {
            current.attachments.push(attachment);
          } else {
            acc.push({ subject, attachments: [attachment] });
          }

          return acc;
        },
        [],
      ),
    [attachments],
  );
  const openAttachmentGroup =
    groupedAttachments.find((item) => item.subject === openAttachmentSubject) ?? null;
  const completedTaskCount = activeTasks.filter((task) => isCompletedStatus(task.status)).length;
  const allSchoolCompleted = schoolTasks.length > 0 && schoolTasks.every((t) => isCompletedStatus(t.status));
  const allExtraCompleted = extraTasks.length > 0 && extraTasks.every((t) => isCompletedStatus(t.status));
  const allTasksCompleted = activeTasks.length > 0 && completedTaskCount === activeTasks.length;
  const allDone = (schoolTasks.length + extraTasks.length) > 0 && allSchoolCompleted && (extraTasks.length === 0 || allExtraCompleted);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  function getAudioContext() {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

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
    if (!supabase || !today) {
      return;
    }

    const client: SupabaseClient = supabase;
    let active = true;

    async function run() {
      setLoading(true);
      const [{ data, error }, attachmentsResult] = await Promise.all([
        fetchTodayTasks(client, today, boardId),
        fetchTodayAttachments(client, today, boardId),
      ]);

      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        const nextTasks = (data as TaskRecord[]) ?? [];
        const nextAttachments = filterAttachmentsForVisibleTasks(
          (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
          nextTasks,
        );
        setTasks(nextTasks);
        setAttachments(nextAttachments);
        setMessage(null);
      }

      setLoading(false);
    }

    void run();

    return () => {
      active = false;
    };
  }, [supabase, today, boardId]);

  useEffect(() => {
    if (!supabase || !today) {
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
          const [{ data, error }, attachmentsResult] = await Promise.all([
            fetchTodayTasks(client, today, boardId),
            fetchTodayAttachments(client, today, boardId),
          ]);

          if (error) {
            setMessage(error.message);
            return;
          }

          const nextTasks = (data as TaskRecord[]) ?? [];
          const nextAttachments = filterAttachmentsForVisibleTasks(
            (attachmentsResult.data as TaskAttachmentRecord[]) ?? [],
            nextTasks,
          );
          setTasks(nextTasks);
          setAttachments(nextAttachments);
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
          const { data, error } = await fetchTodayAttachments(client, today, boardId);

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
  }, [supabase, today, boardId]);

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

        const [{ data }, attachmentsResult] = await Promise.all([
          fetchTodayTasks(client, today, boardId),
          fetchTodayAttachments(client, today, boardId),
        ]);
        const nextTasks = (data as TaskRecord[]) ?? [];
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

  useEffect(() => {
    if (!highlightedTaskId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHighlightedTaskId(null);
    }, 520);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedTaskId]);

  function handleTimerStart() {
    primeTimerAudio();
    dispatchTimer({ type: "start" });
  }

  function switchTimerMode(mode: TimerMode) {
    dispatchTimer({ type: "switchMode", mode });
  }

  function resetTimer() {
    dispatchTimer({ type: "reset" });
  }

  /* 孩子自主添加课外任务 */
  async function addExtraTask() {
    if (!supabase || !extraTitle.trim() || !today || addingExtra) return;
    setAddingExtra(true);
    const client: SupabaseClient = supabase;
    const { error } = await client.from("tasks").insert({
      board_id: boardId,
      due_date: today,
      subject: "课外学习",
      title: extraTitle.trim(),
      status: "pending",
      sort_order: tasks.length,
      source: "manual",
      category: "extra",
      last_updated_by: "child",
    });
    if (error) {
      setMessage(error.message);
    } else {
      setExtraTitle("");
      // 数据会通过 realtime 自动刷新
    }
    setAddingExtra(false);
  }

  /* AI 完成鼓励 */
  async function loadDailySummary() {
    if (summaryLoading || dailySummary) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: boardId,
          tasks: tasks.map((t) => ({ subject: t.subject || "", title: t.title, category: t.category || "school" })),
        }),
      });
      const data = await res.json();
      if (data.summary) setDailySummary(data.summary);
    } catch {} finally {
      setSummaryLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 text-[var(--foreground)] sm:px-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[960px] space-y-5">
        <ChildHeader
          today={today}
          totalCount={activeTasks.length}
          completedCount={completedTaskCount}
        />

        {/* 学习日历 + streak */}
        <LearningCalendar boardId={boardId} />

        {!supabase ? (
          <div className="mt-4">
            <SetupNotice />
          </div>
        ) : null}

        {/* AI 今日作战计划 */}
        {tasks.length > 0 && (
          <div className="rounded-[1.5rem] border border-[var(--primary)]/20 bg-[var(--primary-light)] p-4">
            {dailyPlan ? (
              <p className="text-sm leading-7 text-[var(--foreground)]">{dailyPlan}</p>
            ) : (
              <button
                type="button"
                disabled={planLoading}
                onClick={async () => {
                  setPlanLoading(true);
                  try {
                    const res = await fetch("/api/daily-plan", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        board: boardId,
                        tasks: tasks.map((t) => ({ subject: t.subject || "", title: t.title })),
                      }),
                    });
                    const data = await res.json();
                    if (data.plan) setDailyPlan(data.plan);
                  } catch {} finally { setPlanLoading(false); }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 text-sm font-semibold text-[var(--primary)]"
              >
                {planLoading ? (
                  <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />正在生成...</>
                ) : (
                  "✨ 查看今日作战计划"
                )}
              </button>
            )}
          </div>
        )}

        {/* 学校/课外 Tab */}
        <div className="flex gap-1.5 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/60 p-1.5">
          {([
            ["school", `学校任务${schoolTasks.length > 0 ? ` (${schoolTasks.length})` : ""}`],
            ["extra", `课外学习${extraTasks.length > 0 ? ` (${extraTasks.length})` : ""}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === key
                  ? "bg-card text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 课外学习：孩子自主添加 */}
        {activeTab === "extra" && (
          <div className="flex gap-2">
            <input
              type="text"
              value={extraTitle}
              onChange={(e) => setExtraTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addExtraTask(); }}
              placeholder="今天我还想做…"
              className="min-w-0 flex-1 rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
            />
            <button
              type="button"
              disabled={!extraTitle.trim() || addingExtra}
              onClick={addExtraTask}
              className="shrink-0 rounded-[12px] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {addingExtra ? "添加中..." : "添加"}
            </button>
          </div>
        )}

        {/* 全部完成鼓励 */}
        {allDone && (
          <div className="rounded-[1.5rem] border border-[var(--success)]/20 bg-[var(--success-subtle)] p-4 text-center">
            {dailySummary ? (
              <p className="text-base font-medium leading-7 text-[var(--foreground)]">{dailySummary}</p>
            ) : (
              <button
                type="button"
                disabled={summaryLoading}
                onClick={loadDailySummary}
                className="text-sm font-semibold text-[var(--success)]"
              >
                {summaryLoading ? "正在生成..." : "🎉 今天全部完成了，点击看看 AI 怎么说"}
              </button>
            )}
          </div>
        )}

        {/* Main Layout: Timer (left) + Tasks (right) on iPad+ */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Timer Column — sticky on iPad+ */}
          <div className="w-full shrink-0 md:sticky md:top-6 md:w-[260px] lg:w-[280px]">
            <PomodoroSection
              timerState={timerState}
              timerProgress={timerProgress}
              onSwitchMode={switchTimerMode}
              onStart={handleTimerStart}
              onPause={() => dispatchTimer({ type: "pause" })}
              onReset={resetTimer}
            />
          </div>

          {/* Task Area */}
          <div className="min-w-0 flex-1">
        <ChildTasksSection
          boardId={boardId}
          groups={groupedOrderedTasks}
          attachmentGroups={groupedAttachments}
          today={today}
          highlightedTaskId={highlightedTaskId}
          isPending={isPending}
              onUpdateTask={updateTask}
              onOpenAttachments={setOpenAttachmentSubject}
              allTasksCompleted={allTasksCompleted}
              loading={loading}
              message={message}
            />
          </div>
        </div>

        <AttachmentModal
          key={openAttachmentGroup?.subject ?? "attachment-modal"}
          group={openAttachmentGroup}
          onClose={() => setOpenAttachmentSubject(null)}
        />
      </div>
    </div>
  );
}
