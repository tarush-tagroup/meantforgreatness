/**
 * Seed script to initialize the database with:
 * 1. The initial admin user
 * 2. Orphanage data migrated from hardcoded src/data/orphanages.ts
 *
 * Usage: npx tsx src/db/seed.ts
 *
 * Requires DATABASE_URL environment variable.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, orphanages, classGroups } from "./schema";

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding database...");

  // 1. Seed initial admin user
  console.log("Creating initial admin user...");
  await db
    .insert(users)
    .values({
      email: "tarush.aggarwal@gmail.com",
      name: "Tarush Aggarwal",
      roles: ["admin"],
      status: "active",
      activatedAt: new Date(),
    })
    .onConflictDoNothing();

  // 2. Seed orphanages (migrated from src/data/orphanages.ts)
  console.log("Seeding orphanages...");

  const orphanageData = [
    {
      id: "chloe",
      name: "Chloe Orphanage",
      address:
        "Gg. Satriya Buana Jl. Buana Raya No.1x, Padangsambian, Kec. Denpasar Bar., Kota Denpasar, Bali 80351",
      location: "Denpasar, Bali",
      imageUrl: "/images/chloe.jpg",
      studentCount: 20,
      classesPerWeek: 4,
      description:
        "Chloe Orphanage is home to 20 students receiving beginner English instruction. With a small Kids group and a larger Junior class, students build foundational English skills through consistent, twice-weekly sessions.",
      classGroupsData: [
        { name: "Kids", studentCount: 4, ageRange: "8-9", sortOrder: 0 },
        { name: "Junior", studentCount: 14, ageRange: "10-16", sortOrder: 1 },
      ],
    },
    {
      id: "seeds-of-hope",
      name: "Seeds of Hope Orphanage",
      indonesianName: "Benih Harapan",
      location: "Denpasar, Bali",
      imageUrl: "/images/seeds-of-hope.jpg",
      studentCount: 46,
      classesPerWeek: 15,
      hoursPerWeek: 15,
      runningSince: "September 2024",
      description:
        "Our largest program with over 40 students across 5 class levels. Seeds of Hope runs 15 classes per week, Monday through Friday, covering everything from beginner Kids groups to Pre-Intermediate level. This orphanage has been part of our program since the very beginning.",
      classGroupsData: [
        { name: "Kids I", studentCount: 8, ageRange: "7-9", sortOrder: 0 },
        { name: "Kids II", studentCount: 8, ageRange: "8-10", sortOrder: 1 },
        {
          name: "Junior Primary I & II",
          studentCount: 10,
          ageRange: "10-14",
          sortOrder: 2,
        },
        {
          name: "Young Adult I & II",
          studentCount: 8,
          ageRange: "15-18",
          sortOrder: 3,
        },
        {
          name: "Pre-Intermediate",
          studentCount: 6,
          ageRange: "16-19",
          sortOrder: 4,
        },
      ],
    },
    {
      id: "sekar-pengharapan",
      name: "Sekar Pengharapan Orphanage",
      address:
        "Jl. Veteran No.3, Buduk, Kec. Mengwi, Kabupaten Badung, Bali 80351",
      location: "Badung, Bali",
      imageUrl: "/images/sekar-pengharapan.jpg",
      studentCount: 26,
      classesPerWeek: 4,
      curriculum: "English for Everyone - Level 2",
      description:
        'Sekar Pengharapan serves 26 students in two focused class groups. Using the structured "English for Everyone - Level 2" curriculum, students progress through grammar, vocabulary, and conversation skills in a systematic way.',
      classGroupsData: [
        { name: "Junior", studentCount: 14, ageRange: "13-15", sortOrder: 0 },
        {
          name: "Young Adult",
          studentCount: 12,
          ageRange: "16-19",
          sortOrder: 1,
        },
      ],
    },
    {
      id: "sunya-giri",
      name: "Sunya Giri Orphanage",
      address:
        "Jl. Tunjung Sari No.38, Padangsambian Kaja, Kec. Denpasar Bar., Kota Denpasar, Bali 80117",
      location: "Denpasar, Bali",
      imageUrl: "/images/sunya-giri.jpg",
      studentCount: 17,
      classesPerWeek: 6,
      description:
        "Sunya Giri Orphanage focuses on practical English skills, with vocabulary centered on jobs, occupations, and personal goals. The 17 students learn language they can directly apply to future career opportunities.",
      classGroupsData: [
        { name: "Junior", studentCount: 9, ageRange: "10-17", sortOrder: 0 },
        {
          name: "Young Adult",
          studentCount: 9,
          ageRange: "17-19",
          sortOrder: 1,
        },
      ],
    },
  ];

  for (const orphanage of orphanageData) {
    const { classGroupsData, ...orphanageFields } = orphanage;

    await db
      .insert(orphanages)
      .values(orphanageFields)
      .onConflictDoNothing();

    for (const group of classGroupsData) {
      await db
        .insert(classGroups)
        .values({
          orphanageId: orphanage.id,
          ...group,
        })
        .onConflictDoNothing();
    }
  }

  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
