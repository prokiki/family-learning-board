import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const SYSTEM_PROMPT = `你是一个有趣的三年级作文小老师。根据作文题目，生成一棵详细的思维导图，帮孩子把作文拆解成具体可写的内容，并给每个要点附上示范写法。

思维导图结构：
- 第一层：作文题目（根节点）
- 第二层：作文的 3-4 个段落，每段用一个有趣的名字（不要叫"开头""中间""结尾"，而是叫"认识他""那件小事""我想说"这样生动的名字）
- 第三层：每段 2-3 个要点，每个要点包含：
  - tip：具体要写什么（引导提示）
  - example：示范写法（一两句话，展示这个要点可以怎么写）

规则：
1. tip 必须具体，孩子看了就知道写什么
   ✅ "写他递给你橡皮时的动作和表情"
   ❌ "写你的感受"（太抽象）
2. example 是重点！每个要点都必须有一个具体的示范句子，让孩子看到"原来可以这样写"
   - 示范要用修辞手法（比喻、拟人、排比、夸张、五感描写等）
   - 示范要生动有画面感，不是干巴巴的叙述
   - 示范是一两句话（不是完整段落），三年级能懂能仿
   例如 tip:"写他跑得快的样子" → example:"他像一支箭一样冲了出去，脚下像装了风火轮。"
   例如 tip:"写你紧张的心情" → example:"我的心怦怦直跳，像揣了一只小兔子在里面蹦来蹦去。"
   例如 tip:"写教室里很安静" → example:"教室里安静极了，连一根针掉在地上都听得见。"
3. 中间段拆得最细，要点最多，示范最精彩
4. 语气活泼有趣，像和孩子聊天
5. tip 不超过 20 字，example 不超过 35 字
6. 内容贴近三年级孩子日常生活

严格输出 JSON：
{
  "title": "作文题目",
  "sections": [
    {
      "name": "段落的有趣名字",
      "color": "rose/amber/sky/emerald 四选一",
      "points": [
        { "tip": "具体要写什么", "example": "示范写法，一两句话" }
      ]
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
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taskDesc },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "{}";

    /* 去掉可能的 markdown 包装 */
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    let mindmap: {
      title: string;
      sections: {
        name: string;
        color: string;
        points: { tip: string; example: string }[] | string[];
      }[];
    };
    try {
      mindmap = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "思维导图生成失败，请重试" }, { status: 502 });
    }

    if (!mindmap.sections || mindmap.sections.length < 3) {
      return NextResponse.json({ error: "内容不完整，请重试" }, { status: 502 });
    }

    /* 兼容旧格式：如果 points 是 string[]，转为 {tip, example}[] */
    for (const section of mindmap.sections) {
      section.points = section.points.map((p) =>
        typeof p === "string" ? { tip: p, example: "" } : p,
      );
    }

    return NextResponse.json({ mindmap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
