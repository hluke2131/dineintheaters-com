import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";
import { formatSlug } from "@/lib/format-slug";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: formatSlug(slug),
    description: "Read this article on the DineInTheaters.com blog.",
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <PlaceholderPage
      eyebrow="Blog Post"
      title={formatSlug(slug)}
      description="This article will live here."
    />
  );
}
