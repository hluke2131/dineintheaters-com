import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { CountLinkCard } from "@/components/count-link-card";
import { EmptyState } from "@/components/empty-state";
import { Hero } from "@/components/hero";
import { getPopularCities, getStatesWithCounts } from "@/lib/queries";
import { getStateBySlug } from "@/lib/us-states";

export const metadata: Metadata = {
  title: "Find Dine-In Movie Theaters Near You",
  description:
    "A directory of dine-in movie theaters across the United States — recliners, in-seat dining, and full bars, city by city.",
};

const STANDARDS = [
  {
    title: "A real menu",
    description:
      "Burgers, pizza, sandwiches, salads, entrées. If it's only popcorn, candy and nachos, it doesn't make the list.",
  },
  {
    title: "Served where you sit",
    description:
      "You order at your seat or at the counter and eat in the auditorium, so dinner and the movie happen at once.",
  },
];

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

const heroPrimaryButton =
  "rounded-full bg-gold px-7 py-3.5 font-medium text-ink hover:bg-cream";
const heroSecondaryButton =
  "rounded-full border border-cream/70 px-7 py-3.5 font-medium text-cream hover:bg-cream/10";

export default async function Home() {
  const [popularCities, states] = await Promise.all([
    getPopularCities(6),
    getStatesWithCounts(),
  ]);

  // Same published-only source as the state explorer below, so the stat line
  // can never disagree with the cards.
  const theaterCount = states.reduce((sum, item) => sum + item.count, 0);
  const stateCount = states.length;

  return (
    <>
      <Hero
        eyebrow="The dine-in movie theater directory"
        title="Come hungry. Stay for the movie."
        description="Burgers, pizza, salads and full entrées, brought to your seat or ready at the counter. Find the theaters where a movie night means a real meal, not just popcorn."
      >
        <div className="mt-9 flex flex-wrap gap-4">
          <Link href="/dine-in-theaters" className={heroPrimaryButton}>
            Browse all theaters
          </Link>
          <Link href="/dine-in-theaters-in" className={heroSecondaryButton}>
            Browse by state
          </Link>
        </div>
        {theaterCount > 0 ? (
          <p className="mt-8 text-base text-cream/90">
            <span className="font-display text-2xl text-gold">
              {theaterCount.toLocaleString("en-US")}
            </span>{" "}
            dine-in {theaterCount === 1 ? "theater" : "theaters"} across{" "}
            <span className="font-medium text-cream">{stateCount.toLocaleString("en-US")}</span>{" "}
            {stateCount === 1 ? "state" : "states"}
          </p>
        ) : null}
      </Hero>

      <section className="bg-white" aria-labelledby="how-we-choose-heading">
        <Container className="py-14 sm:py-20">
          <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
            How We Choose
          </p>
          <h2
            id="how-we-choose-heading"
            className="mt-2 max-w-2xl font-display text-3xl text-burgundy-dark sm:text-4xl"
          >
            A real meal, not just popcorn.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-ink/70">
            We list only theaters where you can order a real meal, at your seat or at the
            counter. That&rsquo;s the whole standard.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STANDARDS.map((item) => (
              <div key={item.title} className="border-l-4 border-gold pl-5">
                <h3 className="font-display text-lg text-burgundy-dark">{item.title}</h3>
                <p className="mt-2 text-ink/70">{item.description}</p>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-burgundy/25 bg-burgundy/5 p-5">
              <h3 className="font-display text-lg text-burgundy-dark">Know one we missed?</h3>
              <p className="mt-2 text-ink/70">
                If a theater near you serves real meals, tell us and we&rsquo;ll take a look.
              </p>
              <Link
                href="/add-a-theater"
                className="mt-3 inline-block font-medium text-burgundy underline hover:text-burgundy-dark"
              >
                Suggest a theater
              </Link>
            </div>
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
                    key={`${item.state}-${item.slug}`}
                    href={`/dine-in-theaters-in/${item.state.toLowerCase()}/${item.slug}`}
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
                      href={`/dine-in-theaters-in/${item.state.toLowerCase()}`}
                      name={getStateBySlug(item.state)?.name ?? item.state}
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

      <section>
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
    </>
  );
}
