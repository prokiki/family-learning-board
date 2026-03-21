import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

const STEP_PROMPTS: Record<string, string> = {
  analyze: `你在帮一个三年级小学生理解作文题目。

根据给出的作文任务，用孩子能懂的话帮他搞清楚三件事：
1. 这篇作文要写什么（一句话说清楚）
2. 有没有特别要求（比如字数、必须写真实经历等）
3. 老师最想看到什么（比如真情实感、具体事例等）

要求：
- 每条不超过 20 个字
- 用 • 开头，共 3 条
- 语气像朋友提醒，不像老师布置任务`,

  brainstorm: `你在帮一个三年级小学生找作文素材。不要给他写任何文字内容，而是抛出问题帮他回忆自己的生活经历。

根据作文题目，提出 3-4 个引导性问题，帮孩子找到可以写的内容。

要求：
- 问题要具体，不要抽象（❌"你有什么感受" ✅"当时你心里是开心还是紧张"）
- 围绕孩子的日常经历（学校、家里、和朋友一起）
- 每个问题一行，用数字序号
- 每条不超过 20 个字
- 语气亲切，像在聊天`,

  structure: `你在帮一个三年级小学生搭作文的段落框架。不写任何具体内容，只给结构指引。

根据作文题目，给出一个简单的三段式结构（开头-中间-结尾），每段只用一句话说明这段写什么。

格式：
📝 开头：（这段写什么，不超过 15 个字）
📝 中间：（这段写什么，不超过 15 个字）
📝 结尾：（这段写什么，不超过 15 个字）

要求：
- 结构清晰简单，三年级能驾驭
- "中间"段是重点，提示要写具体的事或场景
- 不要写任何示例句子或范文片段`,

  tips: `你在给一个三年级小学生 1-2 个写作小技巧，帮他把作文写得更好。

根据作文题目，给出最实用的写法建议。

要求：
- 只给 1-2 条建议，用 💡 开头
- 每条不超过 25 个字
- 建议要具体可操作（❌"多用好词好句" ✅"试试写一句你当时心里想的话"）
- 适合三年级水平，不要要求用修辞手法等高级技巧
- 语气鼓励，让孩子觉得"我能做到"`,
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: {
    title?: string;
    details?: string;
    step?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { title, details, step } = body;
  if (!title || !step) {
    return NextResponse.json({ error: "缺少任务信息" }, { status: 400 });
  }

  const stepPrompt = STEP_PROMPTS[step];
  if (!stepPrompt) {
    return NextResponse.json({ error: "未知步骤" }, { status: 400 });
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
    ? `${stepPrompt}\n\n你的人设：${soulDesc}`
    : stepPrompt;

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 300,
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
