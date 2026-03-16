import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家庭学习看板",
  description: "帮助家长整理作业、让孩子放学后清晰完成任务的家庭学习看板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
