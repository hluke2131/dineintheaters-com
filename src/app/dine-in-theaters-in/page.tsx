import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CountLinkCard } from "@/components/count-link-card";
import { EmptyState } from "@/components/empty-state";
import { slugify } from "@/lib/format-slug";
import { getStatesWithCounts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Dine-In Theaters by State",
  description: "Browse dine-in movie theaters by state.",
};

export default async function StateIndexPage() {
  const states = await getStatesWithCounts();

  return (
    <Container className="py-16 sm:py-24">
      <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
        Browse by State
      </p>
      <h1 className="mt-2 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Theaters by State
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">
        Every state with at least one dine-in theater in the directory.
      </p>

      <div className="mt-10">
        {states.length > 0 ? (
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
        ) : (
          <EmptyState
            title="Now building out our directory — check back soon"
            message="States will appear here as soon as the first dine-in theaters go live."
          />
        )}
      </div>
    </Container>
  );
}
