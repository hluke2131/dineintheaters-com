import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { TheaterCard } from "@/components/theater-card";
import { formatSlug } from "@/lib/format-slug";
import { getActiveLocationsByCity } from "@/lib/queries";
import { getStateBySlug } from "@/lib/us-states";

type Params = { state: string; city: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const stateName = getStateBySlug(state)?.name ?? formatSlug(state);
  const cityName = formatSlug(city);
  return {
    title: `Dine-In Theaters in ${cityName}, ${stateName}`,
    description: `Find dine-in movie theaters in ${cityName}, ${stateName}.`,
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { state, city } = await params;
  const stateInfo = getStateBySlug(state);

  if (!stateInfo) {
    notFound();
  }

  const cityName = formatSlug(city);
  const locations = await getActiveLocationsByCity(stateInfo.code, cityName);

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: stateInfo.name, href: `/dine-in-theaters-in/${state}` },
          { label: cityName },
        ]}
      />
      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Theaters in {cityName}, {stateInfo.name}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">
        Every dine-in theater in {cityName}.
      </p>

      <div className="mt-10">
        {locations.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {locations.map((location) => (
              <TheaterCard key={location.id} location={location} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No theaters listed in ${cityName} yet`}
            message="We're actively building out this directory. Check back soon, or use Add a Theater to suggest one."
          />
        )}
      </div>
    </Container>
  );
}
