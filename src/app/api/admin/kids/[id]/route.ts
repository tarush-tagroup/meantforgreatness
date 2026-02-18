import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { kids, orphanages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(255),
  age: z.number().int().min(0).max(30),
  hobby: z.string().max(500).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  about: z.string().nullable().optional(),
  favoriteWord: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  orphanageId: z.string().min(1, "Orphanage is required").max(50),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("kids:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [kid] = await db
    .select()
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!kid) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  return NextResponse.json({ kid });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("kids:edit");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate orphanageId
  {
    const [orphanage] = await db
      .select({ id: orphanages.id })
      .from(orphanages)
      .where(eq(orphanages.id, data.orphanageId))
      .limit(1);
    if (!orphanage) {
      return NextResponse.json(
        { error: "Orphanage not found" },
        { status: 400 }
      );
    }
  }

  await db
    .update(kids)
    .set({
      name: data.name,
      age: data.age,
      hobby: data.hobby ?? null,
      location: data.location ?? null,
      about: data.about ?? null,
      favoriteWord: data.favoriteWord ?? null,
      imageUrl: data.imageUrl ?? existing.imageUrl,
      orphanageId: data.orphanageId,
      updatedAt: new Date(),
    })
    .where(eq(kids.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("kids:edit");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select({ id: kids.id })
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  await db.delete(kids).where(eq(kids.id, id));

  return NextResponse.json({ success: true });
}
