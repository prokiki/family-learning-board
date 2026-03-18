import Link from "next/link";
import { ChildDashboard } from "@/components/child-dashboard";

export default function ChildPage() {
  return (
    <main className="bg-background">
      <div className="fixed left-3 top-3 z-10 sm:left-4 sm:top-4 md:left-8 md:top-6">
        <Link
          href="/"
          className="nav-button"
        >
          ← 返回首页
        </Link>
      </div>
      <ChildDashboard />
    </main>
  );
}
