import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { kids, orphanages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  const [, authError] = await withAuth("kids:view");
  if (authError) return authError;

  const rows = await db.select().from(kids).orderBy(asc(kids.name));

  return NextResponse.json({ kids: rows });
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  age: z.number().int().min(0, "Age must be positive").max(30),
  hobby: z.string().max(500).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  about: z.string().nullable().optional(),
  favoriteWord: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  orphanageId: z.string().min(1, "Orphanage is required").max(50),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

export async function POST(req: NextRequest) {
  const [, authError] = await withAuth("kids:edit");
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

  let id = slugify(data.name);
  if (!id) id = "kid";

  const [existing] = await db
    .select({ id: kids.id })
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (existing) {
    id = `${id.substring(0, 40)}-${Date.now().toString(36)}`;
  }

  await db.insert(kids).values({
    id,
    name: data.name,
    age: data.age,
    hobby: data.hobby ?? null,
    location: data.location ?? null,
    about: data.about ?? null,
    favoriteWord: data.favoriteWord ?? null,
    imageUrl: data.imageUrl ?? null,
    orphanageId: data.orphanageId,
  });

  return NextResponse.json({ id, success: true }, { status: 201 });
}
