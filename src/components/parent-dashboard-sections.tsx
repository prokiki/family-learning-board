import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import type {
  SubjectTaskGroup,
  TaskDraft,
  TaskRecord,
  TaskSource,
  TaskTemplateRecord,
} from "@/types/task";

function subjectPillClass(subject: string | null) {
  switch (subject) {
    case "语文":
      return "bg-[var(--subject-chinese-bg)] text-[var(--subject-chinese)]";
    case "数学":
      return "bg-[var(--subject-math-bg)] text-[var(--subject-math)]";
    case "英语":
      return "bg-[var(--subject-english-bg)] text-[var(--subject-english)]";
    default:
      return "bg-[var(--card-alt)] text-[var(--text-secondary)]";
  }
}

function sourceLabel(source: TaskSource) {
  if (source === "imported") {
    return "导入";
  }

  if (source === "template") {
    return "固定";
  }

  return "手动";
}

function templateStateClass(isActive: boolean) {
  return isActive
    ? "bg-[var(--success-subtle)] text-[var(--success)]"
    : "bg-[var(--card-alt)] text-[var(--text-secondary)]";
}

function sourcePillClass(source: TaskSource) {
  if (source === "imported") {
    return "bg-[var(--info-subtle)] text-[var(--info)]";
  }

  if (source === "template") {
    return "bg-[var(--subject-english-bg)] text-[var(--subject-english)]";
  }

  return "bg-[var(--card-alt)] text-[var(--text-secondary)]";
}

function subjectAccentClass(subject: string | null) {
  switch (subject) {
    case "语文":
      return "before:bg-[var(--subject-chinese)]";
    case "数学":
      return "before:bg-[var(--subject-math)]";
    case "英语":
      return "before:bg-[var(--subject-english)]";
    default:
      return "before:bg-[var(--primary)]";
  }
}

type ProgressSummary = {
  total: number;
  done: number;
  help: number;
};

