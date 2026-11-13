import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const USER_ROLES = ["user", "admin", "superadmin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLAN_TIERS = ["free", "pro", "team", "plus"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export const CANONICAL_BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type CanonicalBillingInterval = (typeof CANONICAL_BILLING_INTERVALS)[number];

export const CANONICAL_MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
export type CanonicalMembershipRole = (typeof CANONICAL_MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_ROLES = ["owner", "admin", "member", "editor", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const WORKSPACE_KINDS = ["personal", "team"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const SPACE_VISIBILITIES = ["private", "shared"] as const;
export type SpaceVisibility = (typeof SPACE_VISIBILITIES)[number];

export const SPACE_RECOVERY_STATES = [
  "active",
  "frozen_member_departed",
  "frozen_workspace",
] as const;
export type SpaceRecoveryState = (typeof SPACE_RECOVERY_STATES)[number];

export const BILLING_OPERATION_KINDS = [
  "checkout",
  "seat_increase",
  "seat_decrease",
  "cancel_seat_decrease",
  "cancel_subscription",
  "resume_subscription",
  "owner_transfer",
] as const;
export type BillingOperationKind = (typeof BILLING_OPERATION_KINDS)[number];

export const BILLING_OPERATION_STATUSES = [
  "previewed",
  "pending",
  "completed",
  "failed",
  "canceled",
] as const;
export type BillingOperationStatus = (typeof BILLING_OPERATION_STATUSES)[number];

export const USAGE_METER_KEYS = ["exports", "uploads_bytes", "bandwidth_bytes"] as const;
export type UsageMeterKey = (typeof USAGE_METER_KEYS)[number];

export function normalizeMembershipRole(
  role: string | null | undefined,
): CanonicalMembershipRole {
  if (role === "owner") return "owner";
  if (role === "admin" || role === "editor") return "admin";
  return "member";
}

export const PROJECT_TYPES = ["mobile", "web", "both"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const TEMPLATE_TIERS = ["free", "pro"] as const;
export type TemplateTier = (typeof TEMPLATE_TIERS)[number];

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const PROJECT_VISIBILITIES = ["private", "unlisted", "public"] as const;
export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number];

export const EXPORT_FORMATS = ["png_long", "pdf", "behance"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const REPORT_STATUSES = ["open", "reviewed", "dismissed", "takedown"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// 1. users (ERD + approved Better Auth & C-203 onboarding columns)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull(),
  image: text("image"),
  role: text("role").$type<UserRole>().notNull().default("user"),
  plan: text("plan").$type<PlanTier>().notNull().default("free"),
  suspended: boolean("suspended").notNull().default(false),
  jobTitle: text("job_title"),
  designFocus: text("design_focus").$type<ProjectType>(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. organizations (ERD + Better Auth organization plugin fields)
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  seats: integer("seats").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. memberships (ERD + Better Auth organization member compatibility)
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").$type<MembershipRole>().notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memberships_user_org_uidx").on(table.userId, table.orgId)],
);

// Business Tenancy: workspaces (1 personal workspace per user; 1 team workspace per organization)
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").$type<WorkspaceKind>().notNull(),
    personalOwnerId: uuid("personal_owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenReason: text("frozen_reason"),
    graceUsedAt: timestamp("grace_used_at", { withTimezone: true }),
    graceExpiresAt: timestamp("grace_expires_at", { withTimezone: true }),
    keepPublicProjectId: uuid("keep_public_project_id"),
    maxSeats: integer("max_seats").notNull().default(1),
    maxCaseStudies: integer("max_case_studies").notNull().default(1),
    customDomain: text("custom_domain"),
    customDomainEnabled: boolean("custom_domain_enabled").notNull().default(false),
    watermarkEnabled: boolean("watermark_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspaces_personal_owner_uidx").on(table.personalOwnerId),
    uniqueIndex("workspaces_organization_uidx").on(table.organizationId),
  ],
);

// Business Privacy: spaces (strictly private to controllerUserId OR shared across active workspace members)
export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    visibility: text("visibility").$type<SpaceVisibility>().notNull().default("private"),
    isDefault: boolean("is_default").notNull().default(false),
    controllerUserId: uuid("controller_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aclVersion: integer("acl_version").notNull().default(1),
    recoveryState: text("recovery_state")
      .$type<SpaceRecoveryState>()
      .notNull()
      .default("active"),
    departedAt: timestamp("departed_at", { withTimezone: true }),
    recoveryUntil: timestamp("recovery_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("spaces_workspace_vis_idx").on(table.workspaceId, table.visibility),
    index("spaces_controller_recovery_idx").on(table.controllerUserId, table.recoveryState),
    uniqueIndex("spaces_workspace_slug_uidx").on(table.workspaceId, table.slug),
  ],
);

// Better Auth: sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Better Auth: accounts
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_uidx").on(table.providerId, table.accountId),
  ],
);

// Better Auth: verifications
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// Better Auth organization plugin: invitations (+ opaque single-use token hash & revocation tracking)
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<MembershipRole>().notNull().default("member"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash"),
    resentCount: integer("resent_count").notNull().default(0),
    resentAt: timestamp("resent_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invitations_org_email_idx").on(table.organizationId, table.email),
    index("invitations_token_hash_idx").on(table.tokenHash),
  ],
);

