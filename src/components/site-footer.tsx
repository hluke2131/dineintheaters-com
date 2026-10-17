import Link from "next/link";
import type { ReactNode } from "react";
import { CONSENT_UI_ENABLED } from "@/lib/consent";
import { Container } from "./container";
import { CookieSettingsButton } from "./cookie-settings-button";

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

function FooterColumn({
  title,
  links,
  extra,
}: {
  title: string;
  links: FooterLink[];
  extra?: ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-sm uppercase tracking-wide text-gold">{title}</h3>
      <ul className="mt-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center text-sm text-cream/80 hover:text-cream"
            >
              {link.label}
            </Link>
          </li>
        ))}
        {extra ? <li>{extra}</li> : null}
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
        {/* Build-time check (NEXT_PUBLIC_* is inlined), so the footer stays
            static. Absent unless the consent banner is enabled. */}
        <FooterColumn
          title="Legal"
          links={legalLinks}
          extra={CONSENT_UI_ENABLED ? <CookieSettingsButton /> : null}
        />
      </Container>
      <div className="border-t border-cream/10">
        <Container className="py-6 text-sm text-cream/60">
          © {new Date().getFullYear()} DineInTheaters.com. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
