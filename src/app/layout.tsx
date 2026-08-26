import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "板橋約跑",
    template: "%s · 板橋約跑",
  },
  description: "板橋跑友揪團約跑網頁 App",
  applicationName: "板橋約跑",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "板橋約跑",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3a2a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${notoSansTc.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-16">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
