import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

import "./globals.css";

/**
 * One family, loaded locally. Every string on this site — chrome and scraped
 * data alike — is Persian, so a Latin display face would only ever be the
 * fallback for numerals we render as Persian digits anyway.
 */
const iran = localFont({
  src: [
    { path: "../fonts/iran/IRAN.woff2", weight: "400", style: "normal" },
    { path: "../fonts/iran/IRAN_SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/iran/IRANBold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/iran/IRANBlack.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-iran",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "تابلوی مزایده‌ها",
    template: "%s · تابلوی مزایده‌ها",
  },
  description:
    "بازتابی از تابلوی اموال منقول ستاد ایران، با فیلتر، نشانی پایدار و امکان بازگشت.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={iran.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
