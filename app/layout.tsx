import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// 🏷️ 這裡設定 LINE / FB 分享連結時會顯示的資訊
export const metadata: Metadata = {
  title: '🏸 羽球臨打報名系統 | BBC Badminton',
  description: '快速線上預約羽球臨打時段、查看即時報名人數與程度分級！',
  openGraph: {
    title: '🏸 羽球臨打報名系統 | BBC Badminton',
    description: '快速線上預約羽球臨打時段、查看即時報名人數與程度分級！',
    siteName: 'BBC Badminton',
    locale: 'zh_TW',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  );
}