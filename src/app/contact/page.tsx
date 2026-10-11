import type { Metadata } from "next";
import { Hero } from "@/components/hero";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with DineInTheaters.com.",
};

export default function ContactPage() {
  return (
    <Hero
      size="compact"
      eyebrow="Contact"
      title="Contact Us"
      description="A contact form will live here."
    />
  );
}
