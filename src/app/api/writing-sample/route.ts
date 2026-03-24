import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const SYSTEM_PROMPT = `你是一个三年级作文赏析老师。根据作文题目，写 2 个精彩片段让孩子学习，每个片段 3-4 句话。

规则：
1. 片段必须围绕给出的作文题目
2. 每个片段要展示不同的写法亮点：
   - 片段一侧重"场景描写"（用五感、比喻、拟人让画面活起来）
   - 片段二侧重"情感表达"（用心理描写、对话让感情真实）
3. 每个片段后附一句简短点评，告诉孩子"这段好在哪里"
4. 水平要匹配三年级：用词不要太难，句子不要太长，但要比孩子平时写的好一个层次
5. 不要写完整作文，只写精彩片段
6. 片段要有画面感，让孩子觉得"哇，这个写得真好，我也想试试"

严格输出 JSON：
{
  "samples": [
    {
      "label": "片段亮点标签（如：场景写得活）",
      "text": "3-4句话的精彩片段",
      "comment": "一句话点评，告诉孩子好在哪里"
    }
  ]
}`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: { board?: string; title?: string; details?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { title, details } = body;
  const boardId = resolveBoardId(body.board);
  if (!title) {
    return NextResponse.json({ error: "缺少作文题目" }, { status: 400 });
  }

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
      if (provider?.baseURL) baseURL = provider.baseURL;
      if (data.soul) soulDesc = data.soul;
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 AI 服务" }, { status: 500 });
  }

  const taskDesc = details ? `作文题目：${title}\n补充说明：${details}` : `作文题目：${title}`;
  const systemPrompt = soulDesc ? `${SYSTEM_PROMPT}\n\n你的人设：${soulDesc}` : SYSTEM_PROMPT;

  try {
    const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.8,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskDesc },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    let result: { samples: { label: string; text: string; comment: string }[] };
    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "生成失败，请重试" }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
