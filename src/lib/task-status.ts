import type { TaskStatus } from "@/types/task";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; childLabel: string }
> = {
  pending: {
    label: "待开始",
    childLabel: "还没开始",
    tone: "bg-[var(--card-alt)] text-[var(--text-secondary)]",
  },
  in_progress: {
    label: "进行中",
    childLabel: "正在做",
    tone: "bg-[var(--warning-subtle)] text-[var(--warning)]",
  },
  done_by_child: {
    label: "孩子已完成",
    childLabel: "我做完啦",
    tone: "bg-[var(--success-subtle)] text-[var(--success)]",
  },
  needs_help: {
    label: "需要帮助",
    childLabel: "需要帮助",
    tone: "bg-[var(--warning-subtle)] text-[var(--warning)]",
  },
  confirmed_by_parent: {
    label: "家长已确认",
    childLabel: "家长确认啦",
    tone: "bg-[var(--info-subtle)] text-[var(--info)]",
  },
};
