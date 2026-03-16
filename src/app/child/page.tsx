import Link from "next/link";
import { ChildDashboard } from "@/components/child-dashboard";

export default function ChildPage() {
  return (
    <main>
      <div className="fixed left-4 top-4 z-10">
        <Link
          href="/"
          className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          返回
        </Link>
      </div>
      <ChildDashboard />
    </main>
  );
}