// 4. categories (ERD)
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5. templates (ERD)
export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").$type<ProjectType>().notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    tier: text("tier").$type<TemplateTier>().notNull().default("free"),
    status: text("status").$type<TemplateStatus>().notNull().default("draft"),
    coverUrl: text("cover_url")
      .notNull()
      .default("/templates/cinema/cover.svg"),
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("templates_status_type_tier_idx").on(table.status, table.type, table.tier),
    index("templates_category_id_idx").on(table.categoryId),
  ],
);

// 6. template_versions (ERD)
export const templateVersions = pgTable(
  "template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    changelog: text("changelog"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("template_versions_tpl_ver_uidx").on(table.templateId, table.version)],
);

// 7. projects (ERD + additive workspace/space/revision/archive/branding columns)
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").$type<ProjectType>().notNull(),
    puckData: jsonb("puck_data").$type<Record<string, unknown>>().notNull(),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull(),
    revision: integer("revision").notNull().default(1),
    slug: text("slug").unique(),
    visibility: text("visibility").$type<ProjectVisibility>().notNull().default("private"),
    brandingRemoved: boolean("branding_removed").notNull().default(false),
    publicAcknowledgedAt: timestamp("public_acknowledged_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("projects_owner_id_idx").on(table.ownerId),
    index("projects_org_id_idx").on(table.orgId),
    index("projects_workspace_space_idx").on(table.workspaceId, table.spaceId),
  ],
);

// 8. assets (ERD + additive workspace scoping & workspace-local sha256)
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    r2Key: text("r2_key").notNull(),
    slot: text("slot").notNull(),
    crop: jsonb("crop").$type<{ x: number; y: number; width: number; height: number } | null>(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    mimeType: text("mime_type"),
    sha256: text("sha256"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assets_project_id_idx").on(table.projectId),
    index("assets_workspace_id_idx").on(table.workspaceId),
  ],
);

// 9. exports (ERD + additive cacheKey, revision, scale, requester & 7-day artifact expiry)
export const exportsTable = pgTable(
  "exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    format: text("format").$type<ExportFormat>().notNull(),
    status: text("status").$type<ExportStatus>().notNull().default("queued"),
    projectRevision: integer("project_revision").notNull().default(1),
    scale: integer("scale").notNull().default(1),
    hasWatermark: boolean("has_watermark").notNull().default(true),
    cacheKey: text("cache_key"),
    bytes: integer("bytes"),
    r2Key: text("r2_key"),
    error: text("error"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exports_project_id_idx").on(table.projectId),
    index("exports_workspace_cache_idx").on(table.workspaceId, table.cacheKey),
  ],
);

