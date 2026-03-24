"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback } from "react";
import { ChildDashboard } from "@/components/child-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { DEFAULT_BOARD_ID } from "@/lib/board";

function ChildContent() {
  const searchParams = useSearchParams();
  const board = searchParams.get("board") || DEFAULT_BOARD_ID;
  const isDemo = board === "demo";
  const fromParent = searchParams.get("from") === "parent";

  const handleRefresh = useCallback(async () => {
    window.location.reload();
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <main data-view="child" className="min-h-screen bg-background">
        <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
          <div className="flex items-center gap-2">
            {fromParent && (
              <Link href={`/parent?board=${board}`} className="nav-button">
                ← 返回家长端
              </Link>
            )}
            {isDemo && (
              <span className="rounded-full bg-[var(--warning-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
                Demo 模式
              </span>
            )}
          </div>
          <ThemeToggle />
        </div>
        <ChildDashboard boardId={board} />
      </main>
    </PullToRefresh>
  );
}

export default function ChildPage() {
  return (
    <Suspense>
      <ChildContent />
    </Suspense>
  );
}
