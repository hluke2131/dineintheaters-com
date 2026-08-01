import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The DineInTheaters.com terms of service.",
};

export default function TermsPage() {
  return (
    <PlaceholderPage
      eyebrow="Legal"
      title="Terms of Service"
      description="The terms of service will live here."
    />
  );
}
