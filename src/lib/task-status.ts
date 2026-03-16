import type { TaskStatus } from "@/types/task";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; childLabel: string }
> = {
  pending: {
    label: "待开始",
    childLabel: "还没开始",
    tone: "bg-slate-100 text-slate-700",
  },
  in_progress: {
    label: "进行中",
    childLabel: "正在做",
    tone: "bg-amber-100 text-amber-900",
  },
  done_by_child: {
    label: "孩子已完成",
    childLabel: "我做完啦",
    tone: "bg-emerald-100 text-emerald-900",
  },
  needs_help: {
    label: "需要帮助",
    childLabel: "需要帮助",
    tone: "bg-rose-100 text-rose-900",
  },
  confirmed_by_parent: {
    label: "家长已确认",
    childLabel: "家长确认啦",
    tone: "bg-sky-100 text-sky-900",
  },
};
