export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "done_by_child",
  "needs_help",
  "confirmed_by_parent",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskSource = "manual" | "imported" | "template";

export type TaskCategory = "school" | "extra";

export type Actor = "parent" | "child";

export const ATTACHMENT_ROLES = ["reference", "instruction", "parent_only"] as const;

export type AttachmentRole = (typeof ATTACHMENT_ROLES)[number];

export interface TaskRecord {
  id: string;
  board_id: string;
  due_date: string;
  template_id: string | null;
  subject: string | null;
  title: string;
  details: string | null;
  status: TaskStatus;
  sort_order: number;
  source: TaskSource;
  category: TaskCategory;
  last_updated_by: Actor;
  created_at: string;
  updated_at: string;
}

export interface TaskDraft {
  templateId?: string;
  subject?: string;
  title: string;
  details?: string;
}

export interface TaskAttachmentRecord {
  id: string;
  board_id: string;
  due_date: string;
  subject: string | null;
  storage_path: string;
  public_url: string;
  note: string | null;
  role: AttachmentRole;
  visible_to_child: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectTaskGroup {
  subject: string;
  tasks: TaskDraft[];
}

export interface TaskTemplateRecord {
  id: string;
  board_id: string;
  subject: string | null;
  title: string;
  details: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
