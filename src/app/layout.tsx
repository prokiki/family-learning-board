import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "家庭学习看板",
  description: "帮助家长整理作业、让孩子放学后清晰完成任务的家庭学习看板。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (function () {
      try {
        var storageKey = "family-learning-board-theme";
        var saved = localStorage.getItem(storageKey);
        var preference = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
        var resolved = preference === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : preference;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.dataset.themePreference = preference;
      } catch (error) {
        document.documentElement.dataset.theme = "light";
        document.documentElement.dataset.themePreference = "system";
      }
    })();
  `;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div className="fixed right-3 top-3 z-30 sm:right-4 sm:top-4 md:right-6 md:top-6">
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
