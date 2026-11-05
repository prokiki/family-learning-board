import { NextResponse } from "next/server";
import { secureRoute } from "@/lib/api-security";
import { getAISettings } from "@/lib/ai-server";
export const GET = secureRoute(async () => {
  const { apiKey, model } = getAISettings();
  return NextResponse.json({ configured: Boolean(apiKey), model });
}, true, false);
export const POST = secureRoute(async () => NextResponse.json({ error: "请在部署后台配置 AI 服务" }, { status: 405 }), true, false);
