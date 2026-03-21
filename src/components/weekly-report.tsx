"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SetupNotice } from "@/components/setup-notice";
import { CardSkeleton, EmptyState } from "@/components/empty-state";
import { useLocalDate } from "@/hooks/use-local-date";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatLocalDate, shiftLocalDate } from "@/lib/date";
import type { TaskRecord, TaskStatus } from "@/types/task";

/* ───────────────── helpers ───────────────── */

function isCompletedStatus(status: TaskStatus) {
  return status === "done_by_child" || status === "confirmed_by_parent";
}

/** Return Monday of the week containing `dateStr` (ISO format). */
function getMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

function buildWeekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftLocalDate(monday, i));
}

function shortWeekday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

function shortDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function fetchWeekTasks(supabase: SupabaseClient, monday: string, sunday: string, boardId: string) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .gte("due_date", monday)
    .lte("due_date", sunday)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
}

/* ───────────────── types ───────────────── */

type DayStat = {
  date: string;
  total: number;
  completed: number;
  helpCount: number;
};

type SubjectStat = {
  subject: string;
  total: number;
  completed: number;
  helpCount: number;
};

/* ───────────────── export helper ───────────────── */

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待开始",
  in_progress: "进行中",
  done_by_child: "孩子已完成",
  needs_help: "需要帮助",
  confirmed_by_parent: "家长已确认",
};

