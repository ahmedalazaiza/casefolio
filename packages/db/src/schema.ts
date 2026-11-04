import { relations } from "drizzle-orm";
import {
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

export const PLAN_TIERS = ["free", "pro", "team"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const MEMBERSHIP_ROLES = ["owner", "editor", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

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
  seats: integer("seats").notNull().default(3),
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
    role: text("role").$type<MembershipRole>().notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memberships_user_org_uidx").on(table.userId, table.orgId)],
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

// Better Auth organization plugin: invitations
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<MembershipRole>().notNull().default("viewer"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("invitations_org_email_idx").on(table.organizationId, table.email)],
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
    coverUrl: text("cover_url"),
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

// 7. projects (ERD)
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").$type<ProjectType>().notNull(),
    puckData: jsonb("puck_data").$type<Record<string, unknown>>().notNull(),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull(),
    slug: text("slug").unique(),
    visibility: text("visibility").$type<ProjectVisibility>().notNull().default("private"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("projects_owner_id_idx").on(table.ownerId),
    index("projects_org_id_idx").on(table.orgId),
  ],
);

// 8. assets (ERD)
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    slot: text("slot").notNull(),
    crop: jsonb("crop").$type<{ x: number; y: number; width: number; height: number } | null>(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assets_project_id_idx").on(table.projectId)],
);

// 9. exports (ERD)
export const exportsTable = pgTable(
  "exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    format: text("format").$type<ExportFormat>().notNull(),
    status: text("status").$type<ExportStatus>().notNull().default("queued"),
    r2Key: text("r2_key"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("exports_project_id_idx").on(table.projectId)],
);

// 10. subscriptions (ERD)
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    paddleCustomerId: text("paddle_customer_id"),
    paddleSubscriptionId: text("paddle_subscription_id").unique(),
    plan: text("plan").$type<PlanTier>().notNull().default("free"),
    status: text("status").notNull().default("active"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_org_id_idx").on(table.orgId),
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

// Drizzle relations
export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  memberships: many(memberships),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
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
  subscription: one(subscriptions, {
    fields: [organizations.id],
    references: [subscriptions.orgId],
  }),
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
  templateVersion: one(templateVersions, {
    fields: [projects.templateVersionId],
    references: [templateVersions.id],
  }),
  assets: many(assets),
  exports: many(exportsTable),
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
] as const;

export const ALL_SCHEMA_TABLE_NAMES = [...ERD_TABLE_NAMES, ...SUPPORT_TABLE_NAMES] as const;