// 10. subscriptions (ERD + additive workspace seat capacity, renewal decrease, pastDueSince & ordering)
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    paddleCustomerId: text("paddle_customer_id"),
    paddleSubscriptionId: text("paddle_subscription_id").unique(),
    plan: text("plan").$type<PlanTier>().notNull().default("free"),
    planVersion: text("plan_version").notNull().default("2026-11-13.v2"),
    interval: text("interval").$type<"monthly" | "yearly">().notNull().default("monthly"),
    status: text("status").notNull().default("active"),
    currentPaidCapacity: integer("current_paid_capacity").notNull().default(1),
    maxSeats: integer("max_seats").notNull().default(1),
    maxCaseStudies: integer("max_case_studies").notNull().default(1),
    customDomainEnabled: boolean("custom_domain_enabled").notNull().default(false),
    watermarkEnabled: boolean("watermark_enabled").notNull().default(true),
    renewalQuantity: integer("renewal_quantity"),
    pastDueSince: timestamp("past_due_since", { withTimezone: true }),
    lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true }),
    scheduledChangeAction: text("scheduled_change_action"),
    pendingOperationId: uuid("pending_operation_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_org_id_idx").on(table.orgId),
    index("subscriptions_workspace_id_idx").on(table.workspaceId),
  ],
);

// 11. page_views (ERD: bigint id PK)
export const pageViews = pgTable(
  "page_views",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    referrer: text("referrer"),
    country: text("country"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("page_views_project_at_idx").on(table.projectId, table.at)],
);

// 12. notifications (ERD)
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.readAt)],
);

// 13. reports (ERD)
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reports_status_idx").on(table.status)],
);

// 14. audit_logs (ERD)
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_at_idx").on(table.at)],
);

