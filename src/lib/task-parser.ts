import type { SubjectTaskGroup, TaskDraft } from "@/types/task";

const LEADING_MARKERS =
  /^(\d+[\.\)、]|[一二三四五六七八九十]+[、.]|[-•●▪︎◦]|[（(]?\d+[）)])\s*/;
const SUBJECTS = ["语文", "数学", "英语", "科学", "道法", "道德与法治"] as const;
const SUBJECT_HEADER_PATTERN = new RegExp(
  `(${SUBJECTS.map((subject) => subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:作业)?\\s*[：:]`,
  "g",
);
const PURE_SUBJECT_PATTERN = new RegExp(`^(${SUBJECTS.join("|")})(?:作业)?$`);

function cleanLine(line: string) {
  return line
    .replace(/\r/g, "")
    .replace(LEADING_MARKERS, "")
    .replace(/[；;。]+$/g, "")
    .trim();
}

function normalizeHomeworkText(rawText: string) {
  return rawText
    .replace(/\r/g, "")
    .replace(/\t/g, "\n")
    .replace(
      /(?<!\n)(语文|数学|英语|科学|道法|道德与法治)(?:作业)?\s*[：:]/g,
      "\n$1：",
    )
    .trim();
}

function splitTasks(content: string, subject: string): TaskDraft[] {
  return content
    .replace(/(^|\n)\s*[\d一二三四五六七八九十]+[\.\)、]\s*/g, "\n")
    .replace(/[。]+/g, "\n")
    .split(/[，、；;\n]+/)
    .map(cleanLine)
    .filter(Boolean)
    .filter((item) => !/^\d+$/.test(item))
    .filter((item) => !PURE_SUBJECT_PATTERN.test(item))
    .map((title) => ({ subject, title }));
}

export function parseHomeworkGroups(rawText: string): SubjectTaskGroup[] {
  const normalized = normalizeHomeworkText(rawText);

  if (!normalized) {
    return [];
  }

  const matches = [...normalized.matchAll(SUBJECT_HEADER_PATTERN)];

  if (matches.length === 0) {
    const tasks = normalized
      .split(/\n+/)
      .flatMap((line) => splitTasks(line, "其他"))
      .filter((task) => task.title);

    return tasks.length > 0 ? [{ subject: "其他", tasks }] : [];
  }

  const groups: SubjectTaskGroup[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const subject = match[1].replace(/\s+/g, "");
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const content = normalized.slice(start, end).trim();
    const tasks = splitTasks(content, subject);

    if (tasks.length > 0) {
      groups.push({ subject, tasks });
    }
  }

  return groups;
}

export function flattenHomeworkGroups(groups: SubjectTaskGroup[]): TaskDraft[] {
  return groups.flatMap((group) =>
    group.tasks
      .map((task) => ({
        subject: group.subject,
        title: cleanLine(task.title),
        details: task.details,
      }))
      .filter((task) => task.title && !PURE_SUBJECT_PATTERN.test(task.title)),
  );
}

export function parseHomeworkText(rawText: string): TaskDraft[] {
  return flattenHomeworkGroups(parseHomeworkGroups(rawText));
}
