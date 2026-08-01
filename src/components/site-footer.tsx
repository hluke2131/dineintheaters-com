import Link from "next/link";
import { Container } from "./container";

type FooterLink = { href: string; label: string };

const directoryLinks: FooterLink[] = [
  { href: "/dine-in-theaters", label: "Browse Theaters" },
  { href: "/dine-in-theaters-in", label: "Browse by State" },
  { href: "/add-a-theater", label: "Add a Theater" },
];

const companyLinks: FooterLink[] = [
  { href: "/about-us", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const legalLinks: FooterLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="font-display text-sm uppercase tracking-wide text-gold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-cream/80 hover:text-cream">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-burgundy-dark text-cream">
      <Container className="grid gap-8 py-12 sm:grid-cols-3">
        <FooterColumn title="Directory" links={directoryLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </Container>
      <div className="border-t border-cream/10">
        <Container className="py-6 text-sm text-cream/60">
          © {new Date().getFullYear()} DineInTheaters.com. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
