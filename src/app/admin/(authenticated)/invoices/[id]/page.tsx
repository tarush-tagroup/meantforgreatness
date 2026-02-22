import { getSessionUser } from "@/lib/auth-guard";
import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { invoices, invoiceLineItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatIdr(amount: number): string {
  return amount.toLocaleString("id-ID");
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

  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(asc(invoiceLineItems.orphanageName));

  const periodLabel = new Date(
    invoice.periodStart + "T00:00:00"
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/admin/invoices"
          className="text-xs font-medium text-sage-600 hover:text-sage-800"
        >
          ← Back to Invoices
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-900">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-1 text-sm text-sand-500">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                invoice.status === "paid"
                  ? "bg-green-100 text-green-700"
                  : invoice.status === "sent"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-sand-100 text-sand-600"
              }`}
            >
              {invoice.status}
            </span>
            <a
              href={`/api/admin/invoices/${invoice.id}/pdf`}
              className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-800"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="rounded-lg border border-sand-200 bg-white p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              From
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.fromEntity}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              To
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.toEntity}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Period
            </p>
            <p className="mt-1 text-sm text-sand-700">{periodLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Generated
            </p>
            <p className="mt-1 text-sm text-sand-700">
              {new Date(invoice.generatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Rate per Class
            </p>
            <p className="mt-1 text-sm text-sand-700">
              IDR {formatIdr(invoice.ratePerClassIdr)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Total Classes
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.totalClasses}
            </p>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-sand-100">
          <h2 className="text-sm font-semibold text-sand-900">
            Line Items{" "}
            <span className="text-sand-400 font-normal">
              ({lineItems.length})
            </span>
          </h2>
        </div>

        {lineItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-sand-400">
            No classes recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Orphanage</th>
                  <th className="px-4 py-2 text-right">Classes</th>
                  <th className="px-4 py-2 text-right">Rate (IDR)</th>
                  <th className="px-4 py-2 text-right">Subtotal (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {lineItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2 text-sand-500">{index + 1}</td>
                    <td className="px-4 py-2 font-medium text-sand-900">
                      {item.orphanageName}
                    </td>
                    <td className="px-4 py-2 text-right text-sand-700">
                      {item.classCount}
                    </td>
                    <td className="px-4 py-2 text-right text-sand-600">
                      {formatIdr(item.ratePerClassIdr)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-sand-900">
                      {formatIdr(item.subtotalIdr)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sand-200 bg-sand-50">
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-sm font-bold text-sand-900"
                  >
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sand-900">
                    {invoice.totalClasses}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-base font-bold text-green-700">
                    IDR {formatIdr(invoice.totalAmountIdr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
