export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "done_by_child",
  "needs_help",
  "confirmed_by_parent",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskSource = "manual" | "imported";

export type Actor = "parent" | "child";

export interface TaskRecord {
  id: string;
  board_id: string;
  due_date: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  sort_order: number;
  source: TaskSource;
  last_updated_by: Actor;
  created_at: string;
  updated_at: string;
}

export interface TaskDraft {
  title: string;
  details?: string;
}
