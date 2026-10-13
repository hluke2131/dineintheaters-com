import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { TheaterCard } from "@/components/theater-card";
import { formatSlug } from "@/lib/format-slug";
import { getCityByStateAndSlug } from "@/lib/queries";
import { getStateBySlug } from "@/lib/us-states";

type Params = { state: string; city: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const stateInfo = getStateBySlug(state);
  if (!stateInfo) {
    return { title: formatSlug(city) };
  }

  const group = await getCityByStateAndSlug(stateInfo.code, city);
  const cityName = group?.city ?? formatSlug(city);
  return {
    title: `Dine-In Theaters in ${cityName}, ${stateInfo.name}`,
    description: `Find dine-in movie theaters in ${cityName}, ${stateInfo.name}.`,
    // Cities below the linking threshold still resolve, but they are not
    // linked to or indexed; their theaters live on the state hub.
    alternates: group
      ? { canonical: `/dine-in-theaters-in/${stateInfo.code.toLowerCase()}/${group.slug}` }
      : undefined,
    robots: group?.linked ? undefined : { index: false, follow: true },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { state, city } = await params;
  const stateInfo = getStateBySlug(state);

  if (!stateInfo) {
    notFound();
  }

  // A valid state with a city that has no published listing is a 404, same as
  // an unpublished listing slug. (Cities with 1-2 listings resolve here and are
  // noindexed in generateMetadata; they are just never linked to.)
  const group = await getCityByStateAndSlug(stateInfo.code, city);
  if (!group) {
    notFound();
  }

  const cityName = group.city;
  const locations = group.listings;

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: stateInfo.name, href: `/dine-in-theaters-in/${stateInfo.code.toLowerCase()}` },
          { label: cityName },
        ]}
      />
      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Theaters in {cityName}, {stateInfo.name}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">
        Every dine-in theater in {cityName}.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {locations.map((location) => (
          <TheaterCard key={location.id} location={location} />
        ))}
      </div>
    </Container>
  );
}
