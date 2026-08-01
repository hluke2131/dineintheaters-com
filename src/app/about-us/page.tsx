import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "About Us",
  description: "About DineInTheaters.com.",
};

export default function AboutPage() {
  return (
    <PlaceholderPage eyebrow="About" title="About Us" description="Our story will live here." />
  );
}
