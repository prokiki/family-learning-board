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
3. 每个段落至少插入 1 个好词好句提示，用“试试用”“可以写”开头，要求包含修辞手法：
   比喻："写他跑得快，试试‘像一阵风一样冲过终点’"
   拟人："写小花，可以说‘小花笑着向我点头’"
   排比："写开心，试试‘开心得想唱歌，开心得想跳舞，开心得想飞起来’"
   夸张："写声音大，可以说‘欢呼声都快把屋顶掀翻了’"
   心理："写紧张，试试‘我的心像揣了只小兔子，砰砰直跳’"
   五感："写食物，可以写‘香味钻进鼻子，口水都要流下来了’"
   注意：推荐的句子要生动有画面感，三年级能理解但又不是平常轻易想到的，让孩子觉得“这个说法真有意思”
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