function exportCSV(tasks: TaskRecord[], weekLabel: string) {
  const BOM = "\uFEFF";
  const header = ["日期", "学科", "任务", "状态", "来源", "详情"];
  const rows = tasks.map((t) => [
    t.due_date,
    t.subject?.trim() || "其他",
    t.title,
    STATUS_LABEL[t.status] ?? t.status,
    t.source === "imported" ? "导入" : t.source === "template" ? "固定" : "手动",
    (t.details ?? "").replace(/[\n\r]+/g, " "),
  ]);

  const csv = BOM + [header, ...rows].map((r) =>
    r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","),
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `周报-${weekLabel.replace(/\s/g, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ───────────────── component ───────────────── */

export function WeeklyReport({ boardId }: { boardId: string }) {
  const today = useLocalDate();
  const supabase = getSupabaseBrowserClient();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [prevTasks, setPrevTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week …

  const currentMonday = useMemo(() => {
    if (!today) return "";
    const baseMonday = getMonday(today);
    return weekOffset === 0 ? baseMonday : shiftLocalDate(baseMonday, weekOffset * 7);
  }, [today, weekOffset]);

  const weekDays = useMemo(() => (currentMonday ? buildWeekDays(currentMonday) : []), [currentMonday]);
  const sunday = weekDays[6] ?? "";

  const prevMonday = useMemo(() => (currentMonday ? shiftLocalDate(currentMonday, -7) : ""), [currentMonday]);
  const prevSunday = useMemo(() => (prevMonday ? shiftLocalDate(prevMonday, 6) : ""), [prevMonday]);

  // Fetch current + previous week
  useEffect(() => {
    if (!supabase || !currentMonday || !sunday || !prevMonday || !prevSunday) return;
    const client: SupabaseClient = supabase;
    let active = true;

    async function run() {
      setLoading(true);
      const [current, prev] = await Promise.all([
        fetchWeekTasks(client, currentMonday, sunday, boardId),
        fetchWeekTasks(client, prevMonday, prevSunday, boardId),
      ]);

      if (!active) return;
      setTasks((current.data as TaskRecord[]) ?? []);
      setPrevTasks((prev.data as TaskRecord[]) ?? []);
      setLoading(false);
    }

    void run();
    return () => { active = false; };
  }, [supabase, currentMonday, sunday, prevMonday, prevSunday, boardId]);

  /* ───── derived stats ───── */

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => isCompletedStatus(t.status)).length;
  const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const prevTotalCount = prevTasks.length;
  const prevCompletedCount = prevTasks.filter((t) => isCompletedStatus(t.status)).length;
  const prevCompletionRate = prevTotalCount === 0 ? 0 : Math.round((prevCompletedCount / prevTotalCount) * 100);
  const rateDiff = completionRate - prevCompletionRate;

  // Per-day stats
  const dayStats: DayStat[] = useMemo(() => {
    return weekDays.map((date) => {
      const dayTasks = tasks.filter((t) => t.due_date === date);
      return {
        date,
        total: dayTasks.length,
        completed: dayTasks.filter((t) => isCompletedStatus(t.status)).length,
        helpCount: dayTasks.filter((t) => t.status === "needs_help").length,
      };
    });
  }, [tasks, weekDays]);

  // Subject stats
  const subjectStats: SubjectStat[] = useMemo(() => {
    const map = new Map<string, SubjectStat>();
    for (const t of tasks) {
      const subject = t.subject?.trim() || "其他";
      const existing = map.get(subject) ?? { subject, total: 0, completed: 0, helpCount: 0 };
      existing.total++;
      if (isCompletedStatus(t.status)) existing.completed++;
      if (t.status === "needs_help") existing.helpCount++;
      map.set(subject, existing);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [tasks]);

  // Consecutive full-completion days (streak ending at today or last day with tasks)
  const streak = useMemo(() => {
    let count = 0;
    // Walk backwards from Sunday (or today if this week)
    const relevantDays = [...weekDays].reverse();
    for (const date of relevantDays) {
      const dayTasks = tasks.filter((t) => t.due_date === date);
      if (dayTasks.length === 0) continue; // skip days with no tasks
      const allDone = dayTasks.every((t) => isCompletedStatus(t.status));
      if (allDone) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [tasks, weekDays]);

  // Help frequency by subject
  const helpStats = useMemo(() => {
    return subjectStats
      .filter((s) => s.helpCount > 0)
      .sort((a, b) => b.helpCount - a.helpCount);
  }, [subjectStats]);

  const maxDayTotal = Math.max(...dayStats.map((d) => d.total), 1);

  /* ───── week label ───── */
  const weekLabel = weekDays.length > 0
    ? `${shortDate(weekDays[0])} — ${shortDate(weekDays[6])}`
    : "";

  const isThisWeek = weekOffset === 0;

  if (!supabase) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <SetupNotice />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">周报统计</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          学习完成情况
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`rounded-[12px] border px-3 py-2 text-sm font-semibold ${
              isThisWeek
                ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                : "border-[var(--line)] bg-[var(--card-alt)] text-[var(--text-secondary)]"
            }`}
          >
            本周
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(-1)}
            className={`rounded-[12px] border px-3 py-2 text-sm font-semibold ${
              weekOffset === -1
                ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                : "border-[var(--line)] bg-[var(--card-alt)] text-[var(--text-secondary)]"
            }`}
          >
            上周
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
          >
            ← 更早
          </button>
          <button
            type="button"
            disabled={isThisWeek}
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
          >
            更近 →
          </button>
          <span className="ml-1 text-sm text-[var(--text-secondary)]">{weekLabel}</span>
        </div>
      </div>

      {/* Export button — only show when there are tasks */}
      {!loading && totalCount > 0 ? (
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => exportCSV(tasks, weekLabel)}
            className="rounded-[12px] border border-[var(--line)] bg-card px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            ⬇ 导出 CSV
          </button>
        </div>
      ) : null}

      {loading ? (
        <CardSkeleton />
      ) : totalCount === 0 ? (
        <EmptyState
          title="这周还没有任务记录"
          description="有任务数据后，这里会展示完成情况统计。"
        />
      ) : (
        <div className="space-y-5">

          {/* ───── Overview Cards ───── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Completion Rate */}
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-medium text-[var(--text-tertiary)]">本周完成率</p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{completionRate}%</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {completedCount}/{totalCount} 个任务
              </p>
              {prevTotalCount > 0 ? (
                <p className={`mt-2 text-xs font-medium ${
                  rateDiff > 0 ? "text-[var(--success)]" : rateDiff < 0 ? "text-[var(--error)]" : "text-[var(--text-tertiary)]"
                }`}>
                  {rateDiff > 0 ? "↑" : rateDiff < 0 ? "↓" : "→"} 较上周 {rateDiff > 0 ? "+" : ""}{rateDiff}%
                </p>
              ) : null}
            </div>

            {/* Streak */}
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-medium text-[var(--text-tertiary)]">连续全部完成</p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{streak} <span className="text-lg font-semibold text-[var(--text-secondary)]">天</span></p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {streak === 0 ? "继续努力" : streak >= 5 ? "非常棒" : "保持下去"}
              </p>
            </div>

            {/* Help Count */}
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-medium text-[var(--text-tertiary)]">求助次数</p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {tasks.filter((t) => t.status === "needs_help").length}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {helpStats.length > 0
                  ? `${helpStats[0].subject}最多（${helpStats[0].helpCount}次）`
                  : "本周没有求助"}
              </p>
            </div>
          </div>

          {/* ───── Daily Bar Chart ───── */}
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-base font-semibold text-[var(--foreground)]">每日完成情况</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">绿色为已完成，灰色为未完成</p>
            <div className="mt-5 flex items-end gap-2 sm:gap-3" style={{ height: "180px" }}>
              {dayStats.map((day) => {
                const barHeight = day.total === 0 ? 0 : (day.total / maxDayTotal) * 100;
                const completedHeight = day.total === 0 ? 0 : (day.completed / maxDayTotal) * 100;
                const isToday = day.date === today;

                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                    {/* Numbers */}
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {day.total > 0 ? `${day.completed}/${day.total}` : "—"}
                    </span>
                    {/* Bar */}
                    <div className="relative w-full" style={{ height: "130px" }}>
                      <div className="absolute inset-x-0 bottom-0 flex flex-col items-stretch">
                        {/* Total bar (gray) */}
                        <div
                          className="rounded-t-md bg-[var(--line-light)] transition-[height] duration-300"
                          style={{ height: `${barHeight * 1.3}px` }}
                        >
                          {/* Completed overlay (green) */}
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-t-md bg-[var(--success)] transition-[height] duration-300"
                            style={{ height: `${completedHeight * 1.3}px` }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Label */}
                    <div className="text-center">
                      <p className={`text-xs font-medium ${isToday ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"}`}>
                        {shortWeekday(day.date)}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{shortDate(day.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ───── Subject Distribution ───── */}
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-base font-semibold text-[var(--foreground)]">学科分布</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">各学科任务量和完成率</p>
            <div className="mt-4 space-y-3">
              {subjectStats.map((stat) => {
                const rate = stat.total === 0 ? 0 : Math.round((stat.completed / stat.total) * 100);
                return (
                  <div key={stat.subject}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${subjectDotClass(stat.subject)}`} />
                        <span className="text-sm font-medium text-[var(--foreground)]">{stat.subject}</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {stat.completed}/{stat.total} 完成（{rate}%）
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--line-light)]">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${subjectBarClass(stat.subject)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ───── Help Frequency ───── */}
          {helpStats.length > 0 ? (
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-base font-semibold text-[var(--foreground)]">求助分析</h2>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                孩子点击“需要帮助”的学科分布，可关注薄弱环节
              </p>
              <div className="mt-4 space-y-2.5">
                {helpStats.map((stat) => (
                  <div key={stat.subject} className="flex items-center justify-between rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)]/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${subjectDotClass(stat.subject)}`} />
                      <span className="text-sm font-medium text-[var(--foreground)]">{stat.subject}</span>
                    </div>
                    <span className="rounded-full bg-[var(--warning-subtle)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                      {stat.helpCount} 次求助
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* AI 点评 */}
          <AIWeeklyReview
            boardId={boardId}
            weekLabel={weekLabel}
            total={totalCount}
            completed={completedCount}
            completionRate={completionRate}
            prevRate={prevCompletionRate}
            streak={streak}
            dayStats={dayStats}
            subjectStats={subjectStats}
          />

        </div>
      )}
    </div>
  );
}

/* ─────────────── AI 周报点评 ─────────────── */

function AIWeeklyReview({
  boardId,
  weekLabel,
  total,
  completed,
  completionRate,
  prevRate,
  streak,
  dayStats,
  subjectStats,
}: {
  boardId: string;
  weekLabel: string;
  total: number;
  completed: number;
  completionRate: number;
  prevRate: number;
  streak: number;
  dayStats: DayStat[];
  subjectStats: SubjectStat[];
}) {
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: boardId,
          week_label: weekLabel,
          total,
          completed,
          completion_rate: completionRate,
          prev_rate: prevRate,
          streak,
          day_stats: dayStats.map((d) => ({
            ...d,
            weekday: weekdayNames[new Date(`${d.date}T00:00:00`).getDay()],
          })),
          subject_stats: subjectStats,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI 点评失败");
      } else {
        setReview(data.review);
      }
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }, [boardId, weekLabel, total, completed, completionRate, prevRate, streak, dayStats, subjectStats]);

  if (total === 0) return null;

  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-base font-semibold text-[var(--foreground)]">AI 点评</h2>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">根据本周数据给出学习建议</p>

      {!review && !loading && !error && (
        <button
          type="button"
          onClick={generateReview}
          className="mt-4 w-full rounded-[12px] border border-dashed border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          ✨ 生成 AI 点评
        </button>
      )}

      {loading && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">分析中...</p>
      )}

      {error && (
        <div className="mt-4">
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            type="button"
            onClick={generateReview}
            className="mt-2 text-xs font-medium text-[var(--primary)]"
          >
            重试
          </button>
        </div>
      )}

      {review && (
        <div className="mt-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--foreground)]">
            {review}
          </p>
          <button
            type="button"
            onClick={generateReview}
            className="mt-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary)]"
          >
            重新生成
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── subject color helpers ───── */

function subjectDotClass(subject: string) {
  switch (subject) {
    case "语文": return "bg-[var(--subject-chinese)]";
    case "数学": return "bg-[var(--subject-math)]";
    case "英语": return "bg-[var(--subject-english)]";
    default: return "bg-[var(--primary)]";
  }
}

function subjectBarClass(subject: string) {
  switch (subject) {
    case "语文": return "bg-[var(--subject-chinese)]";
    case "数学": return "bg-[var(--subject-math)]";
    case "英语": return "bg-[var(--subject-english)]";
    default: return "bg-[var(--primary)]";
  }
}
