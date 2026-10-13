import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { resolveRobots } from "@/lib/indexing";
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      template: "%s | DineInTheaters.com",
      default: "DineInTheaters.com | Find Dine-In Movie Theaters Near You",
    },
    description:
      "A directory of dine-in movie theaters across the United States — recliners, in-seat dining, and full bars, city by city.",
    // noindex on *.vercel.app hosts, nothing on the real domain. Pages that
    // set their own robots also go through resolveRobots.
    robots: await resolveRobots(),
  };
}

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
