import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS2 Stratbook｜临场战术推荐器",
  description:
    "为 CS2 路人局提供地图、阵营、经济状态和目标驱动的战术推荐、雷达路线与执行清单。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
