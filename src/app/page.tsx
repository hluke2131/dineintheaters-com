import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { CountLinkCard } from "@/components/count-link-card";
import { EmptyState } from "@/components/empty-state";
import { slugify } from "@/lib/format-slug";
import { getPopularCities, getStatesWithCounts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Find Dine-In Movie Theaters Near You",
  description:
    "A directory of dine-in movie theaters across the United States — recliners, in-seat dining, and full bars, city by city.",
};

const DIFFERENTIATORS = [
  {
    title: "Built for Dine-In, Not Bolted On",
    description:
      "Generic review sites treat a dine-in theater like any other restaurant. We track what actually matters here: delivery style, alcohol service, recliner seating, age-restricted auditoriums.",
  },
  {
    title: "Know Before You Go",
    description:
      "Full bar or beer & wine? In-seat service or counter pickup? Reserved recliners or first-come? Every listing spells it out in structured fields, not a five-paragraph review.",
  },
  {
    title: "Crowd-Verified, Not Stale",
    description:
      "Hours, menus, and policies change. Details here get confirmed or disputed by people who've actually been, so listings don't rot for years like an old directory entry.",
  },
  {
    title: "One City at a Time",
    description:
      "We're not trying to list everything everywhere on day one. We're building an accurate, focused directory — city by city — and it shows in the data quality.",
  },
];

export default async function Home() {
  const [popularCities, states] = await Promise.all([
    getPopularCities(6),
    getStatesWithCounts(),
  ]);

  return (
    <>
      <Container className="py-20 sm:py-28">
        <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
          DineInTheaters.com
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-5xl text-burgundy-dark sm:text-6xl">
          Dinner and a movie, without leaving your seat.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink/70">
          A growing directory of dine-in movie theaters across the United States. Find
          recliners, in-seat service, and full bars near you — the full directory is
          coming online soon.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/dine-in-theaters"
            className="rounded-full bg-burgundy px-6 py-3 font-medium text-cream hover:bg-burgundy-dark"
          >
            Browse Theaters
          </Link>
          <Link
            href="/add-a-theater"
            className="rounded-full border border-burgundy px-6 py-3 font-medium text-burgundy hover:bg-burgundy/5"
          >
            Add a Theater
          </Link>
        </div>
      </Container>

      <section className="bg-white">
        <Container className="py-16 sm:py-24">
          <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
            Why This Directory
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl text-burgundy-dark sm:text-4xl">
            Not another generic listings site.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {DIFFERENTIATORS.map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-lg text-burgundy-dark">{item.title}</h3>
                <p className="mt-2 text-ink/70">{item.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-24">
          <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
            Popular Cities
          </p>
          <h2 className="mt-2 font-display text-3xl text-burgundy-dark sm:text-4xl">
            Where people are looking.
          </h2>
          <div className="mt-10">
            {popularCities.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {popularCities.map((item) => (
                  <CountLinkCard
                    key={`${item.state}-${item.city}`}
                    href={`/dine-in-theaters-in/${slugify(item.state)}/${slugify(item.city)}`}
                    name={`${item.city}, ${item.state}`}
                    count={item.count}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Now building out our directory — check back soon"
                message="We're adding dine-in theaters city by city. Popular cities will show up here as listings go live."
              />
            )}
          </div>
        </Container>
      </section>

      <section className="bg-white">
        <Container className="py-16 sm:py-24">
          <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
            Browse by State
          </p>
          <h2 className="mt-2 font-display text-3xl text-burgundy-dark sm:text-4xl">
            Find theaters near you.
          </h2>
          <div className="mt-10">
            {states.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {states.map((item) => (
                    <CountLinkCard
                      key={item.state}
                      href={`/dine-in-theaters-in/${slugify(item.state)}`}
                      name={item.state}
                      count={item.count}
                    />
                  ))}
                </div>
                <Link
                  href="/dine-in-theaters-in"
                  className="mt-8 inline-block font-medium text-burgundy hover:text-burgundy-dark"
                >
                  Browse all states →
                </Link>
              </>
            ) : (
              <EmptyState
                title="Now building out our directory — check back soon"
                message="States will appear here as soon as the first dine-in theaters go live."
              />
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
