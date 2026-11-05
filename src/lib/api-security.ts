import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Handler = (request: Request) => Promise<Response>;
function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function readBoundedJson(request: Request, max: number): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("format");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("format");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("format");
  return body;
}
export function secureRoute(handler: Handler, parentOnly = false, ai = true, maxBytes = 65536): Handler {
  return async (request) => {
    try {
      const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!token) return fail(401, "请先登录");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return fail(503, "身份服务未配置");
      const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: { user }, error } = await db.auth.getUser(token);
      if (error || !user || user.is_anonymous) return fail(401, "请重新登录");
      let body: Record<string, unknown> = {};
      if (request.method === "POST") {
        try { body = await readBoundedJson(request, maxBytes); }
        catch (e) { return fail(e instanceof Error && e.message === "size" ? 413 : 400, "请求格式或大小不符合要求"); }
      }
      const requestedBoard = body.board ?? new URL(request.url).searchParams.get("board");
      if (requestedBoard != null && (typeof requestedBoard !== "string" || !requestedBoard.trim() || requestedBoard.length > 200)) return fail(400, "看板参数无效");
      let query = db.from("board_members").select("board_id, role").eq("user_id", user.id);
      if (requestedBoard) query = query.eq("board_id", requestedBoard);
      const { data: memberships, error: memberError } = await query;
      if (memberError) return fail(503, "权限服务暂不可用");
      if (!memberships || memberships.length !== 1 || (requestedBoard && memberships[0].board_id !== requestedBoard) || (parentOnly && memberships[0].role !== "parent")) return fail(403, "无权执行此操作");
      if (ai) {
        const { data: allowed, error: limitError } = await db.rpc("consume_ai_quota");
        if (limitError) return fail(503, "调用限额服务暂不可用");
        if (!allowed) return fail(429, "调用过于频繁或今日额度已用完");
      }
      const nextUrl = new URL(request.url); nextUrl.searchParams.set("board", memberships[0].board_id);
      const next = new Request(nextUrl, { method: request.method, headers: request.headers,
        ...(request.method === "POST" ? { body: JSON.stringify({ ...body, board: memberships[0].board_id }) } : {}) });
      const response = await handler(next);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch { return fail(500, "服务暂不可用，请稍后重试"); }
  };
}
