// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import { AuthProvider } from "@/app/providers";
import AnalyticsClient from "@/app/components/AnalyticsClient";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "LEGO App";

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteBase()),
  title: {
    default: SITE_NAME,
    template: `${SITE_NAME} | %s`,
  },
  description: "Track LEGO sets, collections, lists, ratings, and reviews.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <html lang="en">
      <body>
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
                window.gtag('js', new Date());
                window.gtag('config', '${GA_ID}', {
                  send_page_view: false,
                  debug_mode: ${process.env.NODE_ENV !== "production" ? "true" : "false"}
                });
              `}
            </Script>
          </>
        ) : null}

        <AuthProvider>
          <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
            <TopNav />
            <AnalyticsClient />
            <main className="mx-auto w-full max-w-5xl px-6 pb-16">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}