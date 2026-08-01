import { Container } from "./container";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <Container className="py-16 sm:py-24">
      {eyebrow ? (
        <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 font-display text-4xl text-burgundy-dark sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">{description}</p>
    </Container>
  );
}
