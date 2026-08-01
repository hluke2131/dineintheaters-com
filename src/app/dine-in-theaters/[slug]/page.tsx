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
  const name = formatSlug(slug);
  return {
    title: name,
    description: `Theater details, hours, and amenities for ${name}.`,
  };
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return (
    <PlaceholderPage
      eyebrow="Theater Profile"
      title={formatSlug(slug)}
      description="The full theater profile — hours, menu, amenities, and reviews — will live here."
    />
  );
}
