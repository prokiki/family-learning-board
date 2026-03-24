import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";
import { resolveBoardId } from "@/lib/board";

const SYSTEM_PROMPT = `你是一个小学生家长的学习顾问，正在帮家长分析孩子这一周的学习情况。

根据提供的周报数据，写一段简短的点评，要求：
1. 先用一句话总结整体表现（好/一般/需要关注）
2. 指出最突出的优点（比如某天全部完成、某学科很稳定）
3. 如果有需要关注的地方（完成率低、某学科求助多），温和地提醒
4. 给 1 条具体可操作的建议
5. 语气温和务实，像朋友聊天，不要说教
6. 总共不超过 150 个字
7. 只输出点评文字，不要标题或格式标记`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: {
    board?: string;
    week_label?: string;
    total?: number;
    completed?: number;
    completion_rate?: number;
    prev_rate?: number;
    streak?: number;
    day_stats?: { date: string; weekday: string; total: number; completed: number; helpCount: number }[];
    subject_stats?: { subject: string; total: number; completed: number; helpCount: number }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const {
    board,
    week_label,
    total = 0,
    completed = 0,
    completion_rate = 0,
    prev_rate,
    streak = 0,
    day_stats = [],
    subject_stats = [],
  } = body;
  const boardId = resolveBoardId(board);

  if (total === 0) {
    return NextResponse.json({ error: "本周没有作业数据" }, { status: 400 });
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

  /* 构建数据摘要 */
  const lines: string[] = [
    `周期：${week_label}`,
    `总共 ${total} 项，完成 ${completed} 个，完成率 ${completion_rate}%`,
  ];

  if (prev_rate !== undefined && prev_rate !== null) {
    const diff = completion_rate - prev_rate;
    lines.push(`上周完成率 ${prev_rate}%，${diff > 0 ? `本周提升了 ${diff}%` : diff < 0 ? `本周下降了 ${Math.abs(diff)}%` : "与上周持平"}`);
  }

  if (streak > 0) {
    lines.push(`连续全部完成天数：${streak} 天`);
  }

  if (day_stats.length > 0) {
    const dayLines = day_stats
      .filter((d) => d.total > 0)
      .map((d) => `${d.weekday}：${d.total}项，完成${d.completed}项${d.helpCount > 0 ? `，求助${d.helpCount}次` : ""}`);
    if (dayLines.length > 0) {
      lines.push(`每日详情：\n${dayLines.join("\n")}`);
    }
  }

  if (subject_stats.length > 0) {
    const subjectLines = subject_stats.map(
      (s) => `${s.subject}：${s.total}项，完成${s.completed}项${s.helpCount > 0 ? `，求助${s.helpCount}次` : ""}`,
    );
    lines.push(`学科分布：\n${subjectLines.join("\n")}`);
  }

  const userContent = lines.join("\n\n");

  const systemPrompt = soulDesc
    ? `${SYSTEM_PROMPT}\n\n你的人设：${soulDesc}`
    : SYSTEM_PROMPT;

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const result = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const review = result.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
