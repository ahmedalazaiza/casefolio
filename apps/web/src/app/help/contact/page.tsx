import { desc, eq } from "@casefolio/db";
import type { Metadata } from "next";
import { ContactSupportClient } from "@/components/help/contact-support-client";
import { HelpShell } from "@/components/help/help-shell";
import { getServerSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export const metadata: Metadata = {
  title: "Contact Support — Casefolio",
  description:
    "Get direct help from the Casefolio team. Send a question about your projects, exports, or billing and expect an email reply within one business day.",
  alternates: {
    canonical: "/help/contact",
  },
};

export default async function ContactSupportPage() {
  const session = await getServerSession();
  const userProjects = session
    ? await db
        .select({
          id: dbSchema.projects.id,
          title: dbSchema.projects.name,
        })
        .from(dbSchema.projects)
        .where(eq(dbSchema.projects.ownerId, session.user.id))
        .orderBy(desc(dbSchema.projects.updatedAt))
        .limit(20)
    : [];

  return (
    <HelpShell>
      <ContactSupportClient
        defaultEmail={session?.user.email ?? ""}
        projects={userProjects}
      />
    </HelpShell>
  );
}
