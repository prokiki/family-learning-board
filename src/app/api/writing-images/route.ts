import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getProvider } from "@/lib/ai-providers";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

const SCENE_PROMPT = `你是一个三年级作文教学助手。根据作文题目，构思一个适合三年级孩子写的故事，拆成 4 个连续画面（起因→发展→高潮→结尾）。

核心规则（非常重要）：
1. 先定义一个固定主角外貌，4 张图必须是同一个角色。例如："a 8-year-old Chinese girl with short black hair wearing a yellow T-shirt and blue jeans"
2. 场景要有连贯性——同一天发生的事，地点变化要合理（不要从教室突然跳到海边）
3. 故事要贴近三年级孩子的日常生活（学校、家里、小区、公园）
4. 第三张图是最关键的瞬间（高潮），要有情感变化
5. 内容必须健康阳光，不能有危险、恐怖、暴力、奇幻魔法等内容

严格按 JSON 格式输出，不要其他文字：
{
  "character": "用英文描述主角固定外貌特征，30词以内，包含年龄、性别、发型、服装颜色",
  "scenes": [
    {"scene": "用英文描述画面，必须包含主角描述，50词以内", "hint": "中文写作引导，15字以内"},
    {"scene": "...", "hint": "..."},
    {"scene": "...", "hint": "..."},
    {"scene": "...", "hint": "..."}
  ]
}

scene 描述规则：
- 必须用英文
- 每个 scene 开头必须包含 character 字段的完整描述，确保主角一致
- 场景要具体，有人物动作和表情
- 不要出现任何文字、字母、数字在画面中`;

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

  const taskDesc = details ? `作文题目：${title}\n补充说明：${details}` : `作文题目：${title}`;

  try {
    /* 第一步：构思 4 个场景 */
    const openai = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    const chatModel = model.includes("gpt-4o") ? model : "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.8,
      max_tokens: 800,
      messages: [
        { role: "system", content: SCENE_PROMPT },
        { role: "user", content: taskDesc },
      ],
    });

    let raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

    /* 去掉可能的 markdown 包装 */
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();

    let character = "";
    let scenes: { scene: string; hint: string }[];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.scenes)) {
        character = parsed.character || "";
        scenes = parsed.scenes;
      } else if (Array.isArray(parsed)) {
        scenes = parsed;
      } else {
        scenes = [];
      }
    } catch {
      return NextResponse.json({ error: "AI 场景构思失败，请重试" }, { status: 502 });
    }

    if (scenes.length < 4) {
      return NextResponse.json({ error: "场景数量不足，请重试" }, { status: 502 });
    }

    /* 第二步：并行生成 4 张图片（使用 DALL-E，不传 baseURL） */
    const dalleClient = new OpenAI({ apiKey }); // DALL-E 只走 OpenAI 官方

    const styleTag = "warm children's book illustration, soft watercolor style, consistent character design, no text or words or letters or numbers in image";

    const imagePromises = scenes.slice(0, 4).map((s) => {
      /* 确保每张图都包含主角描述 */
      const prompt = character
        ? `${character}. ${s.scene}. Style: ${styleTag}.`
        : `${s.scene}. Style: ${styleTag}.`;

      return dalleClient.images
        .generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        })
        .then((res) => res.data?.[0]?.url ?? null)
        .catch(() => null);
    });

    const imageUrls = await Promise.all(imagePromises);

    const result = scenes.slice(0, 4).map((s, i) => ({
      image_url: imageUrls[i],
      hint: s.hint,
    }));

    return NextResponse.json({ images: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务异常";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
