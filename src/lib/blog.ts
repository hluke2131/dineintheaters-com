// The blog's published posts. A static list for now: there is no posts table
// yet, so adding the first entry here is what flips /blog to indexable and
// puts it (and each post) in the sitemap. When posts move into a database,
// replace this with a cookie-free, is_published-filtered query and keep the
// same two exports so the blog index and the sitemap need no other change.
export type BlogPostSummary = { slug: string; updatedAt: string };

export const BLOG_POSTS: readonly BlogPostSummary[] = [];

/** True once at least one post is published. Until then /blog is a
 * placeholder: noindex and absent from the sitemap. Pure constants, so it
 * needs no request data and keeps /blog static. */
export const HAS_PUBLISHED_POSTS = BLOG_POSTS.length > 0;
