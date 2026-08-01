import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Dine-In Movie Theaters Directory",
  description: "Browse the full directory of dine-in movie theaters across the United States.",
};

export default function DineInTheatersPage() {
  return (
    <PlaceholderPage
      eyebrow="Directory"
      title="Dine-In Movie Theaters"
      description="The full, searchable directory of dine-in movie theaters will live here."
    />
  );
}
