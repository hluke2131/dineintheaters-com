import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { CountLinkCard } from "@/components/count-link-card";
import { EmptyState } from "@/components/empty-state";
import { formatSlug, slugify } from "@/lib/format-slug";
import { getCitiesWithCounts } from "@/lib/queries";
import { getStateBySlug } from "@/lib/us-states";

type Params = { state: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state } = await params;
  const stateName = getStateBySlug(state) ?? formatSlug(state);
  return {
    title: `Dine-In Theaters in ${stateName}`,
    description: `Find dine-in movie theaters in ${stateName}.`,
  };
}

export default async function StatePage({ params }: { params: Promise<Params> }) {
  const { state } = await params;
  const stateName = getStateBySlug(state);

  if (!stateName) {
    notFound();
  }

  const cities = await getCitiesWithCounts(stateName);

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: stateName }]} />
      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Theaters in {stateName}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">
        Every dine-in theater in {stateName}, organized by city.
      </p>

      <div className="mt-10">
        {cities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((item) => (
              <CountLinkCard
                key={item.city}
                href={`/dine-in-theaters-in/${slugify(stateName)}/${slugify(item.city)}`}
                name={item.city}
                count={item.count}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No theaters listed in ${stateName} yet`}
            message="We're actively building out this directory. Check back soon, or use Add a Theater to suggest one."
          />
        )}
      </div>
    </Container>
  );
}
