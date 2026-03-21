import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

const BASE_SYSTEM_PROMPT = `你是一个中国小学作业解析助手。用户会粘贴老师在钉钉群里布置的作业文字（可能格式不规范、有标点混用、口语化表达）。

你的任务：
1. 识别每个学科
2. 把每个学科下的作业拆分成孩子可以逐条执行的子任务
3. 每条子任务应该是一个具体可执行的动作

学科识别规则（非常重要）：
- 如果文本中出现“语文作业”“数学作业”“英语作业”“科学作业”等标题行，它们是学科分组标记，下方的内容属于该学科
- “XX作业”“XX”本身不是任务，不要拆分为子任务，它们只是学科名称
- 学科名称只取简短名称：“语文作业”→ subject:"语文"，“英语作业”→ subject:"英语"
- 如果没有明确学科标题，根据内容推断学科（背课文、写字→语文，计算题→数学，听写单词→英语）
- 实在无法识别学科才归到"其他"

输出格式为 JSON 数组，严格按以下结构：
[
  {
    "subject": "学科名称",
    "tasks": [
      { "title": "子任务标题", "details": "补充说明（可选，没有则为空字符串）" }
    ]
  }
]

示例输入：
语文作业
预习书本P88
英语作业
听写单词，背课文

示例输出：
[{"subject":"语文","tasks":[{"title":"预习书本P88","details":""}]},{"subject":"英语","tasks":[{"title":"听写单词","details":""},{"title":"背课文","details":""}]}]

其他注意：
- 子任务标题去掉序号前缀（如1-、2-、①等），但必须保留页码、单元号、课本编号等关键信息
  例如："2-背诵U2 P.16-20,下周一检查" → title:"背诵U2 P.16-20" details:"下周一检查"
  例如："学习力p29.30.31.32" → title:"学习力p29.30.31.32" details:""
  例如："预习第5课" → title:"预习第5课" details:""
- details 用于补充截止时间、注意事项等额外信息，没有就留空字符串
- 只输出 JSON，不要其他文字`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: { text?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "作业文字不能为空" }, { status: 400 });
  }

  /* 从数据库读取 AI 配置 */
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
    return NextResponse.json(
      { error: "未配置 AI 服务，请在设置中填写 API Key" },
      { status: 500 },
    );
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: soulDesc ? `${BASE_SYSTEM_PROMPT}\n\n你的人设：${soulDesc}` : BASE_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI 返回格式异常，请重试" }, { status: 502 });
    }

    let groups: unknown[] = [];

    if (Array.isArray(parsed)) {
      groups = parsed;
    } else if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          groups = value;
          break;
        }
      }
    }

    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
