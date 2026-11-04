import type { Metadata } from "next";
import Link from "next/link";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { computeUserInitials, requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account Settings — Casefolio",
};

export default async function AccountPage() {
  const { user } = await requireSession("/account");
  const initials = computeUserInitials(user.name, user.email);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-primary type-overline">Workspace settings</span>
        <h1 className="type-display-m text-foreground">Account &amp; profile</h1>
        <p className="text-muted-foreground type-body-m">
          Manage your public designer identity, plan tier, and team collaboration settings.
        </p>
      </div>

      <nav
        aria-label="Account sections"
        className="border-border flex flex-wrap items-center gap-2 border-b pb-3"
      >
        <Link
          href="/account"
          aria-current="page"
          className="border-border bg-elevated text-foreground type-body-s-strong rounded-full border px-4 py-1.5"
        >
          Profile
        </Link>
        <Link
          href="/account/team"
          className="text-muted-foreground hover:text-foreground type-body-s rounded-full px-4 py-1.5 transition-colors"
        >
          Team &amp; invites
        </Link>
        <Link
          href="/account/billing"
          className="text-muted-foreground hover:text-foreground type-body-s rounded-full px-4 py-1.5 transition-colors"
        >
          Billing &amp; plan
        </Link>
      </nav>

      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <AvatarBadge initials={initials} src={user.image} alt={user.name} size="lg" />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-foreground type-h3">{user.name}</h2>
                <Badge tone="accent">{user.role}</Badge>
                <Badge tone={user.plan === "free" ? "neutral" : "pro"}>
                  {user.plan.toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground type-body-s">{user.email}</p>
            </div>
          </div>

          <Button asChild variant="secondary">
            <Link href="/account/team">Manage team workspace</Link>
          </Button>
        </div>

        <dl className="border-border grid gap-4 border-t pt-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-tertiary type-overline">Headline / Role</dt>
            <dd className="text-foreground type-body-m">{user.jobTitle ?? "Not set yet"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-tertiary type-overline">Design focus</dt>
            <dd className="text-foreground type-body-m capitalize">
              {user.designFocus ?? "All project types"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-tertiary type-overline">Email verification</dt>
            <dd className="text-foreground type-body-m">
              {user.emailVerified ? "Verified" : "Pending verification"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
