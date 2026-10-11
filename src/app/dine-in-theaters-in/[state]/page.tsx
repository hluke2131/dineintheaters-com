import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { CountLinkCard } from "@/components/count-link-card";
import { EmptyState } from "@/components/empty-state";
import { TheaterCard } from "@/components/theater-card";
import { formatSlug } from "@/lib/format-slug";
import { getStateHub } from "@/lib/queries";
import { getStateBySlug } from "@/lib/us-states";

type Params = { state: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state } = await params;
  const stateInfo = getStateBySlug(state);
  if (!stateInfo) {
    return { title: formatSlug(state) };
  }

  const hub = await getStateHub(stateInfo.code);
  return {
    title: `Dine-In Theaters in ${stateInfo.name}`,
    description: `Find dine-in movie theaters in ${stateInfo.name}.`,
    alternates: { canonical: `/dine-in-theaters-in/${stateInfo.code.toLowerCase()}` },
    // A valid state with nothing published yet renders a friendly empty page
    // for visitors, but there is nothing for a search engine to index.
    robots: hub.total === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function StatePage({ params }: { params: Promise<Params> }) {
  const { state } = await params;
  const stateInfo = getStateBySlug(state);

  if (!stateInfo) {
    notFound();
  }

  const hub = await getStateHub(stateInfo.code);
  const stateSlug = stateInfo.code.toLowerCase();

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: stateInfo.name }]} />
      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Theaters in {stateInfo.name}
      </h1>

      {hub.total > 0 ? (
        <>
          <p className="mt-4 max-w-2xl text-lg text-ink/70">
            {hub.total} dine-in {hub.total === 1 ? "theater" : "theaters"} in {stateInfo.name}.
          </p>

          {hub.linkedCities.length > 0 ? (
            <section className="mt-10" aria-labelledby="browse-cities-heading">
              <h2
                id="browse-cities-heading"
                className="font-display text-2xl text-burgundy-dark"
              >
                Browse by city
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hub.linkedCities.map((item) => (
                  <CountLinkCard
                    key={item.slug}
                    href={`/dine-in-theaters-in/${stateSlug}/${item.slug}`}
                    name={item.city}
                    count={item.count}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-14" aria-labelledby="all-theaters-heading">
            <h2 id="all-theaters-heading" className="font-display text-2xl text-burgundy-dark">
              All theaters in {stateInfo.name}
            </h2>

            {hub.linkedCities.map((city) => (
              <div key={city.slug} className="mt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-xl text-burgundy-dark">{city.city}</h3>
                  <Link
                    href={`/dine-in-theaters-in/${stateSlug}/${city.slug}`}
                    className="text-sm font-medium text-burgundy hover:text-burgundy-dark"
                  >
                    {city.city} page →
                  </Link>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {city.listings.map((location) => (
                    <TheaterCard key={location.id} location={location} />
                  ))}
                </div>
              </div>
            ))}

            {hub.otherCities.length > 0 ? (
              <div className="mt-8">
                {hub.linkedCities.length > 0 ? (
                  <h3 className="font-display text-xl text-burgundy-dark">Other cities</h3>
                ) : null}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {hub.otherCities
                    .flatMap((city) => city.listings)
                    .map((location) => (
                      <TheaterCard key={location.id} location={location} />
                    ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="mt-14 rounded-xl border border-dashed border-burgundy/25 bg-burgundy/5 p-6 text-center">
            <p className="font-display text-lg text-burgundy-dark">Know one we missed?</p>
            <p className="mt-1 text-ink/70">
              {`If a theater in ${stateInfo.name} serves real meals, we’d like to hear about it.`}
            </p>
            <Link
              href="/add-a-theater"
              className="mt-4 inline-block rounded-full bg-burgundy px-5 py-2.5 font-medium text-cream hover:bg-burgundy-dark"
            >
              Suggest a theater
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-10">
          <EmptyState
            title={`No theaters listed in ${stateInfo.name} yet`}
            message={`We're still building out ${stateInfo.name}. If you know a theater there where you can order a real meal, tell us and we'll take a look.`}
          >
            <Link
              href="/add-a-theater"
              className="rounded-full bg-burgundy px-5 py-2.5 font-medium text-cream hover:bg-burgundy-dark"
            >
              Know one we missed?
            </Link>
            <Link
              href="/dine-in-theaters-in"
              className="rounded-full border border-burgundy px-5 py-2.5 font-medium text-burgundy hover:bg-burgundy/5"
            >
              Browse other states
            </Link>
          </EmptyState>
        </div>
      )}
    </Container>
  );
}
