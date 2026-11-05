"use client";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export default function Home() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function login(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const db = getSupabaseBrowserClient(); if (!db) throw new Error("登录服务未配置");
      const { error } = await db.auth.signInWithPassword({ email, password });
      setPassword(""); if (error) throw new Error("登录失败，请检查账号密码或稍后重试");
      const { data, error: memberError } = await db.from("board_members").select("board_id, role");
      if (memberError || !data || data.length !== 1) { await db.auth.signOut(); throw new Error("请家长先配置账号所属看板"); }
      window.location.assign(`/${data[0].role === "parent" ? "parent" : "child"}?board=${encodeURIComponent(data[0].board_id)}`);
    } catch(e) { setMessage(e instanceof Error ? e.message : "登录失败"); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md p-8"><h1 className="mb-6 text-3xl font-bold">家庭学习看板</h1><form onSubmit={login} className="flex flex-col gap-4"><label>账号邮箱<input className="w-full rounded border p-3" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>密码<input className="w-full rounded border p-3" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="rounded bg-blue-700 p-3 text-white" disabled={busy}>{busy ? "登录中…" : "登录"}</button><p role="status">{message}</p></form></main>;
}
