import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const QUESTION_PROMPTS: Record<string, string> = {
  explain: `用三年级小学生能懂的话，解释这个任务是什么意思。
要求：
- 用简单的词语，像跟孩子聊天一样
- 如果有页码、课文名等信息，告诉孩子具体指什么
- 不超过 50 个字
- 不要用"首先""其次"等结构化词语`,

  how_to_start: `告诉一个三年级小学生，这个任务应该怎么开始做，第一步做什么。
要求：
- 给出具体的第一步动作（比如"先翻开书本第X页"）
- 如果有多个小步骤，最多列 3 步，用 1. 2. 3. 标注
- 每步不超过 15 个字
- 语气像朋友提醒，不要像老师命令`,

  how_to_check: `告诉一个三年级小学生，做完这个任务后怎么自己检查。
要求：
- 给 2-3 个简单的检查点，用 ✓ 开头
- 每条不超过 15 个字
- 适合孩子自己对照检查
- 语气轻松鼓励`,
};

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
    question_type?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { subject, title, details, question_type } = body;
  const boardId = resolveBoardId(body.board);
  if (!title || !question_type) {
    return NextResponse.json({ error: "缺少任务信息" }, { status: 400 });
  }

  const questionPrompt = QUESTION_PROMPTS[question_type];
  if (!questionPrompt) {
    return NextResponse.json({ error: "未知问题类型" }, { status: 400 });
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

  /* 构建任务描述 */
  const taskDesc = [
    subject ? `学科：${subject}` : "",
    `任务：${title}`,
    details ? `补充说明：${details}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = soulDesc
    ? `${questionPrompt}\n\n你的人设：${soulDesc}`
    : questionPrompt;

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.6,
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskDesc },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
