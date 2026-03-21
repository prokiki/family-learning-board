import { NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `你是一个中国小学作业解析助手。用户会粘贴老师在钉钉群里布置的作业文字（可能格式不规范、有标点混用、口语化表达）。

你的任务：
1. 识别每个学科
2. 把每个学科下的作业拆分成孩子可以逐条执行的子任务
3. 每条子任务应该是一个具体可执行的动作

输出格式为 JSON 数组，严格按以下结构：
[
  {
    "subject": "学科名称",
    "tasks": [
      { "title": "子任务标题", "details": "补充说明（可选，没有则为空字符串）" }
    ]
  }
]

注意：
- 学科名称用简短的中文（语文、数学、英语、科学等）
- 如果无法识别学科，归到"其他"
- 子任务标题简洁明了，去掉序号前缀
- details 用于补充页码、截止时间等信息，没有就留空字符串
- 只输出 JSON，不要其他文字`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 OPENAI_API_KEY 环境变量" },
      { status: 500 },
    );
  }

  let body: { text?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "作业文字不能为空" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    /* 尝试解析——模型可能返回 { "groups": [...] } 或直接 [...] */
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI 返回格式异常，请重试" }, { status: 502 });
    }

    let groups: unknown[] = [];

    if (Array.isArray(parsed)) {
      groups = parsed;
    } else if (parsed && typeof parsed === "object") {
      /* 模型可能用任意 key 包装数组，取第一个值为数组的字段 */
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          groups = value;
          break;
        }
      }
    }

    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
