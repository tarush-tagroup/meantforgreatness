import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { orphanages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(255),
  indonesianName: z.string().max(255).nullable().optional(),
  address: z.string().nullable().optional(),
  location: z.string().min(1).max(255),
  description: z.string().min(1),
  curriculum: z.string().max(255).nullable().optional(),
  runningSince: z.string().max(50).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  studentCount: z.number().int().min(0),
  classesPerWeek: z.number().int().min(0),
  hoursPerWeek: z.number().int().min(0).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("orphanages:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [orphanage] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (!orphanage) {
    return NextResponse.json({ error: "Orphanage not found" }, { status: 404 });
  }

  return NextResponse.json({ orphanage });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("orphanages:edit");
  if (authError) return authError;

  const { id } = await context.params;

  // Verify orphanage exists
  const [existing] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Orphanage not found" }, { status: 404 });
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

  await db
    .update(orphanages)
    .set({
      name: data.name,
      indonesianName: data.indonesianName ?? null,
      address: data.address ?? null,
      location: data.location,
      description: data.description,
      curriculum: data.curriculum ?? null,
      runningSince: data.runningSince ?? null,
      imageUrl: data.imageUrl ?? existing.imageUrl,
      studentCount: data.studentCount,
      classesPerWeek: data.classesPerWeek,
      hoursPerWeek: data.hoursPerWeek ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orphanages.id, id));

  return NextResponse.json({ success: true });
}
