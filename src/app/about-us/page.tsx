import type { Metadata } from "next";
import { Hero } from "@/components/hero";

export const metadata: Metadata = {
  title: "About Us",
  description: "About DineInTheaters.com.",
  alternates: { canonical: "/about-us" },
};

export default function AboutPage() {
  return (
    <Hero
      size="compact"
      eyebrow="About"
      title="About Us"
      description="Our story will live here."
    />
  );
}
