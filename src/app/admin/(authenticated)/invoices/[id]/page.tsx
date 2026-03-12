import { getSessionUser } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import {
  invoices,
  invoiceLineItems,
  invoiceMiscItems,
  orphanages,
  classLogs,
} from "@/db/schema";
import { eq, asc, and, gte, lte, sql } from "drizzle-orm";
import InvoiceEditor from "./InvoiceEditor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!hasPermission(user.roles, "invoices:view")) redirect("/admin");

  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) notFound();

  const [lineItems, miscItems, allOrphanages, loggedClassCounts, loggedClassHours] =
    await Promise.all([
      db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, id))
        .orderBy(asc(invoiceLineItems.orphanageName)),
      db
        .select()
        .from(invoiceMiscItems)
        .where(eq(invoiceMiscItems.invoiceId, id))
        .orderBy(asc(invoiceMiscItems.sortOrder)),
      db
        .select({ id: orphanages.id, name: orphanages.name })
        .from(orphanages)
        .orderBy(asc(orphanages.name)),
      // Count classes actually logged in the DB for this invoice's period
      db
        .select({
          orphanageId: classLogs.orphanageId,
          count: sql<number>`count(*)::int`,
        })
        .from(classLogs)
        .where(
          and(
            gte(classLogs.classDate, invoice.periodStart),
            lte(classLogs.classDate, invoice.periodEnd)
          )
        )
        .groupBy(classLogs.orphanageId),
      // Sum hours actually logged in the DB for this invoice's period
      db
        .select({
          orphanageId: classLogs.orphanageId,
          hours: sql<number>`coalesce(sum(${classLogs.classDuration}), 0)::float`,
        })
        .from(classLogs)
        .where(
          and(
            gte(classLogs.classDate, invoice.periodStart),
            lte(classLogs.classDate, invoice.periodEnd)
          )
        )
        .groupBy(classLogs.orphanageId),
    ]);

  // Convert to simple Record<orphanageId, count/hours>
  const loggedCounts: Record<string, number> = {};
  for (const row of loggedClassCounts) {
    loggedCounts[row.orphanageId] = row.count;
  }
  const loggedHours: Record<string, number> = {};
  for (const row of loggedClassHours) {
    loggedHours[row.orphanageId] = row.hours;
  }

  return (
    <InvoiceEditor
      invoice={JSON.parse(JSON.stringify(invoice))}
      lineItems={JSON.parse(JSON.stringify(lineItems))}
      miscItems={JSON.parse(JSON.stringify(miscItems))}
      allOrphanages={allOrphanages}
      loggedCounts={loggedCounts}
      loggedHours={loggedHours}
    />
  );
}
