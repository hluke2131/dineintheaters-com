import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/structured-data";

export type BreadcrumbItem = { label: string; href?: string };

/** `structuredData` also emits the matching BreadcrumbList JSON-LD. Pass it
 * only on indexable pages (not on noindex thin city hubs or empty states). */
export function Breadcrumb({
  items,
  structuredData = false,
}: {
  items: BreadcrumbItem[];
  structuredData?: boolean;
}) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink/60">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 min-w-11 items-center hover:text-burgundy"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="py-2.5 text-ink">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {structuredData ? <JsonLd data={breadcrumbJsonLd(items)} /> : null}
    </>
  );
}
