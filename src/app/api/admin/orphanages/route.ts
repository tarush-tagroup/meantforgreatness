import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { orphanages, classGroups } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocode";

export async function GET() {
  const [, authError] = await withAuth("orphanages:view");
  if (authError) return authError;

  const rows = await db.select().from(orphanages).orderBy(asc(orphanages.name));

  const groups = await db
    .select()
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  const groupsByOrphanage = new Map<string, typeof groups>();
  for (const g of groups) {
    const list = groupsByOrphanage.get(g.orphanageId) || [];
    list.push(g);
    groupsByOrphanage.set(g.orphanageId, list);
  }

  const result = rows.map((row) => ({
    ...row,
    classGroups: groupsByOrphanage.get(row.id) || [],
  }));

  return NextResponse.json({ orphanages: result });
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  indonesianName: z.string().max(255).nullable().optional(),
  address: z.string().nullable().optional(),
  location: z.string().min(1, "Location is required").max(255),
  description: z.string().min(1, "Description is required"),
  curriculum: z.string().max(255).nullable().optional(),
  runningSince: z.string().max(50).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  studentCount: z.number().int().min(0).default(0),
  classesPerWeek: z.number().int().min(0).default(0),
  hoursPerWeek: z.number().int().min(0).nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
});

/**
 * Generate a URL-friendly slug from a name.
 * e.g. "Bali Children's Home" → "bali-childrens-home"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .substring(0, 50); // Max 50 chars (matches varchar(50))
}

export async function POST(req: NextRequest) {
  const [, authError] = await withAuth("orphanages:edit");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Generate a unique slug-based ID
  let id = slugify(data.name);
  if (!id) id = "orphanage";

  // Check for ID conflicts and append a number if needed
  const [existing] = await db
    .select({ id: orphanages.id })
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (existing) {
    // Append a timestamp suffix to make it unique
    id = `${id.substring(0, 40)}-${Date.now().toString(36)}`;
  }

  // Auto-geocode if address is provided
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (data.address) {
    const geo = await geocodeAddress(data.address);
    if (geo) {
      latitude = geo.latitude;
      longitude = geo.longitude;
    }
  }

  await db.insert(orphanages).values({
    id,
    name: data.name,
    indonesianName: data.indonesianName ?? null,
    address: data.address ?? null,
    location: data.location,
    description: data.description,
    curriculum: data.curriculum ?? null,
    runningSince: data.runningSince ?? null,
    imageUrl: data.imageUrl ?? null,
    studentCount: data.studentCount,
    classesPerWeek: data.classesPerWeek,
    hoursPerWeek: data.hoursPerWeek ?? null,
    websiteUrl: data.websiteUrl ?? null,
    latitude,
    longitude,
  });

  return NextResponse.json({ id, success: true }, { status: 201 });
}
