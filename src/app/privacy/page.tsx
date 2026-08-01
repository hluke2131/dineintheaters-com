import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "The DineInTheaters.com privacy policy.",
};

export default function PrivacyPage() {
  return (
    <PlaceholderPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="The privacy policy will live here."
    />
  );
}
