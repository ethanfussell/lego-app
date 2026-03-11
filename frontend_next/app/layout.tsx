// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import BottomTabBar from "@/app/components/BottomTabBar";
import { AuthBridge } from "@/app/providers";
import { ToastProvider } from "@/app/ui-providers/ToastProvider";
import AnalyticsClient from "@/app/components/AnalyticsClient";
import { siteBase, SITE_NAME } from "@/lib/url";
import WebVitals from "@/app/components/WebVitals";
import CookieConsent from "@/app/components/CookieConsent";


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

  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;

  return (
    <ClerkProvider>
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

          <AuthBridge>
            <ToastProvider>
              <div className="min-h-screen bg-white text-zinc-900">
                <TopNav />
                <AnalyticsClient />
                <WebVitals />
                <main className="mx-auto w-full max-w-5xl px-6 pb-20 md:pb-16">{children}</main>
                <Footer />
                <BottomTabBar />
                <CookieConsent />
              </div>
            </ToastProvider>
          </AuthBridge>
        </body>
      </html>
    </ClerkProvider>
  );
}
