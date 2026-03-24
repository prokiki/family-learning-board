"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatLocalDate } from "@/lib/date";
import type { TaskRecord, TaskStatus } from "@/types/task";

function isCompleted(status: TaskStatus) {
  return status === "done_by_child" || status === "confirmed_by_parent";
}

/** 生成对齐到周一的日历格子（4 周 + 本周到今天） */
function calendarDays(weeks: number): string[] {
  const now = new Date();
  // 找到本周的周一
  const dayOfWeek = now.getDay(); // 0=周日 1=周一 ... 6=周六
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMonday);

  // 往前推 weeks 周
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - weeks * 7);

  const result: string[] = [];
  const d = new Date(startMonday);
  while (d <= now) {
    result.push(formatLocalDate(d));
    d.setDate(d.getDate() + 1);
  }
  return result;
}

type DayStatus = "full" | "partial" | "none" | "empty";

export function LearningCalendar({ boardId, refreshKey = 0 }: { boardId: string; refreshKey?: number }) {
  const supabase = getSupabaseBrowserClient();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const days = useMemo(() => calendarDays(3), []); // 本周 + 前 3 周

  useEffect(() => {
    if (!supabase) return;
    const startDate = days[0];
    const endDate = days[days.length - 1];

    supabase
      .from("tasks")
      .select("due_date, status")
      .eq("board_id", boardId)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .then(({ data }) => {
        if (data) setTasks(data as TaskRecord[]);
      });
  }, [supabase, boardId, days, refreshKey]);

  const dayStatusMap = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const day of days) {
      const dayTasks = tasks.filter((t) => t.due_date === day);
      if (dayTasks.length === 0) {
        map.set(day, "empty");
      } else if (dayTasks.every((t) => isCompleted(t.status))) {
        map.set(day, "full");
      } else if (dayTasks.some((t) => isCompleted(t.status))) {
        map.set(day, "partial");
      } else {
        map.set(day, "none");
      }
    }
    return map;
  }, [days, tasks]);

  /* 连续完成天数 streak（从今天往回数） */
  const streak = useMemo(() => {
    let count = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const status = dayStatusMap.get(days[i]);
      if (status === "full") {
        count++;
      } else if (status === "empty") {
        continue; // 没有作业的天不中断 streak
      } else {
        break;
      }
    }
    return count;
  }, [days, dayStatusMap]);

  const statusColor: Record<DayStatus, string> = {
    full: "bg-[var(--success)]",
    partial: "bg-[var(--warning)]",
    none: "bg-[var(--line)]",
    empty: "bg-transparent border border-[var(--line-light)]",
  };

  if (!supabase) return null;

  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">学习日历</p>
        {streak > 0 && (
          <p className="text-xs font-semibold text-[var(--success)]">
            🔥 连续 {streak} 天全部完成
          </p>
        )}
      </div>
      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <p key={w} className="text-center text-[10px] text-[var(--text-muted)]">{w}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const status = dayStatusMap.get(day) || "empty";
          const d = new Date(`${day}T00:00:00`);
          const dateNum = d.getDate();
          const isToday = day === days[days.length - 1];
          return (
            <div
              key={day}
              title={`${d.getMonth() + 1}/${dateNum} ${status === "full" ? "✓ 全部完成" : status === "partial" ? "部分完成" : status === "none" ? "未完成" : "无作业"}`}
              className={`flex aspect-square items-center justify-center rounded-[6px] ${statusColor[status]} ${isToday ? "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--card)]" : ""}`}
            >
              <span className={`text-[10px] font-medium ${
                status === "full" ? "text-white" : status === "partial" ? "text-white" : isToday ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
              }`}>
                {dateNum}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[var(--success)]" />全部完成</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[var(--warning)]" />部分完成</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[var(--line)]" />未完成</span>
      </div>
    </div>
  );
}
