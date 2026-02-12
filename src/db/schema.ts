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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("class_logs_teacher_idx").on(table.teacherId),
    index("class_logs_date_idx").on(table.classDate),
  ]
);

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
