import { TASK_STATUS_META } from "@/lib/task-status";
import type { TaskStatus } from "@/types/task";

export function StatusPill({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}
