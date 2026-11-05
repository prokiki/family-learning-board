import { secureRoute } from "@/lib/api-security";
import { getAISettings } from "@/lib/ai-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";


const BASE_SYSTEM_PROMPT = `你是一个中国小学作业解析助手。用户粘贴老师布置的作业文字，你要按学科分组解析。

规则：
1. “XX作业”是学科标题，不是任务。“语文作业”→ subject:"语文"
2. 标题行下方的内容是该学科的任务
3. 用逗号、顿号或换行分隔的多个任务要拆开
4. 去掉序号前缀，保留页码等关键信息
5. 只输出 JSON，不要任何其他文字

输出格式严格遵守：
[{"subject":"学科","tasks":[{"title":"任务","details":""}]}]`;

const FEW_SHOT_USER = `语文作业
预习书本P88
英语作业
听写单词，背课文`;

const FEW_SHOT_ASSISTANT = `[{"subject":"语文","tasks":[{"title":"预习书本P88","details":""}]},{"subject":"英语","tasks":[{"title":"听写单词","details":""},{"title":"背课文","details":""}]}]`;


async function handlePost(request: Request) {
  let body: { text?: string; board?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "作业文字不能为空" }, { status: 400 });
  }

  /* 从数据库读取 AI 配置 */
  const { apiKey, model, baseURL, soulDesc } = getAISettings();

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 AI 服务，请在设置中填写 API Key" },
      { status: 500 },
    );
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: soulDesc ? `${BASE_SYSTEM_PROMPT}\n\n你的人设：${soulDesc}` : BASE_SYSTEM_PROMPT },
        { role: "user", content: FEW_SHOT_USER },
        { role: "assistant", content: FEW_SHOT_ASSISTANT },
        { role: "user", content: text },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

    /* 去掉可能的 markdown 代码块包装 */
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

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
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          groups = value;
          break;
        }
      }
    }

    return NextResponse.json({ groups });
  } catch {
    const message = "AI 服务暂不可用";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = secureRoute(handlePost, true, true, 65536);
