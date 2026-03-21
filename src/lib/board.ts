/** board_id 工具函数 */

/** 默认的私有 board_id（从环境变量读取） */
export const DEFAULT_BOARD_ID = process.env.NEXT_PUBLIC_DEFAULT_BOARD_ID ?? "family-demo";

/** 公开 demo 用的 board_id */
export const DEMO_BOARD_ID = "demo";

/** 从 URL search params 中读取 board，如果没有则返回默认值 */
export function getBoardFromParams(searchParams: URLSearchParams): string {
  return searchParams.get("board") || DEFAULT_BOARD_ID;
}
