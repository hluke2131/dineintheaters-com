import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Add a Theater",
  description: "Suggest a dine-in movie theater to add to the directory.",
};

export default function AddATheaterPage() {
  return (
    <PlaceholderPage
      eyebrow="Suggest a Listing"
      title="Add a Theater"
      description="A submission form will live here."
    />
  );
}
