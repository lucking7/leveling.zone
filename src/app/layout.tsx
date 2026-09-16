import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/locale";

export const metadata: Metadata = {
  applicationName: "Orbit",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Orbit", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: "ORBIT | 地址观测",
  description:
    "查询 IP 的位置、网络归属及 RDAP 注册信息。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <link rel="mask-icon" href="/brand/orbit-mark-mono.svg" color="#ef7b35" />
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{__html: `try{document.documentElement.dataset.theme=localStorage.getItem('orbit.theme')==='dark'?'dark':'light'}catch{}`}} />
      </head>
      <body className="min-h-screen">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
