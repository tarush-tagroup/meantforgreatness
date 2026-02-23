import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  serial,
  doublePrecision,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    googleId: varchar("google_id", { length: 255 }).unique(),
    roles: text("roles")
      .array()
      .notNull()
      .default([]),
    status: varchar("status", { length: 20 }).notNull().default("invited"),
    invitedBy: uuid("invited_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at").defaultNow(),
    activatedAt: timestamp("activated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_status_idx").on(table.status),
  ]
);

// ─── Orphanages ──────────────────────────────────────────────────────────────
export const orphanages = pgTable("orphanages", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  indonesianName: varchar("indonesian_name", { length: 255 }),
  address: text("address"),
  location: varchar("location", { length: 255 }).notNull(),
  description: text("description").notNull(),
  curriculum: varchar("curriculum", { length: 255 }),
  runningSince: varchar("running_since", { length: 50 }),
  imageUrl: text("image_url"),
  studentCount: integer("student_count").notNull().default(0),
  classesPerWeek: integer("classes_per_week").notNull().default(0),
  hoursPerWeek: integer("hours_per_week"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Class Groups ────────────────────────────────────────────────────────────
export const classGroups = pgTable("class_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  orphanageId: varchar("orphanage_id", { length: 50 })
    .notNull()
    .references(() => orphanages.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  studentCount: integer("student_count").notNull().default(0),
  ageRange: varchar("age_range", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Class Logs ──────────────────────────────────────────────────────────────
export const classLogs = pgTable(
  "class_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orphanageId: varchar("orphanage_id", { length: 50 })
      .notNull()
      .references(() => orphanages.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    classDate: date("class_date").notNull(),
    classTime: varchar("class_time", { length: 20 }),
    studentCount: integer("student_count"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    // AI-extracted metadata (read-only, auto-generated from photos)
    aiKidsCount: integer("ai_kids_count"),
    aiLocation: text("ai_location"),
    aiPhotoTimestamp: varchar("ai_photo_timestamp", { length: 100 }),
    aiOrphanageMatch: varchar("ai_orphanage_match", { length: 50 }),
    aiConfidenceNotes: text("ai_confidence_notes"),
    aiPrimaryPhotoUrl: text("ai_primary_photo_url"),
    aiAnalyzedAt: timestamp("ai_analyzed_at"),
    // GPS coordinates extracted from photo EXIF data
    photoLatitude: doublePrecision("photo_latitude"),
    photoLongitude: doublePrecision("photo_longitude"),
    aiGpsDistance: doublePrecision("ai_gps_distance"), // distance in meters from orphanage
    // EXIF date/time extracted from photo metadata
    exifDateTaken: varchar("exif_date_taken", { length: 30 }), // ISO 8601 from EXIF, e.g. "2025-03-12T10:30:00"
    aiDateMatch: varchar("ai_date_match", { length: 20 }), // "match" | "mismatch" | "no_exif"
    aiDateNotes: text("ai_date_notes"), // human-readable explanation of date validation
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("class_logs_teacher_idx").on(table.teacherId),
    index("class_logs_date_idx").on(table.classDate),
  ]
);

// ─── Class Log Photos ───────────────────────────────────────────────────────
export const classLogPhotos = pgTable("class_log_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  classLogId: uuid("class_log_id")
    .notNull()
    .references(() => classLogs.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 500 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Events ──────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  eventDate: date("event_date"),
  orphanageId: varchar("orphanage_id", { length: 50 }).references(
    () => orphanages.id,
    { onDelete: "set null" }
  ),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  coverImageUrl: text("cover_image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Event Photos ────────────────────────────────────────────────────────────
export const eventPhotos = pgTable("event_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: varchar("caption", { length: 500 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Media ───────────────────────────────────────────────────────────────────
export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  orphanageId: varchar("orphanage_id", { length: 50 }).references(
    () => orphanages.id,
    { onDelete: "set null" }
  ),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Transparency Reports ────────────────────────────────────────────────────
export const transparencyReports = pgTable("transparency_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  quarter: integer("quarter").notNull(),
  year: integer("year").notNull(),
  totalClasses: integer("total_classes").notNull().default(0),
  totalStudents: integer("total_students").notNull().default(0),
  totalTeachers: integer("total_teachers").notNull().default(0),
  orphanageCount: integer("orphanage_count").notNull().default(0),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Donations ───────────────────────────────────────────────────────────────
export const donations = pgTable(
  "donations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeSessionId: varchar("stripe_session_id", { length: 255 }).unique(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    donorEmail: varchar("donor_email", { length: 255 }).notNull(),
    donorName: varchar("donor_name", { length: 255 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("usd"),
    frequency: varchar("frequency", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    provider: varchar("provider", { length: 20 }).notNull().default("stripe"),
    stripeEventId: varchar("stripe_event_id", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("donations_email_idx").on(table.donorEmail),
    index("donations_status_idx").on(table.status),
    index("donations_created_idx").on(table.createdAt),
  ]
);

// ─── Site Settings ──────────────────────────────────────────────────────────
export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Donors (public donor accounts — separate from admin users) ─────────────
export const donors = pgTable(
  "donors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => [
    index("donors_email_idx").on(table.email),
    index("donors_stripe_customer_idx").on(table.stripeCustomerId),
  ]
);

// ─── Donor OTPs (one-time passcodes for passwordless login) ─────────────────
export const donorOtps = pgTable("donor_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  donorId: uuid("donor_id")
    .notNull()
    .references(() => donors.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Kids ────────────────────────────────────────────────────────────────────
export const kids = pgTable("kids", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  age: integer("age").notNull(),
  hobby: varchar("hobby", { length: 500 }),
  location: varchar("location", { length: 500 }),
  about: text("about"),
  favoriteWord: text("favorite_word"),
  imageUrl: text("image_url"),
  orphanageId: varchar("orphanage_id", { length: 50 }).references(
    () => orphanages.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Anthropic Usage ────────────────────────────────────────────────────────
export const anthropicUsage = pgTable(
  "anthropic_usage",
  {
    id: serial("id").primaryKey(),
    useCase: varchar("use_case", { length: 50 }).notNull(), // "photo_analysis" | "monitor"
    model: varchar("model", { length: 100 }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0), // USD cents for precision
    classLogId: uuid("class_log_id"), // nullable, only for photo analysis
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("anthropic_usage_use_case_idx").on(table.useCase),
    index("anthropic_usage_created_at_idx").on(table.createdAt),
  ]
);

// ─── Bank Accounts ──────────────────────────────────────────────────────────
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 20 }).notNull(), // "mercury" | "wise"
  externalId: varchar("external_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("usd"),
  balanceCents: integer("balance_cents").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Bank Transactions ──────────────────────────────────────────────────────
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull().unique(),
    date: date("date").notNull(),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("usd"),
    category: varchar("category", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("posted"),
    counterparty: varchar("counterparty", { length: 255 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("bank_txn_account_idx").on(table.bankAccountId),
    index("bank_txn_date_idx").on(table.date),
  ]
);

// ─── Invoices ───────────────────────────────────────────────────────────────
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    fromEntity: varchar("from_entity", { length: 255 }).notNull().default("TransforMe Academy"),
    toEntity: varchar("to_entity", { length: 255 }).notNull().default("White Light Ventures, Inc"),
    totalClasses: integer("total_classes").notNull().default(0),
    totalAmountIdr: integer("total_amount_idr").notNull().default(0),
    miscTotalIdr: integer("misc_total_idr").notNull().default(0),
    ratePerClassIdr: integer("rate_per_class_idr").notNull().default(300000),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // "draft" | "final"
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoices_period_idx").on(table.periodStart),
    index("invoices_status_idx").on(table.status),
  ]
);

// ─── Invoice Line Items ─────────────────────────────────────────────────────
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    orphanageId: varchar("orphanage_id", { length: 50 })
      .notNull()
      .references(() => orphanages.id),
    orphanageName: varchar("orphanage_name", { length: 255 }).notNull(),
    classCount: integer("class_count").notNull().default(0),
    ratePerClassIdr: integer("rate_per_class_idr").notNull().default(300000),
    subtotalIdr: integer("subtotal_idr").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("line_items_invoice_idx").on(table.invoiceId),
  ]
);

// ─── Invoice Misc Items ────────────────────────────────────────────────────
export const invoiceMiscItems = pgTable(
  "invoice_misc_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    rateIdr: integer("rate_idr").notNull().default(0),
    subtotalIdr: integer("subtotal_idr").notNull().default(0),
    receiptUrl: text("receipt_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("misc_items_invoice_idx").on(table.invoiceId),
  ]
);

// ─── Cron Runs ──────────────────────────────────────────────────────────────
export const cronRuns = pgTable(
  "cron_runs",
  {
    id: serial("id").primaryKey(),
    jobName: varchar("job_name", { length: 100 }).notNull(), // e.g. "ingest-vercel-logs", "monitor"
    status: varchar("status", { length: 20 }).notNull().default("running"), // "running" | "success" | "error"
    message: text("message"), // summary or error message
    itemsProcessed: integer("items_processed").default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [
    index("cron_runs_job_name_idx").on(table.jobName),
    index("cron_runs_started_at_idx").on(table.startedAt),
  ]
);
