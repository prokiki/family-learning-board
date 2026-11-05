"use client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export async function authFetch(input: string, init?: RequestInit) {
  if (!input.startsWith("/api/")) throw new Error("仅允许同站 API");
  const client = getSupabaseBrowserClient();
  const session = client ? await client.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("请先登录");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
