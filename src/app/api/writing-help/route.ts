import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const STEP_PROMPTS: Record<string, string> = {
  analyze: `你在帮一个三年级小学生搞懂作文题目。

用孩子能懂的大白话，帮他搞清楚老师到底想让他写什么：
1. 这篇作文要写什么（一句话说清楚）
2. 有没有隐藏要求（比如要写真实经历、要有具体事例等）
3. 写好这篇作文的关键是什么（一句话提示）

要求：
- 每条不超过 20 个字
- 用 • 开头，共 3 条
- 语气像朋友提醒，不像老师布置任务`,

  recall: `你在帮一个三年级小学生回忆可以写进作文的画面。不要给他写任何文字内容，而是用“五感”引导法帮他重新“看到”那个场景。

根据作文题目，用 4 个问题帮孩子回到那个场景里：
1. 你当时看到了什么？（视觉）
2. 听到了什么声音？（听觉）
3. 当时心里在想什么？（内心）
4. 还记得什么细节吗？（触感/味道/动作等）

要求：
- 每个问题要结合具体题目提问，不要笼统
  例如题目《我的好朋友》：“你们一起玩的时候，他脸上是什么表情？”
  例如题目《运动会》：“起跑的时候，你听到身边同学在喊什么？”
- 问题要具体到孩子能立刻回答，不要抽象
- 每条不超过 25 个字
- 语气像和孩子聊天，亲切自然`,

  structure: `你在帮一个三年级小学生搭作文的段落框架。不写任何具体内容，只给结构指引。

根据作文题目，给出一个简单的三段式结构（开头-中间-结尾）。

格式：
📝 开头：（这段写什么，不超过 15 个字）
📝 中间：（这段写什么，不超过 20 个字）
📝 结尾：（这段写什么，不超过 15 个字）

重要规则：
- 中间段是重点，要提示孩子写一个“小片段”——把某个瞬间放大写，而不是概括一件事
  例如：“写妈妈递给你伞的那一下”而不是“写妈妈经常关心你”
- 结构清晰简单，三年级能驾驭
- 不要写任何示例句子或范文片段`,

  opening: `你在帮一个三年级小学生解决“第一句话怎么写”的难题。

三年级孩子写作文最容易卡在开头，不知道第一句写什么。你要给他 3 种开头方式让他选，只给方法和简短示例，不要给完整句子。

格式：
1️⃣ 方法名：简短说明 + 示例开头几个字“……”
2️⃣ 方法名：简短说明 + 示例开头几个字“……”
3️⃣ 方法名：简短说明 + 示例开头几个字“……”

常用的开头方式：
- 声音开头：从一个声音开始（“叮铃铃……”“嚓……”）
- 提问开头：以一个问句开始（“你知道……吗？”）
- 直接开头：直接说时间地点（“上周六，……”）
- 对话开头：从一句对话开始

要求：
- 示例只给开头几个字+省略号，不要写完整句子
- 要结合具体题目，不要泛泛而谈
- 语气轻松，让孩子觉得“原来开头这么简单”`,

  tips: `你在给一个三年级小学生 2 个写作锦囊，帮他把作文写得更生动、字数更多。

重点教两个最实用的技巧：

💡 技巧一：加对话
写一句人物说的话，作文立刻生动。结合题目给一个具体的提示。

💡 技巧二：加心里话
写一句“我心里想”，字数和感情都有了。结合题目给一个具体的提示。

要求：
- 每个技巧用 💡 开头，先说方法，再给一个结合题目的具体提示
- 提示是“你可以写……”的形式，不要给完整句子
- 每个技巧不超过 30 个字
- 语气鼓励，让孩子觉得“我能做到”`,
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
  const boardId = resolveBoardId(body.board);
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
