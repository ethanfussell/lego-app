// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/components/TopNav";
import { AuthProvider } from "@/app/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteBase()),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
            <TopNav />
            <main className="mx-auto w-full max-w-5xl px-6 pb-16">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}