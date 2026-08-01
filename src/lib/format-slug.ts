export function formatSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}
