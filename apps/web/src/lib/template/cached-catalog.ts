import { unstable_cache } from "next/cache";
import { listPublishedLibraryTemplates } from "@/lib/template/service";

/**
 * Published template catalog shared by `/new` (and any other server surface). The catalog is identical
 * for every visitor (plan gating happens in the UI), so it is cached for 5 minutes and invalidated
 * instantly via `revalidateTag("templates")` whenever an admin saves / publishes / archives a template.
 */
const getCachedPublishedTemplatesProd = unstable_cache(
  async () => listPublishedLibraryTemplates(),
  ["published-library-templates"],
  { revalidate: 300, tags: ["templates"] },
);

export async function getCachedPublishedTemplates() {
  if (process.env.NODE_ENV === "production") {
    return getCachedPublishedTemplatesProd();
  }
  return listPublishedLibraryTemplates();
}
