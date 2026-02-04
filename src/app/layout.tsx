import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bizinventra - Inventory & Accounting",
  description: "Offline-first inventory and accounting app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bizinventra",
  },
};

export function generateViewport() {
  return {
    themeColor: "#000000",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <OfflineIndicator />
        {/* Fixed footer spacer for Android navigation bar - only visible on mobile */}
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 pointer-events-none md:hidden"
          style={{ 
            height: 'max(48px, env(safe-area-inset-bottom))',
            paddingBottom: 'env(safe-area-inset-bottom)'
          }}
        />
      </body>
    </html>
  );
}
