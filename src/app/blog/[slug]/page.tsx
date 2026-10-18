import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/placeholder-page";
import { BLOG_POSTS } from "@/lib/blog";
import { formatSlug } from "@/lib/format-slug";

type Params = { slug: string };

// Only slugs in BLOG_POSTS exist. They are prerendered at build time, and any
// other slug gets a real HTTP 404 (with no request-time APIs, so the route
// stays static). With the list empty, every /blog/<slug> is a 404.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!BLOG_POSTS.some((post) => post.slug === slug)) return { title: "Not Found" };

  return {
    title: formatSlug(slug),
    description: "Read this article on the DineInTheaters.com blog.",
    // Resolved against metadataBase (SITE_URL), never the request host.
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  // dynamicParams = false already 404s unknown slugs; this keeps the page
  // safe on its own if that setting is ever changed.
  if (!BLOG_POSTS.some((post) => post.slug === slug)) notFound();

  return (
    <PlaceholderPage
      eyebrow="Blog Post"
      title={formatSlug(slug)}
      description="This article will live here."
    />
  );
}
