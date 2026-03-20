import Link from "next/link";
import { ParentDashboard } from "@/components/parent-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ParentPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="nav-button"
          >
            ← 返回首页
          </Link>
          <Link
            href="/parent/report"
            className="nav-button"
          >
            📊 周报统计
          </Link>
        </div>
        <ThemeToggle />
      </div>
      <ParentDashboard />
    </main>
  );
}
