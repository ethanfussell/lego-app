// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import { AuthProvider } from "@/app/providers";
import AnalyticsClient from "@/app/components/AnalyticsClient";
import { siteBase, SITE_NAME } from "@/lib/url";


export const metadata: Metadata = {
  metadataBase: new URL(siteBase()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Track LEGO sets, collections, lists, ratings, and reviews.",

  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },

  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
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