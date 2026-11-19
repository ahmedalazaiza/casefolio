import { revalidatePath } from "next/cache";

/**
 * Purges cached ISR HTML + OpenGraph card for a public case study (`/p/[slug]`).
 * Safe to invoke outside Next.js request contexts (e.g. unit tests or standalone scripts).
 */
export function revalidatePublicProject(slug: string | null | undefined): void {
  if (!slug || !slug.trim()) return;
  const clean = encodeURIComponent(slug.trim());
  try {
    revalidatePath(`/p/${clean}`);
    revalidatePath(`/p/${clean}/opengraph-image`);
    revalidatePath("/sitemap.xml");
  } catch {
    // Outside Next.js server runtime (e.g. Vitest), revalidatePath is a safe no-op
  }
}

