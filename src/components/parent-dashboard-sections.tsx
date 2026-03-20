import Image from "next/image";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import type {
  AttachmentRole,
  SubjectTaskGroup,
  TaskAttachmentRecord,
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

function attachmentRoleLabel(role: AttachmentRole) {
  switch (role) {
    case "reference":
      return "参考图片";
    case "instruction":
      return "老师说明";
    case "parent_only":
      return "仅家长可见";
  }
}

function attachmentRoleClass(role: AttachmentRole) {
  switch (role) {
    case "reference":
      return "bg-[var(--info-subtle)] text-[var(--info)]";
    case "instruction":
      return "bg-[var(--warning-subtle)] text-[var(--warning)]";
    case "parent_only":
      return "bg-[var(--card-alt)] text-[var(--text-secondary)]";
  }
}

type ProgressSummary = {
  total: number;
  done: number;
  help: number;
};

function taskStatusWeight(status: TaskRecord["status"]) {
  switch (status) {
    case "needs_help":
      return 0;
    case "in_progress":
      return 1;
    case "pending":
      return 2;
    case "done_by_child":
      return 3;
    case "confirmed_by_parent":
      return 4;
  }
}

export function ParentHeader({
  todayLabel,
  progress,
  selectedDate,
  yesterdayDate,
  onDateChange,
  onJumpToToday,
  onJumpToYesterday,
  isToday,
}: {
  todayLabel: string;
  progress: ProgressSummary;
  selectedDate: string;
  yesterdayDate: string;
  onDateChange: (value: string) => void;
  onJumpToToday: () => void;
  onJumpToYesterday: () => void;
  isToday: boolean;
}) {
  const isYesterday = selectedDate === yesterdayDate;

  return (
    <section className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card px-5 py-5 md:px-8 md:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--primary)]">家长端</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-[var(--foreground)]">
            今天的学习任务
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {todayLabel}
            {isToday ? "，固定设备会实时同步这里的内容。" : "，这里展示这一天的历史任务。"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onJumpToToday}
              className={`rounded-[12px] border px-3 py-2 text-sm font-semibold ${
                isToday
                  ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                  : "border-[var(--line)] bg-[var(--card-alt)] text-[var(--text-secondary)]"
              }`}
            >
              今天
            </button>
            <button
              type="button"
              onClick={onJumpToYesterday}
              className={`rounded-[12px] border px-3 py-2 text-sm font-semibold ${
                isYesterday
                  ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                  : "border-[var(--line)] bg-[var(--card-alt)] text-[var(--text-secondary)]"
              }`}
            >
              昨天
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[300px]">
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/45 px-3 py-3">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {progress.total}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">总任务</p>
            </div>
          </div>
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--success-subtle)] px-3 py-3">
            <div>
              <p className="text-2xl font-bold text-[var(--success)]">
                {progress.done}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">已完成</p>
            </div>
          </div>
          <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--warning-subtle)] px-3 py-3">
            <div>
              <p className="text-2xl font-bold text-[var(--warning)]">
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

