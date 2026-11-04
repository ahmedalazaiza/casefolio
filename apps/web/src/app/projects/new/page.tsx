import { redirect } from "next/navigation";

export default async function LegacyProjectsNewRedirect({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  if (template) {
    redirect(`/new?template=${encodeURIComponent(template)}`);
  }
  redirect("/new");
}
