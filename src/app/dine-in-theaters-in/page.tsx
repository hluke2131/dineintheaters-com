import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Dine-In Theaters by State",
  description: "Browse dine-in movie theaters by state.",
};

export default function StateIndexPage() {
  return (
    <PlaceholderPage
      eyebrow="Browse by State"
      title="Dine-In Theaters by State"
      description="An index of every state with dine-in movie theaters will live here."
    />
  );
}
