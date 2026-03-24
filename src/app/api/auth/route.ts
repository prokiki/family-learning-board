import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/** GET — 检查登录状态 */
export async function GET() {
  const cookieStore = await cookies();
  const board = cookieStore.get("board_auth")?.value;
  if (board) {
    return NextResponse.json({ authenticated: true, board });
  }
  return NextResponse.json({ authenticated: false });
}

/** POST — 验证密码，成功后设置 cookie */
export async function POST(request: Request) {
  const password = process.env.BOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "未设置访问密码" }, { status: 500 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (body.password !== password) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const boardId = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";
  const res = NextResponse.json({ success: true, board: boardId });
  res.cookies.set("board_auth", boardId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 天
    path: "/",
  });
  return res;
}
