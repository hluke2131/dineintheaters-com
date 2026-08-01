import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";

export const metadata: Metadata = {
  title: "Find Dine-In Movie Theaters Near You",
  description:
    "A directory of dine-in movie theaters across the United States — recliners, in-seat dining, and full bars, city by city.",
};

export default function Home() {
  return (
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
  );
}
