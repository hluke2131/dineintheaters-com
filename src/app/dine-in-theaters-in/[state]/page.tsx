import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";
import { formatSlug } from "@/lib/format-slug";

type Params = { state: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state } = await params;
  const stateName = formatSlug(state);
  return {
    title: `Dine-In Theaters in ${stateName}`,
    description: `Find dine-in movie theaters in ${stateName}.`,
  };
}

export default async function StatePage({ params }: { params: Promise<Params> }) {
  const { state } = await params;
  const stateName = formatSlug(state);
  return (
    <PlaceholderPage
      eyebrow="State"
      title={`Dine-In Theaters in ${stateName}`}
      description={`Every dine-in theater in ${stateName} will be listed here, organized by city.`}
    />
  );
}
