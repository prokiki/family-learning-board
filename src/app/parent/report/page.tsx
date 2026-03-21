"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { WeeklyReport } from "@/components/weekly-report";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_BOARD_ID } from "@/lib/board";

function ReportContent() {
  const searchParams = useSearchParams();
  const board = searchParams.get("board") || DEFAULT_BOARD_ID;

  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <Link href={`/parent?board=${board}`} className="nav-button">
          ← 返回家长端
        </Link>
        <ThemeToggle />
      </div>
      <WeeklyReport boardId={board} />
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportContent />
    </Suspense>
  );
}
