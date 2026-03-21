"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ParentDashboard } from "@/components/parent-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { AISettingsButton } from "@/components/ai-settings-button";
import { DEFAULT_BOARD_ID } from "@/lib/board";

function ParentContent() {
  const searchParams = useSearchParams();
  const board = searchParams.get("board") || DEFAULT_BOARD_ID;
  const isDemo = board === "demo";

  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="nav-button">
            ← 返回首页
          </Link>
          <Link href={`/parent/report?board=${board}`} className="nav-button">
            📊 周报统计
          </Link>
          {!isDemo && <AISettingsButton />}
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="rounded-full bg-[var(--warning-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
              Demo
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
      <ParentDashboard boardId={board} />
    </main>
  );
}

export default function ParentPage() {
  return (
    <Suspense>
      <ParentContent />
    </Suspense>
  );
}