export function ParentHeader({
  todayLabel,
  progress,
}: {
  todayLabel: string;
  progress: ProgressSummary;
}) {
  return (
    <section className="soft-shadow rounded-[1.75rem] border border-[var(--line)] bg-card px-5 py-5 md:px-8 md:py-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--primary)]">家长端</p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-[var(--foreground)] md:text-[2rem]">
            今天的学习任务
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            {todayLabel}，固定设备会实时同步这里的内容。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[320px]">
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/45 px-3 py-3 sm:px-4 sm:py-4">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                {progress.total}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">总任务</p>
            </div>
          </div>
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--success-subtle)] px-3 py-3 sm:px-4 sm:py-4">
            <div>
              <p className="text-2xl font-bold text-[var(--success)] sm:text-3xl">
                {progress.done}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">已推进</p>
            </div>
          </div>
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--warning-subtle)] px-3 py-3 sm:px-4 sm:py-4">
            <div>
              <p className="text-2xl font-bold text-[var(--warning)] sm:text-3xl">
                {progress.help}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">待协助</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ManualTaskSection({
  title,
  details,
  onTitleChange,
  onDetailsChange,
  onCreate,
  disabled,
}: {
  title: string;
  details: string;
  onTitleChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onCreate: () => void;
  disabled: boolean;
}) {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">手动新增</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            适合临时增加当天的新任务，孩子端会马上同步显示。
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="例如：完成数学口算 2 页"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <textarea
            value={details}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="可选：备注难点、页码、截止时间"
            rows={3}
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={onCreate}
            className="w-full rounded-[12px] bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            添加到今日任务
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplatesSection({
  templates,
  title,
  subject,
  details,
  onTitleChange,
  onSubjectChange,
  onDetailsChange,
  onCreate,
  onAddToToday,
  onToggle,
  onDelete,
  createDisabled,
  addDisabled,
}: {
  templates: TaskTemplateRecord[];
  title: string;
  subject: string;
  details: string;
  onTitleChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onCreate: () => void;
  onAddToToday: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  createDisabled: boolean;
  addDisabled: boolean;
}) {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">每天固定任务</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            先维护常用模板，再一键加入今天任务，避免每天重复录入。
          </p>
        </div>
        <button
          type="button"
          disabled={addDisabled}
          onClick={onAddToToday}
          className="rounded-[12px] border border-[var(--primary)] bg-card px-5 py-3 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          一键加入
        </button>
      </div>

      <div className="mt-4 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.9fr]">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="固定任务标题，例如：英语听读 15 分钟"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <input
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            placeholder="学科，可选，例如：英语"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
        </div>
        <textarea
          value={details}
          onChange={(event) => onDetailsChange(event.target.value)}
          placeholder="备注，可选"
          rows={2}
          className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
        <button
          type="button"
          disabled={createDisabled}
          onClick={onCreate}
          className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-5 py-3 text-base font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存为固定任务
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {templates.length === 0 ? (
          <div className="rounded-[1rem] bg-[var(--card-alt)] px-4 py-5 text-sm text-[var(--text-secondary)]">
            还没有固定任务模板，先加一条每天都会出现的常规任务。
          </div>
        ) : (
          templates.map((template) => (
            <article
              key={template.id}
              className={`relative overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/40 p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${subjectAccentClass(template.subject)}`}
            >
              <div className="flex flex-col gap-4 pl-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {template.subject ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subjectPillClass(template.subject)}`}>
                        {template.subject}
                      </span>
                    ) : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${templateStateClass(template.is_active)}`}>
                      {template.is_active ? "启用中" : "已停用"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[var(--foreground)] md:text-lg">
                    {template.title}
                  </h3>
                  {template.details ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      {template.details}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onToggle(template.id, template.is_active)}
                    className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    {template.is_active ? "停用" : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(template.id)}
                    className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--error)]"
                  >
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function ImportPreviewSection({
  rawText,
  groups,
  drafts,
  onRawTextChange,
  onTaskUpdate,
  onTaskDelete,
  onTaskAdd,
  onImport,
  importDisabled,
}: {
  rawText: string;
  groups: SubjectTaskGroup[];
  drafts: TaskDraft[];
  onRawTextChange: (value: string) => void;
  onTaskUpdate: (subjectIndex: number, taskIndex: number, title: string) => void;
  onTaskDelete: (subjectIndex: number, taskIndex: number) => void;
  onTaskAdd: (subjectIndex: number) => void;
  onImport: () => void;
  importDisabled: boolean;
}) {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
      <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">导入预览</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        支持把钉钉群里的文字先按学科分组，再拆成孩子可执行的子任务。
      </p>
      <div className="mt-4 rounded-[1.15rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4 md:p-5">
        <textarea
          value={rawText}
          onChange={(event) => onRawTextChange(event.target.value)}
          placeholder="例如：语文：预习第5课，抄写生字两遍。数学：完成口算2页，订正错题。"
          rows={8}
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-4 text-base outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
      </div>
      <div className="mt-5 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/50 p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">任务拆分预览</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              上方保留原始文本，下面按学科展示并支持逐条校对。
            </p>
          </div>
          <p className="rounded-full bg-card px-3 py-1 text-sm font-semibold text-[var(--text-secondary)]">
            共 {drafts.filter((draft) => draft.title.trim()).length} 条子任务
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="mt-4 rounded-[1rem] bg-[var(--card-alt)] px-4 py-5 text-sm text-[var(--text-secondary)]">
            贴入老师作业后，这里会显示按学科分组的预览。
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((group, subjectIndex) => (
              <section
                key={`${group.subject}-${subjectIndex}`}
                className="overflow-hidden rounded-[1rem] border border-[var(--line)] bg-card"
              >
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line-light)] bg-[var(--card-alt)]/70 px-4 py-3">
                  <div className="min-w-0">
                    <h4 className="text-base font-semibold text-[var(--foreground)]">{group.subject}</h4>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {group.tasks.length} 条可执行子任务
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTaskAdd(subjectIndex)}
                    className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    补一条
                  </button>
                </div>
                <div className="space-y-2 p-4">
                  {group.tasks.map((task, taskIndex) => (
                    <div
                      key={`${group.subject}-${taskIndex}`}
                      className="flex items-center gap-2"
                    >
                      <span className="w-8 text-center text-sm font-semibold text-slate-400">
                        {taskIndex + 1}
                      </span>
                      <input
                        value={task.title}
                        onChange={(event) => onTaskUpdate(subjectIndex, taskIndex, event.target.value)}
                        placeholder={`补充 ${group.subject} 子任务`}
                        className="flex-1 rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => onTaskDelete(subjectIndex, taskIndex)}
                        className="rounded-[10px] px-3 py-2 text-sm font-semibold text-[var(--error)]"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            disabled={importDisabled}
            onClick={onImport}
            className="rounded-[12px] border border-[var(--primary)] bg-card px-5 py-3 text-base font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveStatusSection({
  tasks,
  loading,
  message,
  highlightedTaskId,
  onStatusChange,
  onDelete,
}: {
  tasks: TaskRecord[];
  loading: boolean;
  message: string | null;
  highlightedTaskId: string | null;
  onStatusChange: (id: string, status: TaskRecord["status"]) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.5rem] font-semibold text-[var(--foreground)]">孩子端实时状态</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            家长可在这里确认完成，或删除当天任务。
          </p>
        </div>
        {message ? (
          <div className="rounded-full bg-[rgba(91,155,213,0.12)] px-4 py-2 text-sm font-medium text-[rgba(58,107,160,1)]">
            {message}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 rounded-[1rem] bg-[var(--card-alt)] p-6 text-[var(--text-secondary)]">
          正在同步任务...
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="今天还没有任务"
            description="先在左侧添加任务，孩子端会立即出现大字卡片。"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {tasks.map((task) => (
            <article
              key={task.id}
              className={`soft-shadow relative overflow-hidden rounded-[1.15rem] border border-[var(--line)] p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${
                subjectAccentClass(task.subject)
              } ${
                task.status === "confirmed_by_parent"
                  ? "bg-[var(--card-alt)] opacity-75"
                  : "bg-card"
              } ${highlightedTaskId === task.id ? "status-change-pulse" : ""}`}
            >
              <div className="flex flex-col gap-4 pl-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={task.status} />
                      {task.subject ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subjectPillClass(task.subject)}`}>
                          {task.subject}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourcePillClass(task.source)}`}>
                        {sourceLabel(task.source)}
                      </span>
                    </div>
                    <h3
                      className={`mt-3 text-lg font-medium text-[var(--foreground)] md:text-[1.125rem] ${
                        task.status === "confirmed_by_parent" ? "line-through decoration-2" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.details ? (
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        {task.details}
                      </p>
                    ) : null}
                  </div>
                  {task.status === "confirmed_by_parent" ? (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(228,246,229,0.95)] text-xl">
                      ✅
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[var(--line-light)] pt-4 md:justify-start">
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.id, "confirmed_by_parent")}
                    className="rounded-[12px] border border-[var(--success)] bg-[rgba(76,175,80,0.06)] px-4 py-2.5 text-sm font-semibold text-[var(--success)]"
                  >
                    ✓ 家长确认完成
                  </button>
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.id, "pending")}
                    className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)]/45 px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    ↺ 重置为待开始
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    className="rounded-[12px] border border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--error)]"
                  >
                    🗑 删除任务
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
