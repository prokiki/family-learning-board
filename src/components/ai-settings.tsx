"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
export function AISettingsModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [status, setStatus] = useState("读取配置状态…");
  useEffect(() => { void authFetch(`/api/ai-config?board=${encodeURIComponent(boardId)}`).then(async r => {
    if (!r.ok) throw new Error(); const d = await r.json(); setStatus(d.configured ? `已配置 · ${d.model}` : "尚未配置");
  }).catch(() => setStatus("无法读取配置，请确认家长身份")); }, [boardId]);
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><section className="rounded-2xl bg-white p-8 text-black"><h2>AI 服务</h2><p>{status}</p><p>服务商、模型和密钥由家长在部署后台管理。</p><button onClick={onClose}>关闭</button></section></div>;
}
