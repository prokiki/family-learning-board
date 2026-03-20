import Link from "next/link";
import { WeeklyReport } from "@/components/weekly-report";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ReportPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <Link href="/parent" className="nav-button">
          ← 返回家长端
        </Link>
        <ThemeToggle />
      </div>
      <WeeklyReport />
    </main>
  );
}
