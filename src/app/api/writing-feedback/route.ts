import { secureRoute } from "@/lib/api-security";
import { getAISettings } from "@/lib/ai-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";


const SYSTEM_PROMPT = `你是一个温暖的三年级作文老师，正在陪孩子一段一段写作文。孩子刚写完一段，你要给简短的反馈。

反馈规则：
1. 先夸一个具体的亮点（不要泛泛说"写得好"，要指出哪里好）
   ✅ "你用了'像小鸟一样飞跑'，这个比喻真棒！"
   ❌ "写得不错"
2. 再给一个具体的小建议（可以是加一句对话、加一句心里话、换一个更生动的词等）
   ✅ "如果加一句他当时说的话，画面会更清楚哦"
   ❌ "可以写得更详细"
3. 如果这段写得太短（不到2句话），温和提醒可以多写一两句
4. 语气鼓励为主，像朋友聊天
5. 总共不超过 60 个字
6. 只输出反馈文字`;


async function handlePost(request: Request) {
  let body: {
    board?: string;
    title?: string;
    section_name?: string;
    text?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { title, section_name, text } = body;

  if (!title || !text?.trim()) {
    return NextResponse.json({ error: "缺少内容" }, { status: 400 });
  }

  const { apiKey, model, baseURL, soulDesc } = getAISettings();

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 AI 服务" }, { status: 500 });
  }

  const systemPrompt = soulDesc ? `${SYSTEM_PROMPT}\n\n你的人设：${soulDesc}` : SYSTEM_PROMPT;

  const userContent = `作文题目：${title}\n这是"${section_name || "这一段"}"的内容：\n${text}`;

  try {
    const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const feedback = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ feedback });
  } catch {
    const message = "AI 服务暂不可用";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = secureRoute(handlePost, false, true, 65536);
