import { jsPDF } from "jspdf";

interface InvoiceData {
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  fromEntity: string;
  toEntity: string;
  totalClasses: number;
  totalAmountIdr: number;
  miscTotalIdr: number;
  ratePerClassIdr: number;
  status: string;
  generatedAt: Date | string;
}

interface LineItemData {
  orphanageName: string;
  classCount: number;
  ratePerClassIdr: number;
  subtotalIdr: number;
}

interface MiscItemData {
  description: string;
  quantity: number;
  rateIdr: number;
  subtotalIdr: number;
}

function formatIdr(amount: number): string {
  return amount.toLocaleString("id-ID");
}

function formatPeriod(start: string): string {
  const date = new Date(start + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Generate a PDF invoice and return it as a Buffer.
 */
export function generateInvoicePdf(
  invoice: InvoiceData,
  lineItems: LineItemData[],
  miscItems: MiscItemData[] = []
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // ─── Header ──────────────────────────────────────────────────────
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, y + 10);

  // Right side: from entity
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TransforMe Academy", pageWidth - margin, y + 4, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Indonesia", pageWidth - margin, y + 9, { align: "right" });
  doc.text("admin@transforme.academy", pageWidth - margin, y + 14, { align: "right" });

  y += 22;

  // Invoice number and status
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice# ${invoice.invoiceNumber}`, margin, y);

  if (invoice.status === "draft") {
    doc.setTextColor(180, 120, 0);
    doc.text("DRAFT", margin + 60, y);
    doc.setTextColor(0, 0, 0);
  }

  y += 8;

  // Divider line
  doc.setDrawColor(10, 64, 12); // green-700
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── Invoice Details ───────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const genDate = new Date(invoice.generatedAt);
  const dateStr = genDate.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  doc.text("Invoice Date :", margin, y);
  doc.text(dateStr, margin + 30, y);
  doc.text("Bill To", pageWidth / 2 + 20, y);
  y += 5;

  doc.text("Terms :", margin, y);
  doc.text("Due on Receipt", margin + 30, y);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.toEntity, pageWidth / 2 + 20, y);
  doc.setFont("helvetica", "normal");
  y += 5;

  doc.text("Due Date :", margin, y);
  doc.text(dateStr, margin + 30, y);
  y += 5;

  doc.text("Period :", margin, y);
  doc.setFont("helvetica", "bold");
  doc.text(formatPeriod(invoice.periodStart), margin + 30, y);
  doc.setFont("helvetica", "normal");
  y += 10;

  // ─── Table Header ────────────────────────────────────────────────
  const colX = {
    num: margin,
    description: margin + 10,
    qty: pageWidth - margin - 80,
    rate: pageWidth - margin - 50,
    amount: pageWidth - margin,
  };

  doc.setFillColor(245, 245, 240); // sand-50
  doc.rect(margin, y - 4, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("#", colX.num, y);
  doc.text("Item & Description", colX.description, y);
  doc.text("Qty", colX.qty, y, { align: "right" });
  doc.text("Rate (IDR)", colX.rate, y, { align: "right" });
  doc.text("Amount (IDR)", colX.amount, y, { align: "right" });
  y += 8;

  // ─── Class Line Item Rows ─────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  let rowNum = 0;

  lineItems.forEach((item) => {
    if (y > 255) {
      doc.addPage();
      y = margin;
    }

    rowNum++;
    doc.setFont("helvetica", "bold");
    doc.text(String(rowNum), colX.num, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.orphanageName, colX.description, y);
    doc.text(String(item.classCount), colX.qty, y, { align: "right" });
    doc.text(formatIdr(item.ratePerClassIdr), colX.rate, y, { align: "right" });
    doc.text(formatIdr(item.subtotalIdr), colX.amount, y, { align: "right" });
    y += 6;

    // Light divider between rows
    doc.setDrawColor(220, 220, 215);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  });

  // ─── Misc Item Rows ───────────────────────────────────────────────
  miscItems.forEach((item) => {
    if (y > 255) {
      doc.addPage();
      y = margin;
    }

    rowNum++;
    doc.setFont("helvetica", "bold");
    doc.text(String(rowNum), colX.num, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.description, colX.description, y);
    doc.text(String(item.quantity), colX.qty, y, { align: "right" });
    doc.text(formatIdr(item.rateIdr), colX.rate, y, { align: "right" });
    doc.text(formatIdr(item.subtotalIdr), colX.amount, y, { align: "right" });
    y += 6;

    doc.setDrawColor(220, 220, 215);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  });

  // If no items at all
  if (lineItems.length === 0 && miscItems.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.text("No items for this period", margin + 10, y);
    y += 6;
  }

  y += 4;

  // ─── Totals ───────────────────────────────────────────────────────
  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  const totalX = pageWidth - margin - 60;

  doc.setDrawColor(10, 64, 12);
  doc.setLineWidth(0.3);
  doc.line(totalX, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sub Total", totalX, y);
  doc.text(formatIdr(invoice.totalAmountIdr), pageWidth - margin, y, {
    align: "right",
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Total", totalX, y);
  doc.text(`IDR ${formatIdr(invoice.totalAmountIdr)}`, pageWidth - margin, y, {
    align: "right",
  });
  y += 8;

  doc.setFillColor(245, 245, 240);
  doc.rect(totalX - 2, y - 4, pageWidth - margin - totalX + 2, 8, "F");
  doc.setFontSize(10);
  doc.text("Balance Due", totalX, y);
  doc.text(`IDR ${formatIdr(invoice.totalAmountIdr)}`, pageWidth - margin, y, {
    align: "right",
  });

  y += 16;

  // ─── Bank Account Details ─────────────────────────────────────────
  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 64, 12);
  doc.text("Notes", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("Please make the payment payable to", margin, y);
  y += 8;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("BANK ACCOUNT", margin, y);
  y += 5;
  doc.text("BANK CENTRAL ASIA (BCA)", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("BANK CODE: 014", margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("YAYASAN TRANSFORME ACADEMY VOKASI", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("NO ACCOUNT: 7703109057", margin, y);
  y += 5;
  doc.text("SWIFT CODE: CENAIDJA", margin, y);
  y += 12;

  // ─── Terms & Conditions ───────────────────────────────────────────
  if (y > 255) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 64, 12);
  doc.text("Terms & Conditions", margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text("- All payments are in advance.", margin, y);
  y += 4;
  doc.text(
    "- All courses are non-transferable and non-refundable unless covered within the agreement.",
    margin,
    y
  );
  y += 7;

  // ─── Footer ──────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by Meant for Greatness", pageWidth / 2, footerY, {
    align: "center",
  });

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
