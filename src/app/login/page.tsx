import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your DineInTheaters.com account.",
  // A placeholder with no form yet; nothing here is worth a search result.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <PlaceholderPage eyebrow="Account" title="Log In" description="A login form will live here." />
  );
}
