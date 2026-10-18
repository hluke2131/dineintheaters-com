import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { HAS_PUBLISHED_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and guides about dine-in movie theaters.",
  alternates: { canonical: "/blog" },
  // Nothing to index until the first post exists; flips automatically then.
  robots: HAS_PUBLISHED_POSTS ? undefined : { index: false, follow: true },
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
