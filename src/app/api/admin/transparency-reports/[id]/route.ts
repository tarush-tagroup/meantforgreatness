import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { transparencyReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("transparency:view");
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

  return NextResponse.json({ report });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("transparency:generate");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(transparencyReports)
    .where(eq(transparencyReports.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (existing.published) {
    return NextResponse.json(
      { error: "Cannot edit a published report" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title) updateFields.title = parsed.data.title;
  if (parsed.data.content !== undefined) updateFields.content = parsed.data.content;

  await db
    .update(transparencyReports)
    .set(updateFields)
    .where(eq(transparencyReports.id, id));

  return NextResponse.json({ success: true });
}
