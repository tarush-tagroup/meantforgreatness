/**
 * One-time script: Remove class group assignments from inactive kids.
 * Run with: node --env-file=.env.local scripts/fix-inactive-kids-classgroup.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const inactive = await sql`
  SELECT id, name, class_group_id
  FROM kids
  WHERE status = 'inactive' AND class_group_id IS NOT NULL
`;

if (inactive.length === 0) {
  console.log("No inactive kids with class group assignments found.");
  process.exit(0);
}

console.log(`Found ${inactive.length} inactive kid(s) with class groups:`);
for (const kid of inactive) {
  console.log(`  - ${kid.name} (${kid.id}) → clearing class_group_id ${kid.class_group_id}`);
}

await sql`
  UPDATE kids
  SET class_group_id = NULL, updated_at = NOW()
  WHERE status = 'inactive' AND class_group_id IS NOT NULL
`;

console.log("Done. Cleared class group assignments for all inactive kids.");
