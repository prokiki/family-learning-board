import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

const SYSTEM_PROMPT = `你是一个有趣的三年级作文小老师。根据作文题目，生成一棵思维导图，帮孩子把作文拆解成具体可写的内容。

思维导图结构（三层）：
- 第一层：作文题目（根节点）
- 第二层：作文的 3-4 个段落，每段用一个有趣的名字（不要叫“开头”“中间”“结尾”，而是叫““认识他”“那件小事”“我想说”这样生动的名字）
- 第三层：每段具体要写什么（2-3 个要点）

规则：
1. 第三层的每个节点必须是具体的、孩子能直接写的内容提示
   ✅ "写他递给你橡皮时说了什么"
   ✅ "写你心里当时在想什么"
   ❌ "写你的感受"（太抽象）
   ❌ "用优美的语言描述"（太笼统）
2. 中间段要拆得最细，引导孩子写一个具体的“小片段”
3. 适当在要点中插入好词好句的小提示，帮孩子积累表达，比如：
   - "写他的表情，试试用‘眉开眼笑’“兴高采烈’"
   - "写你的心情，可以说‘我的心像小鹿一样乱撞’"
   - "描写天气，试试‘阳光撒在身上，暖暖的’"
   注意：好词好句要符合三年级水平，不要太难
4. 语气要活泼有趣，像和孩子聊天，每个节点不超过 20 个字
5. 内容贴近三年级孩子日常生活

严格输出 JSON，不要其他文字：
{
  "title": "作文题目",
  "sections": [
    {
      "name": "段落的有趣名字",
      "color": "rose/amber/sky/emerald 四选一",
      "points": ["要点1", "要点2"]
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
  let body: { title?: string; details?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { title, details } = body;
  if (!title) {
    return NextResponse.json({ error: "缺少作文题目" }, { status: 400 });
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

  const taskDesc = details ? `作文题目：${title}\n补充说明：${details}` : `作文题目：${title}`;

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
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskDesc },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    /* 去掉可能的 markdown 包装 */
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    let mindmap: { title: string; sections: { name: string; color: string; points: string[] }[] };
    try {
      mindmap = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "思维导图生成失败，请重试" }, { status: 502 });
    }

    if (!mindmap.sections || mindmap.sections.length < 3) {
      return NextResponse.json({ error: "内容不完整，请重试" }, { status: 502 });
    }

    return NextResponse.json({ mindmap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
