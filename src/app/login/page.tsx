import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your DineInTheaters.com account.",
};

export default function LoginPage() {
  return (
    <PlaceholderPage eyebrow="Account" title="Log In" description="A login form will live here." />
  );
}
