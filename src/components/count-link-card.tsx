import Link from "next/link";

export function CountLinkCard({
  href,
  name,
  count,
  unitLabel = "dine-in theaters",
}: {
  href: string;
  name: string;
  count: number;
  unitLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-burgundy/10 bg-white p-5 shadow-sm transition hover:border-burgundy/30 hover:shadow-md"
    >
      <p className="font-display text-lg text-burgundy-dark">{name}</p>
      <p className="mt-1 text-sm text-ink/60">
        {count} {unitLabel}
      </p>
    </Link>
  );
}
