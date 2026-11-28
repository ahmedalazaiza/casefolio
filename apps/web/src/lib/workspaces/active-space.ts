import { cookies } from "next/headers";
import type { SpaceSummaryItem } from "@/lib/workspaces/service";

export const ACTIVE_SPACE_COOKIE_NAME = "cf_active_space";

/**
 * Resolves a stored space cookie or query parameter to either a valid visible space ID
 * in the current workspace or `"all"`.
 */
export function resolveActiveSpaceFilter(
  spaces: readonly Pick<SpaceSummaryItem, "id">[],
  candidateSpaceId: string | null | undefined,
): string {
  const clean = candidateSpaceId?.trim();
  if (!clean || clean === "all") {
    return "all";
  }
  return spaces.some((space) => space.id === clean) ? clean : "all";
}

export async function getActiveSpaceCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_SPACE_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}
