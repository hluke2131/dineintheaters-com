import type { Metadata } from "next";
import { Hero } from "@/components/hero";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and guides about dine-in movie theaters.",
};

export default function BlogIndexPage() {
  return (
    <Hero
      size="compact"
      eyebrow="Blog"
      title="Blog"
      description="Articles and guides about dine-in movie theaters will be published here."
    />
  );
}