// Approved webhook idempotency table (C-701 / 02-RULES.md §5)
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  provider: text("provider").notNull().default("paddle"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Published snapshots: isolates public `/p/[slug]` delivery from private unpublished draft edits
export const publishedSnapshots = pgTable("published_snapshots", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
  puckData: jsonb("puck_data").$type<Record<string, unknown>>().notNull(),
  theme: jsonb("theme").$type<Record<string, unknown>>().notNull(),
  publishedAssetIds: jsonb("published_asset_ids").$type<string[]>().notNull().default([]),
  brandingRemoved: boolean("branding_removed").notNull().default(false),
  suspendedReason: text("suspended_reason"),
  publishedByUserId: uuid("published_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  publicAcknowledgedAt: timestamp("public_acknowledged_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Recoverable content history (7d Free / 30d Pro / 90d Teams; counts toward storage quota)
export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    puckData: jsonb("puck_data").$type<Record<string, unknown>>().notNull(),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull(),
    bytes: integer("bytes").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("project_revisions_project_created_idx").on(table.projectId, table.createdAt),
    uniqueIndex("project_revisions_proj_rev_uidx").on(table.projectId, table.revision),
  ],
);

// Async collaboration lease (120s TTL, 30s heartbeat) for single-writer shared editing
export const editLeases = pgTable("edit_leases", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  holderUserId: uuid("holder_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  holderName: text("holder_name"),
  leaseToken: text("lease_token").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Resumable billing operations saga (seat increase preview/confirm, renewal decrease, cancel decrease)
export const billingOperations = pgTable(
  "billing_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").$type<BillingOperationKind>().notNull(),
    status: text("status").$type<BillingOperationStatus>().notNull().default("pending"),
    previousQuantity: integer("previous_quantity"),
    targetQuantity: integer("target_quantity"),
    previewAmountCents: integer("preview_amount_cents"),
    renewalAmountCents: integer("renewal_amount_cents"),
    currency: text("currency").notNull().default("USD"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    providerTransactionId: text("provider_transaction_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("billing_operations_workspace_idx").on(table.workspaceId, table.createdAt)],
);

// Seat reservations: 1 reservation per pending invitation (7-day expiry, resend replaces without double-reserving)
export const seatReservations = pgTable(
  "seat_reservations",
  {
    invitationId: uuid("invitation_id")
      .primaryKey()
      .references(() => invitations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    normalizedEmail: text("normalized_email").notNull(),
    role: text("role").$type<MembershipRole>().notNull().default("member"),
    status: text("status")
      .$type<"active" | "consumed" | "revoked" | "expired">()
      .notNull()
      .default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("seat_reservations_org_status_idx").on(
      table.organizationId,
      table.status,
      table.expiresAt,
    ),
  ],
);

// UTC calendar-month usage meters (exports, new uploads bytes, bandwidth bytes)
export const usageBuckets = pgTable(
  "usage_buckets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    calendarMonth: text("calendar_month").notNull(),
    meter: text("meter").$type<UsageMeterKey>().notNull(),
    usedValue: bigint("used_value", { mode: "number" }).notNull().default(0),
    reservedValue: bigint("reserved_value", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_buckets_ws_month_meter_uidx").on(
      table.workspaceId,
      table.calendarMonth,
      table.meter,
    ),
  ],
);

// Atomic idempotent usage reservations (reserve before enqueue -> commit on success / release on failure)
export const usageReservations = pgTable(
  "usage_reservations",
  {
    jobId: text("job_id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    calendarMonth: text("calendar_month").notNull(),
    meter: text("meter").$type<UsageMeterKey>().notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    status: text("status")
      .$type<"reserved" | "committed" | "released">()
      .notNull()
      .default("reserved"),
    cacheKey: text("cache_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("usage_reservations_ws_month_idx").on(table.workspaceId, table.calendarMonth)],
);

// Explicit owner transfer requests (recipient acceptance + reauthentication; preserves single owner)
export const ownerTransferRequests = pgTable(
  "owner_transfer_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fromOwnerUserId: uuid("from_owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toMemberUserId: uuid("to_member_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"pending" | "accepted" | "canceled" | "expired">()
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("owner_transfer_org_status_idx").on(table.organizationId, table.status)],
);

// Drizzle relations
export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  memberships: many(memberships),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  personalWorkspace: one(workspaces, {
    fields: [users.id],
    references: [workspaces.personalOwnerId],
  }),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  memberships: many(memberships),
  projects: many(projects),
  invitations: many(invitations),
  workspace: one(workspaces, {
    fields: [organizations.id],
    references: [workspaces.organizationId],
  }),
  subscription: one(subscriptions, {
    fields: [organizations.id],
    references: [subscriptions.orgId],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  personalOwner: one(users, {
    fields: [workspaces.personalOwnerId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  spaces: many(spaces),
  projects: many(projects),
  subscriptions: many(subscriptions),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [spaces.workspaceId],
    references: [workspaces.id],
  }),
  controller: one(users, {
    fields: [spaces.controllerUserId],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  templates: many(templates),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  category: one(categories, {
    fields: [templates.categoryId],
    references: [categories.id],
  }),
  versions: many(templateVersions),
}));

export const templateVersionsRelations = relations(templateVersions, ({ one, many }) => ({
  template: one(templates, {
    fields: [templateVersions.templateId],
    references: [templates.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  space: one(spaces, {
    fields: [projects.spaceId],
    references: [spaces.id],
  }),
  templateVersion: one(templateVersions, {
    fields: [projects.templateVersionId],
    references: [templateVersions.id],
  }),
  assets: many(assets),
  exports: many(exportsTable),
  revisions: many(projectRevisions),
  pageViews: many(pageViews),
  reports: many(reports),
}));

export const ERD_TABLE_NAMES = [
  "users",
  "organizations",
  "memberships",
  "categories",
  "templates",
  "template_versions",
  "projects",
  "assets",
  "exports",
  "subscriptions",
  "page_views",
  "notifications",
  "reports",
  "audit_logs",
] as const;

export const SUPPORT_TABLE_NAMES = [
  "sessions",
  "accounts",
  "verifications",
  "invitations",
  "webhook_events",
  "workspaces",
  "spaces",
  "published_snapshots",
  "project_revisions",
  "edit_leases",
  "billing_operations",
  "seat_reservations",
  "usage_buckets",
  "usage_reservations",
  "owner_transfer_requests",
] as const;

export const ALL_SCHEMA_TABLE_NAMES = [...ERD_TABLE_NAMES, ...SUPPORT_TABLE_NAMES] as const;

// Durable per-IP request counters for Better Auth (`rateLimit.storage: "database"`).
// Serverless instances do not share memory, so in-memory counters neither protect auth endpoints
// nor behave predictably for real users; this table gives one shared, atomic source of truth.
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
