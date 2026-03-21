import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

const SYSTEM_PROMPT = `你是一个 OCR 文字识别助手。用户会发送一张包含中国小学作业内容的照片（可能是老师手写的、打印的、或者钉钉/微信截图）。

你的任务：
1. 识别图片中所有的文字内容
2. 保持原文的换行和分段结构
3. 如果有学科标题（如"语文作业""数学作业"），保留它们作为独立行
4. 纠正明显的 OCR 误识别（如把"语文"识别成"话文"）
5. 只输出识别到的文字，不要加任何解释或标注
6. 如果图片模糊或无法识别，回复"图片不清晰，请重新拍照"`;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  let body: { image?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { image } = body;
  if (!image) {
    return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
  }

  /* 读取 AI 配置 */
  let apiKey = process.env.OPENAI_API_KEY || "";
  let model = "gpt-4o-mini";
  let baseURL: string | undefined;

  const supabase = getAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("ai_config")
      .select("provider, api_key, model, is_active")
      .eq("board_id", boardId)
      .single();

    if (data?.is_active && data.api_key) {
      apiKey = data.api_key;
      model = data.model || "gpt-4o-mini";
      const provider = getProvider(data.provider);
      if (provider?.baseURL) {
        baseURL = provider.baseURL;
      }
    }
  }

  if (!apiKey) {
    return NextResponse.json({ error: "未配置 AI 服务" }, { status: 500 });
  }

  /* 确保使用支持视觉的模型 */
  const visionModel = model.includes("gpt-4o") ? model : "gpt-4o-mini";

  try {
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const completion = await openai.chat.completions.create({
      model: visionModel,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "请识别这张图片中的作业内容：" },
            {
              type: "image_url",
              image_url: {
                url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
