import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/listing-detail";
import { formatSlug } from "@/lib/format-slug";
import { getLocationBySlug, getReviewsByLocationId } from "@/lib/queries";
import { metaDescription } from "@/lib/theater-display";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) {
    return { title: formatSlug(slug) };
  }

  return {
    title: `${location.name} — Dine-In Theater in ${location.city}, ${location.state}`,
    description: location.description
      ? metaDescription(location.description)
      : `Details, menu style, and directions for ${location.name} in ${location.city}, ${location.state}.`,
    alternates: { canonical: `/dine-in-theaters/${location.slug}` },
    robots: location.status === "permanently_closed" ? { index: false, follow: true } : undefined,
  };
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);

  if (!location) {
    notFound();
  }

  const reviews = await getReviewsByLocationId(location.id);

  return <ListingDetail location={location} reviews={reviews} />;
}
