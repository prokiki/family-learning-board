import Link from "next/link";
import { ParentDashboard } from "@/components/parent-dashboard";

export default function ParentPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 pt-4 md:px-6">
        <Link
          href="/"
          className="inline-flex rounded-[12px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] shadow-sm"
        >
          返回首页
        </Link>
      </div>
      <ParentDashboard />
    </main>
  );
}
