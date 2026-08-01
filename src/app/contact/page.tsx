import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with DineInTheaters.com.",
};

export default function ContactPage() {
  return (
    <PlaceholderPage
      eyebrow="Contact"
      title="Contact Us"
      description="A contact form will live here."
    />
  );
}
