import type { ReactNode } from "react";

export function Chip({
  children,
  tone = "burgundy",
}: {
  children: ReactNode;
  tone?: "burgundy" | "gold" | "ink";
}) {
  const tones = {
    burgundy: "bg-burgundy/10 text-burgundy-dark",
    gold: "bg-gold/15 text-burgundy-dark",
    ink: "bg-ink/5 text-ink/70",
  } as const;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
