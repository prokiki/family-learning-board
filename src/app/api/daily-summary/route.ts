import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const SYSTEM_PROMPT = `你是一个温暖的学习伙伴，孩子今天的作业全部完成了，你要给一句个性化的鼓励总结。

规则：
1. 夸具体的事，不要泛泛说"真棒"
   ✅ "今天数学那 5 道竖式全做对了，计算越来越稳了"
   ✅ "你今天主动给自己加了练字任务，这种自律很酷"
   ❌ "你真棒！继续加油！"
2. 如果有课外练习（孩子自己加的），特别表扬自主性
3. 根据作业数量调整语气（少了轻松，多了更感叹）
4. 适当加 1 个表情符号
5. 不超过 40 个字
6. 只输出这句话`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: {
    board?: string;
    tasks?: { subject: string; title: string; category: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const boardId = resolveBoardId(body.board);
  const tasks = body.tasks;
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ error: "没有作业" }, { status: 400 });
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

  const schoolTasks = tasks.filter((t) => t.category !== "extra");
  const extraTasks = tasks.filter((t) => t.category === "extra");

  const lines: string[] = [`今天一共完成了 ${tasks.length} 项：`];
  if (schoolTasks.length > 0) {
    lines.push(`学校作业（${schoolTasks.length}项）：${schoolTasks.map((t) => `${t.subject ? `【${t.subject}】` : ""}${t.title}`).join("、")}`);
  }
  if (extraTasks.length > 0) {
    lines.push(`课外练习（${extraTasks.length}项，孩子自己安排的）：${extraTasks.map((t) => t.title).join("、")}`);
  }

  const systemPrompt = soulDesc ? `${SYSTEM_PROMPT}\n\n你的人设：${soulDesc}` : SYSTEM_PROMPT;

  try {
    const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.8,
      max_tokens: 100,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: lines.join("\n") },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
