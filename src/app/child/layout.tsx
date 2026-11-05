import { Suspense, type ReactNode } from "react";
import { MemberGate } from "@/components/member-gate";
export default function Layout({ children }: { children: ReactNode }) { return <Suspense fallback={<p>加载中…</p>}><MemberGate>{children}</MemberGate></Suspense>; }
