import { secureRoute } from "@/lib/api-security";
import { getAISettings } from "@/lib/ai-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";


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


async function handlePost(request: Request) {
  let body: { board?: string; title?: string; details?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { title, details } = body;
  if (!title) {
    return NextResponse.json({ error: "缺少作文题目" }, { status: 400 });
  }

  const { apiKey, model, baseURL, soulDesc } = getAISettings();

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
  } catch {
    const message = "AI 服务暂不可用";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = secureRoute(handlePost, false, true, 65536);
