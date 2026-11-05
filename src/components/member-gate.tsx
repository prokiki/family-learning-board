"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export function MemberGate({ children }: { children: ReactNode }) {
  const router = useRouter(); const path = usePathname(); const params = useSearchParams();
  const board = params.get("board"); const [approvedRoute, setApprovedRoute] = useState("");
  const routeKey = `${path}?board=${board}`;
  useEffect(() => {
    const db = getSupabaseBrowserClient(); let live = true;
    if (!db) { router.replace("/"); return; }
    async function check() {
      setApprovedRoute("");
      const { data: { user } } = await db!.auth.getUser();
      if (!live) return;
      if (!user || user.is_anonymous) { router.replace("/"); return; }
      const { data } = await db!.from("board_members").select("board_id, role").eq("user_id", user.id);
      if (!live) return;
      const member = data?.find(m => m.board_id === board);
      if (!board && data?.length === 1) { router.replace(`${path}?board=${encodeURIComponent(data[0].board_id)}`); return; }
      if (!member || (path.startsWith("/parent") && member.role !== "parent")) { router.replace("/"); return; }
      setApprovedRoute(`${path}?board=${board}`);
    }
    void check(); const { data: { subscription } } = db.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") { setApprovedRoute(""); router.replace("/"); } });
    return () => { live = false; subscription.unsubscribe(); };
  }, [board, path, router]);
  if (approvedRoute !== routeKey) return <p className="p-8">正在验证访问权限…</p>;
  return <><button className="m-2 rounded border px-3 py-1" onClick={async()=>{await getSupabaseBrowserClient()?.auth.signOut(); router.replace("/");}}>退出登录</button>{children}</>;
}
