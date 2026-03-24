import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const SYSTEM_PROMPT = `你是一个三年级小学生的学习助手。根据给出的作业任务，生成一张"任务攻略卡"，帮孩子快速理解并开始做。

攻略卡包含三部分，严格输出 JSON：
{
  "explain": "用一句大白话解释这个任务是什么意思，不超过 25 字",
  "steps": ["第一步做什么", "第二步做什么", "第三步做什么"],
  "check": "一句话告诉孩子怎么确认自己做完了，不超过 20 字"
}

规则：
1. explain 要具体，不要说"完成作业"这种废话
   ✅ "翻开语文书第88页，把新课文先读一遍"
   ❌ "按老师要求完成任务"
2. steps 给 2-3 步，每步是一个具体动作，不超过 15 字
   ✅ "先读一遍课文，遇到生字画圈"
   ❌ "认真完成"
3. check 是孩子自己能判断的标准
   ✅ "能说出课文大意就算完成"
   ❌ "检查是否正确"
4. 语气像朋友聊天，亲切简短
5. 如果任务有页码、单元号等信息，steps 里要提到具体翻到哪一页`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: {
    board?: string;
    subject?: string;
    title?: string;
    details?: string;
    question_type?: string; // 保留兼容，但不再使用
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { subject, title, details } = body;
  const boardId = resolveBoardId(body.board);
  if (!title) {
    return NextResponse.json({ error: "缺少任务信息" }, { status: 400 });
  }

  /* 读取 AI 配置 */
  let apiKey = process.env.OPENAI_API_KEY || "";
  let model = "gpt-4o-mini";
  let baseURL: string | undefined;
  let soulDesc = "";

  const supabase = getAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("ai_config")
      .select("provider, api_key, model, is_active, soul")
      .eq("board_id", boardId)
      .single();

    if (data?.is_active && data.api_key) {
      apiKey = data.api_key;
      model = data.model || "gpt-4o-mini";
      const provider = getProvider(data.provider);
      if (provider?.baseURL) {
        baseURL = provider.baseURL;
      }
      if (data.soul) {
        soulDesc = data.soul;
      }
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 AI 服务" }, { status: 500 });
  }

  const taskDesc = [
    subject ? `学科：${subject}` : "",
    `任务：${title}`,
    details ? `补充说明：${details}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = soulDesc
    ? `${SYSTEM_PROMPT}\n\n你的人设：${soulDesc}`
    : SYSTEM_PROMPT;

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.6,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskDesc },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    /* 去掉可能的 markdown 包装 */
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    let card: { explain: string; steps: string[]; check: string };
    try {
      card = JSON.parse(raw);
    } catch {
      // 兜底：如果不是 JSON，当作纯文本返回
      return NextResponse.json({ card: { explain: raw, steps: [], check: "" } });
    }

    return NextResponse.json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
