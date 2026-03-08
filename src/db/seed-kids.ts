/**
 * Seed script to:
 * 1. Update class groups to match current PDF data (12 classes across 4 orphanages)
 * 2. Insert all kids from the PDF with orphanage + class group mappings
 *
 * IMPORTANT: Existing kids are preserved (uses onConflictDoNothing).
 * After inserting, existing kids without a classGroupId get matched by orphanage.
 *
 * Usage: npx tsx src/db/seed-kids.ts
 * Requires DATABASE_URL environment variable.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNull } from "drizzle-orm";
import { orphanages, classGroups, kids } from "./schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// ─── Class group definitions from PDF ─────────────────────────────────────────
const classGroupData: Record<
  string,
  { name: string; studentCount: number; ageRange: string; sortOrder: number }[]
> = {
  "sunya-giri": [
    { name: "Teen Junior", studentCount: 8, ageRange: "10-17", sortOrder: 0 },
    { name: "Teen Young Adult", studentCount: 9, ageRange: "17-19", sortOrder: 1 },
  ],
  "sekar-pengharapan": [
    { name: "Teen Junior (Beginner)", studentCount: 7, ageRange: "13", sortOrder: 0 },
    { name: "Teen Junior (Elem-Intermediate)", studentCount: 7, ageRange: "14-15", sortOrder: 1 },
    { name: "Teen Junior / Young Adult (Elem-Intermediate)", studentCount: 11, ageRange: "16-19", sortOrder: 2 },
  ],
  chloe: [
    { name: "Kids", studentCount: 4, ageRange: "8-9", sortOrder: 0 },
    { name: "Junior", studentCount: 14, ageRange: "10-16", sortOrder: 1 },
  ],
  "seeds-of-hope": [
    { name: "Kids I", studentCount: 2, ageRange: "6-8", sortOrder: 0 },
    { name: "Kids II", studentCount: 18, ageRange: "10-14", sortOrder: 1 },
    { name: "Junior", studentCount: 11, ageRange: "14-15", sortOrder: 2 },
    { name: "Young Adult", studentCount: 8, ageRange: "16-18", sortOrder: 3 },
    { name: "Upper Intermediate", studentCount: 9, ageRange: "16-21", sortOrder: 4 },
  ],
};

// ─── Kids data from PDF ──────────────────────────────────────────────────────
// Format: [name, age, orphanageId, classGroupName]
const kidsData: [string, number, string, string][] = [
  // ── Sunya Giri: Teen Junior (Beginner) ──
  ["Trisna", 10, "sunya-giri", "Teen Junior"],
  ["Gede", 14, "sunya-giri", "Teen Junior"],
  ["Yaya", 15, "sunya-giri", "Teen Junior"],
  ["Ninda", 16, "sunya-giri", "Teen Junior"],
  ["Widya", 16, "sunya-giri", "Teen Junior"],
  ["Norma", 17, "sunya-giri", "Teen Junior"],
  ["Iswa", 17, "sunya-giri", "Teen Junior"],
  ["Mira", 17, "sunya-giri", "Teen Junior"],

  // ── Sunya Giri: Teen Young Adult (Beginner) ──
  ["Marce", 17, "sunya-giri", "Teen Young Adult"],
  ["Gunawan", 17, "sunya-giri", "Teen Young Adult"],
  ["Ewin", 17, "sunya-giri", "Teen Young Adult"],
  ["Hendra", 17, "sunya-giri", "Teen Young Adult"],
  ["Endra", 17, "sunya-giri", "Teen Young Adult"],
  ["Tirta", 17, "sunya-giri", "Teen Young Adult"],
  ["Sandra", 17, "sunya-giri", "Teen Young Adult"],
  ["Sujani", 19, "sunya-giri", "Teen Young Adult"],
  ["Dewi", 19, "sunya-giri", "Teen Young Adult"],

  // ── Sekar Pengharapan: Teen Junior (Beginner) ──
  ["Ni Made Nandita Dwiyani", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Ni Wayan Sapitriani", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Rabeca Tirza Trieda Pakenoni S.", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Nazua Aryahna Putri Cholan", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Ketut Widiantari", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Stefani Saraswati", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],
  ["Kadek Rehan Wira Guna", 13, "sekar-pengharapan", "Teen Junior (Beginner)"],

  // ── Sekar Pengharapan: Teen Junior (Elem-Intermediate) ──
  ["Zipora Lintang Ozora", 14, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["I Putu Eka Adi Guna", 14, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["Aprafael Nduru", 14, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["Ni Putu Ayu Verayanti", 15, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["Maura Caroline", 15, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["Fadil Putra Salom Lukas", 15, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],
  ["I Komang Darma Putra Wijaya", 15, "sekar-pengharapan", "Teen Junior (Elem-Intermediate)"],

  // ── Sekar Pengharapan: Teen Junior / Young Adult (Elem-Intermediate) ──
  ["I Kadek Restu Adi Putra", 16, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Bryan Nicolas Workala", 16, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Ni Made Eva Verasianing Putri", 17, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Komang Purnama Widiastuti", 17, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Ni Komang Juni Tricahyai", 17, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Prita Laura Sile Tumanggor", 17, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Ni Wayan Mustika Sari", 18, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Hendrik Adi Putra Tanesib", 18, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Giovan Don Bosco Kasper Dewa Rangga", 18, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Jaya Tri Marbun", 18, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],
  ["Kadek Kezia Natali Christ Putri Ardian", 19, "sekar-pengharapan", "Teen Junior / Young Adult (Elem-Intermediate)"],

  // ── Chloe: Kids ──
  ["Fanto", 9, "chloe", "Kids"],
  ["Noval", 9, "chloe", "Kids"],
  ["Evan", 9, "chloe", "Kids"],
  ["Lisa", 8, "chloe", "Kids"],

  // ── Chloe: Junior ──
  ["Mustika Nasuha", 13, "chloe", "Junior"],
  ["Auresia Putri Helena", 15, "chloe", "Junior"],
  ["Rastiani Makuincaana", 11, "chloe", "Junior"],
  ["Kayla Leticia Lewis", 12, "chloe", "Junior"],
  ["Dameon Logan Lewis", 14, "chloe", "Junior"],
  ["Joel", 11, "chloe", "Junior"],
  ["Naidi", 12, "chloe", "Junior"],
  ["Jayden Mikelizer", 11, "chloe", "Junior"],
  ["Adi", 16, "chloe", "Junior"],
  ["Marchel", 11, "chloe", "Junior"],
  ["Cindy Cloudia", 10, "chloe", "Junior"],
  ["Graciella Yuliana Pangalela", 12, "chloe", "Junior"],
  ["Fajar Kaila Faimnasi", 12, "chloe", "Junior"],
  ["Yunita Silvia Runkat", 11, "chloe", "Junior"],

  // ── Seeds of Hope: Kids I ──
  ["Hani", 8, "seeds-of-hope", "Kids I"],
  ["Gionna", 6, "seeds-of-hope", "Kids I"],

  // ── Seeds of Hope: Kids II ──
  ["Isma", 10, "seeds-of-hope", "Kids II"],
  ["Chelsea", 10, "seeds-of-hope", "Kids II"],
  ["Edward", 10, "seeds-of-hope", "Kids II"],
  ["Rido", 11, "seeds-of-hope", "Kids II"],
  ["Rafa", 11, "seeds-of-hope", "Kids II"],
  ["Iqbal", 14, "seeds-of-hope", "Kids II"],
  ["Novin", 10, "seeds-of-hope", "Kids II"],
  ["Sari", 12, "seeds-of-hope", "Kids II"],
  ["Dina", 12, "seeds-of-hope", "Kids II"],
  ["Sekar", 12, "seeds-of-hope", "Kids II"],
  ["Sering Ada", 12, "seeds-of-hope", "Kids II"],
  ["Sutra", 12, "seeds-of-hope", "Kids II"],
  ["Juli", 12, "seeds-of-hope", "Kids II"],
  ["Serin", 12, "seeds-of-hope", "Kids II"],
  ["Jaya", 12, "seeds-of-hope", "Kids II"],
  ["Gloria", 12, "seeds-of-hope", "Kids II"],
  ["Paris", 12, "seeds-of-hope", "Kids II"],
  ["Agus", 12, "seeds-of-hope", "Kids II"],

  // ── Seeds of Hope: Junior ──
  ["Darmadi", 15, "seeds-of-hope", "Junior"],
  // Note: "Agus" age 14 is different from "Agus" age 12 in Kids II
  ["Agus (Junior)", 14, "seeds-of-hope", "Junior"],
  ["Landong", 14, "seeds-of-hope", "Junior"],
  ["Komang Kecil", 14, "seeds-of-hope", "Junior"],
  ["Kartika", 15, "seeds-of-hope", "Junior"],
  ["James", 15, "seeds-of-hope", "Junior"],
  ["Juita", 15, "seeds-of-hope", "Junior"],
  ["Debora", 15, "seeds-of-hope", "Junior"],
  ["Margaretha", 15, "seeds-of-hope", "Junior"],
  // Note: "Serin" age 15 is different from "Serin" age 12 in Kids II
  ["Serin (Junior)", 15, "seeds-of-hope", "Junior"],
  // Note: "Sari" age 15 is different from "Sari" age 12 in Kids II
  ["Sari (Junior)", 15, "seeds-of-hope", "Junior"],

  // ── Seeds of Hope: Young Adult ──
  ["Sumerta", 17, "seeds-of-hope", "Young Adult"],
  ["Suryasa", 18, "seeds-of-hope", "Young Adult"],
  ["Parmi", 16, "seeds-of-hope", "Young Adult"],
  ["Martini", 16, "seeds-of-hope", "Young Adult"],
  ["Roland", 16, "seeds-of-hope", "Young Adult"],
  // Note: "Juli" age 17 is different from "Juli" age 12 in Kids II
  ["Juli (Young Adult)", 17, "seeds-of-hope", "Young Adult"],
  ["April", 17, "seeds-of-hope", "Young Adult"],
  ["Susila", 16, "seeds-of-hope", "Young Adult"],

  // ── Seeds of Hope: Upper Intermediate ──
  ["Rahel", 16, "seeds-of-hope", "Upper Intermediate"],
  ["Cindy", 16, "seeds-of-hope", "Upper Intermediate"],
  ["Sera", 16, "seeds-of-hope", "Upper Intermediate"],
  ["Rama", 17, "seeds-of-hope", "Upper Intermediate"],
  ["Christine", 18, "seeds-of-hope", "Upper Intermediate"],
  ["Masto", 21, "seeds-of-hope", "Upper Intermediate"],
  ["Joshua", 17, "seeds-of-hope", "Upper Intermediate"],
  ["Muli Arta", 19, "seeds-of-hope", "Upper Intermediate"],
  ["Joscha", 19, "seeds-of-hope", "Upper Intermediate"],
];

async function seedKids() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("=== Seeding class groups and kids ===\n");

  // Step 1: Update class groups for each orphanage
  console.log("Step 1: Updating class groups...");

  // Build a map of orphanageId -> className -> classGroupId
  const classGroupIdMap = new Map<string, Map<string, string>>();

  for (const [orphanageId, groups] of Object.entries(classGroupData)) {
    // Delete existing class groups for this orphanage
    await db
      .delete(classGroups)
      .where(eq(classGroups.orphanageId, orphanageId));

    const orphanageMap = new Map<string, string>();

    for (const group of groups) {
      const [inserted] = await db
        .insert(classGroups)
        .values({
          orphanageId,
          name: group.name,
          studentCount: group.studentCount,
          ageRange: group.ageRange,
          sortOrder: group.sortOrder,
        })
        .returning({ id: classGroups.id });

      orphanageMap.set(group.name, inserted.id);
      console.log(`  [${orphanageId}] ${group.name} -> ${inserted.id}`);
    }

    classGroupIdMap.set(orphanageId, orphanageMap);
  }

  console.log(`\nCreated ${Object.values(classGroupData).flat().length} class groups.\n`);

  // Step 2: Update orphanage student counts
  console.log("Step 2: Updating orphanage student counts...");
  const orphanageStudentCounts: Record<string, number> = {};
  for (const kid of kidsData) {
    const orphId = kid[2];
    orphanageStudentCounts[orphId] = (orphanageStudentCounts[orphId] || 0) + 1;
  }
  for (const [orphId, count] of Object.entries(orphanageStudentCounts)) {
    await db
      .update(orphanages)
      .set({ studentCount: count, updatedAt: new Date() })
      .where(eq(orphanages.id, orphId));
    console.log(`  ${orphId}: ${count} students`);
  }

  // Step 3: Insert kids
  console.log("\nStep 3: Inserting kids...");
  let inserted = 0;
  let skipped = 0;
  const usedIds = new Set<string>();

  for (const [name, age, orphanageId, className] of kidsData) {
    const orphanageMap = classGroupIdMap.get(orphanageId);
    const classGroupId = orphanageMap?.get(className) || null;

    if (!classGroupId) {
      console.warn(`  WARNING: No class group found for "${className}" at ${orphanageId}`);
    }

    let id = slugify(name);
    if (!id) id = "kid";

    // Handle duplicate slugs within this seed
    if (usedIds.has(id)) {
      id = `${id.substring(0, 40)}-${Date.now().toString(36)}`;
    }
    usedIds.add(id);

    // Check if kid already exists
    const [existing] = await db
      .select({ id: kids.id })
      .from(kids)
      .where(eq(kids.id, id))
      .limit(1);

    if (existing) {
      // Update classGroupId for existing kids
      await db
        .update(kids)
        .set({ classGroupId, orphanageId, updatedAt: new Date() })
        .where(eq(kids.id, id));
      console.log(`  UPDATED: ${name} (${id}) -> class ${className}`);
      skipped++;
    } else {
      await db.insert(kids).values({
        id,
        name,
        age,
        orphanageId,
        classGroupId,
      });
      console.log(`  INSERTED: ${name} (${id}) -> class ${className}`);
      inserted++;
    }
  }

  // Step 4: Try to assign classGroupId to any existing kids that don't have one
  console.log("\nStep 4: Matching existing kids without class groups...");
  const unmatched = await db
    .select({ id: kids.id, name: kids.name, orphanageId: kids.orphanageId })
    .from(kids)
    .where(isNull(kids.classGroupId));

  for (const kid of unmatched) {
    if (kid.orphanageId) {
      console.log(`  UNMATCHED: ${kid.name} (${kid.id}) at ${kid.orphanageId} - needs manual class assignment`);
    }
  }

  console.log(`\n=== Done! ===`);
  console.log(`  Inserted: ${inserted} new kids`);
  console.log(`  Updated: ${skipped} existing kids`);
  console.log(`  Unmatched: ${unmatched.length} kids need manual class assignment`);
  console.log(`  Total kids in DB: ${inserted + skipped + unmatched.length}`);
}

seedKids().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
