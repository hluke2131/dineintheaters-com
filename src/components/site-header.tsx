import Link from "next/link";
import { Container } from "./container";

const navLinks = [
  { href: "/dine-in-theaters", label: "Browse Theaters" },
  { href: "/dine-in-theaters-in", label: "By State" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-burgundy/10 bg-cream">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="font-display text-xl text-burgundy-dark">
          Dine-In Theaters
        </Link>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink hover:text-burgundy">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-ink hover:text-burgundy">
            Log in
          </Link>
          <Link
            href="/add-a-theater"
            className="rounded-full bg-burgundy px-4 py-2 font-medium text-cream hover:bg-burgundy-dark"
          >
            Add a Theater
          </Link>
        </div>
      </Container>
    </header>
  );
}
