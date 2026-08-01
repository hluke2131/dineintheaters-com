import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";
import { formatSlug } from "@/lib/format-slug";

type Params = { state: string; city: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const stateName = formatSlug(state);
  const cityName = formatSlug(city);
  return {
    title: `Dine-In Theaters in ${cityName}, ${stateName}`,
    description: `Find dine-in movie theaters in ${cityName}, ${stateName}.`,
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { state, city } = await params;
  const stateName = formatSlug(state);
  const cityName = formatSlug(city);
  return (
    <PlaceholderPage
      eyebrow="City"
      title={`Dine-In Theaters in ${cityName}, ${stateName}`}
      description={`Every dine-in theater in ${cityName} will be listed here.`}
    />
  );
}
