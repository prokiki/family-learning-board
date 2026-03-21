import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** GET — 读取当前 AI 配置（API Key 脱敏） */
export async function GET() {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("ai_config")
    .select("provider, api_key, model, is_active, soul")
    .eq("board_id", boardId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    /* 没有配置过，返回默认值 */
    return NextResponse.json({
      provider: "openai",
      api_key_masked: "",
      model: "gpt-4o-mini",
      is_active: false,
      has_key: false,
      soul: "",
    });
  }

  /* 脱敏显示 API Key：只显示前4位和后4位 */
  const key = data.api_key || "";
  const masked = key.length > 8
    ? `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`
    : key ? "****" : "";

  return NextResponse.json({
    provider: data.provider,
    api_key_masked: masked,
    model: data.model,
    is_active: data.is_active,
    has_key: Boolean(key),
    soul: data.soul || "",
  });
}

/** POST — 保存 AI 配置 */
export async function POST(request: Request) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
  }

  let body: { provider?: string; api_key?: string; model?: string; soul?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const provider = body.provider || "openai";
  const apiKey = body.api_key ?? "";
  const model = body.model || "gpt-4o-mini";
  const soul = body.soul ?? "";

  const { error } = await supabase
    .from("ai_config")
    .upsert(
      {
        board_id: boardId,
        provider,
        api_key: apiKey,
        model,
        soul,
        is_active: Boolean(apiKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
