import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "AI 剧本杀 · 为你一个人定制",
  description: "AI 多角色协作的单人剧本杀体验",
  // 关闭浏览器/翻译插件的自动翻译：本应用是中文动态内容，翻译插件改写 DOM 会与 React
  // 的流式更新冲突，引发 "removeChild" 报错。translate=no + notranslate 双保险。
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark" translate="no">
      <body className="notranslate min-h-screen antialiased" translate="no">
        <ErrorBoundary>{children}</ErrorBoundary>
        {/* 自动演示驱动（无人值守循环）：访问 /?auto=1 开启，或点右下角按钮 */}
        <script src="/auto-demo.js" defer />
      </body>
    </html>
  );
}
