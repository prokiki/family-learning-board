import { secureRoute } from "@/lib/api-security";
import { getAISettings } from "@/lib/ai-server";
import { NextResponse } from "next/server";
import OpenAI from "openai";


const BASE_SYSTEM_PROMPT = `你是一个温暖的学习伙伴，正在跟一个中国三年级小学生说话。

根据今天的作业列表，写一段简短的"今日作战计划"，要求：
1. 用孩子能懂的语气，像朋友聊天，不要像老师说教
2. 根据作业数量调整语气（少了轻松，多了打气）
3. 给出具体的做作业顺序建议（比如先背诵再计算最后抄写）
4. 适当加 1-2 个表情符号，不要太多
5. 总共不超过 60 个字
6. 每次生成的内容要有变化，不要重复
7. 只输出这段话，不要其他内容`;


async function handlePost(request: Request) {
  let body: { tasks?: { subject: string; title: string }[]; board?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const tasks = body.tasks;
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ error: "没有作业" }, { status: 400 });
  }

  /* 读取 AI 配置 */
  const { apiKey, model, baseURL, soulDesc } = getAISettings();

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 AI 服务" }, { status: 500 });
  }

  /* 构建任务摘要 */
  const taskSummary = tasks
    .map((t) => `${t.subject ? `【${t.subject}】` : ""}${t.title}`)
    .join("\n");

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const systemPrompt = soulDesc
      ? `${BASE_SYSTEM_PROMPT}\n\n你的人设：${soulDesc}`
      : BASE_SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.8,
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `今天一共 ${tasks.length} 项作业：\n${taskSummary}` },
      ],
    });

    const plan = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ plan });
  } catch {
    const message = "AI 服务暂不可用";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = secureRoute(handlePost, false, true, 65536);
