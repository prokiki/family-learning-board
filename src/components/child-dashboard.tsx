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

async function fetchTodayTasks(supabase: SupabaseClient, dueDate: string) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .eq("due_date", dueDate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

async function fetchTodayAttachments(supabase: SupabaseClient, dueDate: string) {
  return supabase
    .from("task_attachments")
    .select("*")
    .eq("board_id", boardId)
    .eq("due_date", dueDate)
    .eq("visible_to_child", true)
    .neq("role", "parent_only")
    .order("subject", { ascending: true })
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

  return [...grouped.entries()].map(([subject, subjectTasks]) => ({
    subject,
    tasks: subjectTasks,
  }));
}

export function ChildDashboard() {
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
  const completedTaskCount = tasks.filter((task) => isCompletedStatus(task.status)).length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const allTasksCompleted = tasks.length > 0 && completedTaskCount === tasks.length;

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
        fetchTodayTasks(client, today),
        fetchTodayAttachments(client, today),
      ]);

      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setTasks((data as TaskRecord[]) ?? []);
        setAttachments((attachmentsResult.data as TaskAttachmentRecord[]) ?? []);
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
            fetchTodayTasks(client, today),
            fetchTodayAttachments(client, today),
          ]);

          if (error) {
            setMessage(error.message);
            return;
          }

          setTasks((data as TaskRecord[]) ?? []);
          setAttachments((attachmentsResult.data as TaskAttachmentRecord[]) ?? []);
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
          const { data, error } = await fetchTodayAttachments(client, today);

          if (error) {
            setMessage(error.message);
            return;
          }

          setAttachments((data as TaskAttachmentRecord[]) ?? []);
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

  return (
    <div className="min-h-screen bg-background px-3 py-5 text-[var(--foreground)] sm:px-4 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-4 md:space-y-6">
        <ChildHeader
          today={today}
          totalCount={tasks.length}
          inProgressCount={inProgressCount}
          completedCount={completedTaskCount}
        />

        <PomodoroSection
          timerState={timerState}
          timerProgress={timerProgress}
          onSwitchMode={switchTimerMode}
          onStart={handleTimerStart}
          onPause={() => dispatchTimer({ type: "pause" })}
          onReset={resetTimer}
        />

        {!supabase ? (
          <div className="mt-4">
            <SetupNotice />
          </div>
        ) : null}

        <ChildTasksSection
          groups={groupedOrderedTasks}
          attachmentGroups={groupedAttachments}
          currentTaskId={currentTaskId}
          highlightedTaskId={highlightedTaskId}
          isPending={isPending}
          onUpdateTask={updateTask}
          onOpenAttachments={setOpenAttachmentSubject}
          allTasksCompleted={allTasksCompleted}
          loading={loading}
          message={message}
        />

        <AttachmentModal
          key={openAttachmentGroup?.subject ?? "attachment-modal"}
          group={openAttachmentGroup}
          onClose={() => setOpenAttachmentSubject(null)}
        />
      </div>
    </div>
  );
}
