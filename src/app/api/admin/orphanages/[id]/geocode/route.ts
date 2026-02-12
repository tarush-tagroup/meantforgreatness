import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { orphanages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocode";

const geocodeSchema = z.object({
  address: z.string().min(1, "Address is required"),
});

export async function POST(
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

  const parsed = geocodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const geo = await geocodeAddress(parsed.data.address);
  if (!geo) {
    return NextResponse.json(
      { error: "Could not geocode this address. Try a more specific address including city and country." },
      { status: 422 }
    );
  }

  // Save coordinates to the orphanage
  await db
    .update(orphanages)
    .set({
      address: parsed.data.address,
      latitude: geo.latitude,
      longitude: geo.longitude,
      updatedAt: new Date(),
    })
    .where(eq(orphanages.id, id));

  return NextResponse.json({
    latitude: geo.latitude,
    longitude: geo.longitude,
    displayName: geo.displayName,
  });
}
