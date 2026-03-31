import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a8a7d" },
    { media: "(prefers-color-scheme: dark)", color: "#171816" },
  ],
};

export const metadata: Metadata = {
  title: "家庭学习看板",
  description: "帮助家长整理作业、让孩子放学后清晰完成任务的家庭学习看板。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "学习看板",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Script
          id="adsense-auto-ads"
          async
          strategy="beforeInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1428600598243465"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
