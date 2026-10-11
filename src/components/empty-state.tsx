import type { ReactNode } from "react";

export function EmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-burgundy/25 bg-burgundy/5 px-6 py-12 text-center">
      <p className="font-display text-xl text-burgundy-dark">{title}</p>
      <p className="mt-2 text-ink/70">{message}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}
