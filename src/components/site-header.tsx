import Link from "next/link";
import { Container } from "./container";

const navLinks = [
  { href: "/dine-in-theaters", label: "Browse Theaters" },
  { href: "/dine-in-theaters-in", label: "By State" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/login", label: "Log in" },
];

// Every link is at least 44px tall (min-h-11) so it is a comfortable tap
// target. On phones the logo and the Add a Theater button share the first row
// and the nav drops to a second, full-width row; from md up it is one row.
export function SiteHeader() {
  return (
    <header className="border-b border-burgundy/10 bg-cream">
      <Container className="flex flex-wrap items-center justify-between gap-x-4 py-1.5 md:py-3">
        <Link
          href="/"
          className="order-1 inline-flex min-h-11 items-center font-display text-xl text-burgundy-dark"
        >
          Dine-In Theaters
        </Link>
        <Link
          href="/add-a-theater"
          className="order-2 inline-flex min-h-11 items-center rounded-full bg-burgundy px-4 text-sm font-medium text-cream hover:bg-burgundy-dark md:order-3"
        >
          Add a Theater
        </Link>
        <nav
          aria-label="Main"
          className="order-3 flex w-full flex-wrap items-center gap-x-2 text-sm sm:gap-x-6 md:order-2 md:w-auto"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink hover:text-burgundy"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
