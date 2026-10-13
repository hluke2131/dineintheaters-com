import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Static on purpose: nothing here may read request headers, or every route in
// the app becomes dynamic. Noindex for *.vercel.app hosts is the X-Robots-Tag
// header set in next.config.ts, not anything rendered here.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | DineInTheaters.com",
    default: "DineInTheaters.com | Find Dine-In Movie Theaters Near You",
  },
  description:
    "A directory of dine-in movie theaters across the United States — recliners, in-seat dining, and full bars, city by city.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfairDisplay.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
