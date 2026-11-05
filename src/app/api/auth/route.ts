import { NextResponse } from "next/server";
function retired() {
  const res = NextResponse.json({ error: "旧登录方式已停用，请使用账号登录" }, { status: 410 });
  res.cookies.delete("board_auth");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const GET = retired;
export const POST = retired;
