"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export function PrivateImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [signed, setSigned] = useState({ path: "", url: "" });
  const url = signed.path === path ? signed.url : "";
  useEffect(() => {
    let live = true;
    async function refresh() {
      const db = getSupabaseBrowserClient();
      const result = await db?.storage.from("teacher-attachments").createSignedUrl(path, 300);
      if (live) setSigned({ path, url: result?.data?.signedUrl || "" });
    }
    void refresh(); const timer = setInterval(()=>void refresh(),240000);
    return () => { live = false; clearInterval(timer); };
  }, [path]);
  if (!url) return <span>图片加载中或无访问权限</span>;
  // Signed URLs expire and must never be written back to the attachment record.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={`h-full w-full ${className || ""}`} referrerPolicy="no-referrer" />;
}
