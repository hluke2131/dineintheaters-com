import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and guides about dine-in movie theaters.",
};

export default function BlogIndexPage() {
  return (
    <PlaceholderPage
      eyebrow="Blog"
      title="Blog"
      description="Articles and guides about dine-in movie theaters will be published here."
    />
  );
}
