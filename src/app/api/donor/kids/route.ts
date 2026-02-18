import { NextResponse } from "next/server";
import { db } from "@/db";
import { kids } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getDonorFromCookie } from "@/lib/donor-auth";

export async function GET() {
  // Require donor authentication
  const donor = await getDonorFromCookie();
  if (!donor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: kids.id,
      name: kids.name,
      age: kids.age,
      hobby: kids.hobby,
      location: kids.location,
      about: kids.about,
      favoriteWord: kids.favoriteWord,
      imageUrl: kids.imageUrl,
    })
    .from(kids)
    .orderBy(asc(kids.name));

  return NextResponse.json({ kids: rows });
}
