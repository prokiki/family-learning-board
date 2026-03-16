import Link from "next/link";
import { ParentDashboard } from "@/components/parent-dashboard";

export default function ParentPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fef3c7_0%,#fffdf7_26%,#f8fafc_100%)]">
      <div className="px-4 pt-4 md:px-6">
        <Link
          href="/"
          className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          返回首页
        </Link>
      </div>
      <ParentDashboard />
    </main>
  );
}