export function HistoricalTasksNotice({
  selectedDateLabel,
}: {
  selectedDateLabel: string;
}) {
  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">历史任务查看</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        当前正在查看 {selectedDateLabel} 的任务记录。历史日期先保持只读，避免误改以前的完成情况。
      </p>
      <div className="mt-3 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        如果要新增、导入或加入固定任务，请先切回今天。
      </div>
    </div>
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
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">手动新增</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        适合临时增加当天的新任务，孩子端会马上同步显示。
      </p>
      <div className="mt-4 rounded-[1rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="例如：完成数学口算 2 页"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <textarea
            value={details}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="可选：备注难点、页码、截止时间"
            rows={3}
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={onCreate}
            className="w-full rounded-[12px] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">每天固定任务</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            先维护常用模板，再一键加入今天任务，避免每天重复录入。
          </p>
        </div>
        <button
          type="button"
          disabled={addDisabled}
          onClick={onAddToToday}
          className="rounded-[12px] border border-[var(--primary)] bg-card px-4 py-2.5 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          一键加入
        </button>
      </div>

      <div className="mt-4 rounded-[1rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.9fr]">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="固定任务标题，例如：英语听读 15 分钟"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <input
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            placeholder="学科，可选，例如：英语"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
        </div>
        <textarea
          value={details}
          onChange={(event) => onDetailsChange(event.target.value)}
          placeholder="备注，可选"
          rows={2}
          className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
        <button
          type="button"
          disabled={createDisabled}
          onClick={onCreate}
          className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存为固定任务
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {templates.length === 0 ? (
          <div className="rounded-[1rem] bg-[var(--card-alt)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            还没有固定任务模板，先加一条每天都会出现的常规任务。
          </div>
        ) : (
          templates.map((template) => (
            <article
              key={template.id}
              className={`relative overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/40 p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${subjectAccentClass(template.subject)}`}
            >
              <div className="flex flex-col gap-3 pl-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {template.subject ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${subjectPillClass(template.subject)}`}>
                        {template.subject}
                      </span>
                    ) : null}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${templateStateClass(template.is_active)}`}>
                      {template.is_active ? "启用中" : "已停用"}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">
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
                    className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    {template.is_active ? "停用" : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(template.id)}
                    className="rounded-[12px] px-3 py-1.5 text-sm font-semibold text-[var(--error)]"
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
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">导入预览</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        支持把钉钉群里的文字先按学科分组，再拆成孩子可执行的子任务。
      </p>
      <div className="mt-4 rounded-[1rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4">
        <textarea
          value={rawText}
          onChange={(event) => onRawTextChange(event.target.value)}
          placeholder="例如：语文：预习第5课，抄写生字两遍。数学：完成口算2页，订正错题。"
          rows={8}
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
      </div>
      <div className="mt-4 rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">任务拆分预览</h3>
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
            className="rounded-[12px] border border-[var(--primary)] bg-card px-4 py-2.5 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttachmentSection({
  attachments,
  subject,
  note,
  role,
  visibleToChild,
  uploading,
  disabled,
  onSubjectChange,
  onNoteChange,
  onRoleChange,
  onVisibleToChildChange,
  onUpload,
  onDelete,
  onMove,
}: {
  attachments: TaskAttachmentRecord[];
  subject: string;
  note: string;
  role: AttachmentRole;
  visibleToChild: boolean;
  uploading: boolean;
  disabled: boolean;
  onSubjectChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onRoleChange: (value: AttachmentRole) => void;
  onVisibleToChildChange: (value: boolean) => void;
  onUpload: (file: File | null) => void;
  onDelete: (attachment: TaskAttachmentRecord) => void;
  onMove: (attachment: TaskAttachmentRecord, direction: "up" | "down") => void;
}) {
  const groupedAttachments = attachments.reduce<Record<string, TaskAttachmentRecord[]>>((acc, attachment) => {
    const key = attachment.subject?.trim() || "其他";
    acc[key] ??= [];
    acc[key].push(attachment);
    return acc;
  }, {});

  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">老师图片资料</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        图片作为参考资料保存，不会自动生成任务。先按学科归组，孩子需要时再点开查看。
      </p>

      <div className="mt-4 rounded-[1rem] border border-[var(--line-light)] bg-[var(--card-alt)]/55 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            placeholder="归属学科，例如：英语"
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
          />
          <select
            value={role}
            onChange={(event) => onRoleChange(event.target.value as AttachmentRole)}
            className="w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="reference">参考图片</option>
            <option value="instruction">老师说明</option>
            <option value="parent_only">仅家长可见</option>
          </select>
        </div>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="补充一句孩子能理解的说明，例如：先看老师要求，再做下面练习。"
          rows={2}
          className="mt-3 w-full rounded-[12px] border border-[var(--line)] bg-card px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={visibleToChild}
            disabled={role === "parent_only"}
            onChange={(event) => onVisibleToChildChange(event.target.checked)}
          />
          显示给孩子端
        </label>
        <input
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(event) => {
            onUpload(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
          className="mt-3 block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:rounded-[12px] file:border file:border-[var(--line)] file:bg-card file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[var(--foreground)]"
        />
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {uploading ? "正在上传图片..." : "上传后会按当前学科归类，孩子端通过“查看参考图片”打开。"}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {Object.keys(groupedAttachments).length === 0 ? (
          <div className="rounded-[1rem] bg-[var(--card-alt)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            还没有老师图片资料，上传后会按学科分组展示在这里。
          </div>
        ) : (
          Object.entries(groupedAttachments).map(([groupSubject, groupItems]) => (
            <section
              key={groupSubject}
              className="overflow-hidden rounded-[1rem] border border-[var(--line)] bg-card"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line-light)] bg-[var(--card-alt)]/70 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--foreground)]">{groupSubject}</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {groupItems.length} 张图片资料
                  </p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {groupItems.map((attachment, index) => (
                  <article
                    key={attachment.id}
                    className={`relative overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/40 p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${subjectAccentClass(attachment.subject)}`}
                  >
                    <div className="flex flex-col gap-4 pl-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${attachmentRoleClass(attachment.role)}`}>
                          {attachmentRoleLabel(attachment.role)}
                        </span>
                        <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                          {attachment.visible_to_child ? "孩子可见" : "仅家长查看"}
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-[132px_1fr]">
                        <div className="relative h-32 w-full overflow-hidden rounded-[0.9rem] border border-[var(--line)]">
                          <Image
                            src={attachment.public_url}
                            alt={attachment.note ?? `${groupSubject} 参考图片`}
                            fill
                            sizes="132px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            图片 {index + 1}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {attachment.note || "还没有补充说明。"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => onMove(attachment, "up")}
                              className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
                            >
                              上移
                            </button>
                            <button
                              type="button"
                              disabled={index === groupItems.length - 1}
                              onClick={() => onMove(attachment, "down")}
                              className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-40"
                            >
                              下移
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(attachment)}
                              className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--error)]"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export function LiveStatusSection({
  tasks,
  selectedDate,
  loading,
  message,
  highlightedTaskId,
  onStatusChange,
  onDelete,
  readOnly,
  emptyDescription,
}: {
  tasks: TaskRecord[];
  selectedDate: string;
  loading: boolean;
  message: string | null;
  highlightedTaskId: string | null;
  onStatusChange: (id: string, status: TaskRecord["status"]) => void;
  onDelete: (id: string) => void;
  readOnly: boolean;
  emptyDescription: string;
}) {
  const groupedTasks = tasks.reduce<
    { subject: string; tasks: TaskRecord[] }[]
  >((acc, task) => {
    const subject = task.subject?.trim() || "今日任务";
    const existing = acc.find((item) => item.subject === subject);

    if (existing) {
      existing.tasks.push(task);
    } else {
      acc.push({ subject, tasks: [task] });
    }

    return acc;
  }, []);

  const orderedGroups = groupedTasks.map((group) => ({
    ...group,
    tasks: [...group.tasks].sort((left, right) => {
      const weightDiff = taskStatusWeight(left.status) - taskStatusWeight(right.status);

      if (weightDiff !== 0) {
        return weightDiff;
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.created_at.localeCompare(right.created_at);
    }),
  }));

  return (
    <div className="soft-shadow rounded-[1.5rem] border border-[var(--line)] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">孩子端实时状态</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {readOnly
              ? "历史日期默认不新增任务，但可以把误点完成的任务恢复为待开始。"
              : "家长可在这里确认完成，或删除当天任务。"}
          </p>
        </div>
        {message ? (
          <div className="rounded-full bg-[rgba(91,155,213,0.12)] px-4 py-2 text-sm font-medium text-[rgba(58,107,160,1)]">
            {message}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 rounded-[1rem] bg-[var(--card-alt)] p-5 text-[var(--text-secondary)]">
          正在同步任务...
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="今天还没有任务"
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {orderedGroups.map((group) => (
            <section
              key={group.subject}
              className={`relative overflow-hidden rounded-[1rem] border border-[var(--line)] bg-[var(--card-alt)]/45 p-3 before:absolute before:inset-y-0 before:left-0 before:w-1 ${
                subjectAccentClass(group.subject === "今日任务" ? null : group.subject)
              }`}
            >
              <div className="rounded-[1rem] bg-card/65 px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="pl-2 text-base font-semibold text-[var(--foreground)]">
                    {group.subject}
                  </h3>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {group.tasks.length} 条任务
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {group.tasks.map((task) => (
                  <article
                    key={task.id}
                    className={`soft-shadow relative overflow-hidden rounded-[1rem] border border-[var(--line)] p-4 ${
                      task.status === "confirmed_by_parent"
                        ? "bg-[var(--card-alt)] opacity-75"
                        : "bg-card"
                    } ${highlightedTaskId === task.id ? "status-change-pulse" : ""}`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={task.status} />
                            {task.due_date !== selectedDate ? (
                              <span className="rounded-full border border-[var(--line-light)] bg-[var(--card-alt)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                之前没完成
                              </span>
                            ) : null}
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourcePillClass(task.source)}`}>
                              {sourceLabel(task.source)}
                            </span>
                          </div>
                          <h4
                            className={`mt-2 text-base font-medium text-[var(--foreground)] ${
                              task.status === "confirmed_by_parent" ? "line-through decoration-2" : ""
                            }`}
                          >
                            {task.title}
                          </h4>
                          {task.details ? (
                            <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">
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
                      {readOnly ? (
                        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line-light)] pt-3">
                          <button
                            type="button"
                            onClick={() => onStatusChange(task.id, "pending")}
                            className="rounded-[12px] border border-[var(--line)] bg-[var(--card-alt)]/45 px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
                          >
                            ↺ 重置为待开始
                          </button>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            历史日期仅支持恢复误点状态
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line-light)] pt-3">
                          <button
                            type="button"
                            onClick={() => onStatusChange(task.id, "confirmed_by_parent")}
                            className="rounded-[12px] bg-[var(--success)] px-3.5 py-2 text-sm font-semibold text-white"
                          >
                            ✓ 确认完成
                          </button>
                          <button
                            type="button"
                            onClick={() => onStatusChange(task.id, "pending")}
                            className="rounded-[12px] border border-[var(--line)] bg-card px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
                          >
                            ↺ 重置
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(task.id)}
                            className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--error)]/70"
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
