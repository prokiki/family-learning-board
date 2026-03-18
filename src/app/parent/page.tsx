import Link from "next/link";
import { ParentDashboard } from "@/components/parent-dashboard";

export default function ParentPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <Link
          href="/"
          className="nav-button"
        >
          ← 返回首页
        </Link>
      </div>
      <ParentDashboard />
    </main>
  );
}
