import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { transparencyReports } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("transparency:publish");
  if (authError) return authError;

  const { id } = await context.params;

  const [report] = await db
    .select()
    .from(transparencyReports)
    .where(eq(transparencyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.published) {
    return NextResponse.json(
      { error: "Report is already published" },
      { status: 400 }
    );
  }

  await db
    .update(transparencyReports)
    .set({
      published: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(transparencyReports.id, id));

  return NextResponse.json({ success: true });
}
