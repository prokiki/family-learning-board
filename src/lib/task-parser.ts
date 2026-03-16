import type { TaskDraft } from "@/types/task";

const LEADING_MARKERS =
  /^(\d+[\.\)、]|[一二三四五六七八九十]+[、.]|[-•●▪︎◦]|[（(]?\d+[）)])\s*/;

function cleanLine(line: string) {
  return line
    .replace(/\r/g, "")
    .replace(LEADING_MARKERS, "")
    .replace(/[；;。]+$/g, "")
    .trim();
}

export function parseHomeworkText(rawText: string): TaskDraft[] {
  const normalized = rawText
    .replace(/\t/g, "\n")
    .replace(/；/g, ";\n")
    .replace(/。(?=\S)/g, "。\n")
    .replace(/(?<=\d)[、.](?=\S)/g, "$& ");

  const lines = normalized
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);

  const merged: string[] = [];

  for (const line of lines) {
    const previous = merged.at(-1);

    if (
      previous &&
      line.length < 10 &&
      !/[作业练习朗读背诵订正复习预习听写打卡]/.test(line)
    ) {
      merged[merged.length - 1] = `${previous} ${line}`.trim();
      continue;
    }

    merged.push(line);
  }

  return merged.map((title) => ({ title }));
}
