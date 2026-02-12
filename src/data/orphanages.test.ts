import { describe, it, expect } from "vitest";
import { getAllOrphanages, getOrphanageById } from "./orphanages";

describe("orphanages data", () => {
  describe("getAllOrphanages", () => {
    it("returns all 4 orphanages", () => {
      const orphanages = getAllOrphanages();
      expect(orphanages).toHaveLength(4);
    });

    it("returns orphanages with required fields", () => {
      const orphanages = getAllOrphanages();
      for (const orphanage of orphanages) {
        expect(orphanage.id).toBeTruthy();
        expect(orphanage.name).toBeTruthy();
        expect(orphanage.location).toBeTruthy();
        expect(orphanage.studentCount).toBeGreaterThan(0);
        expect(orphanage.classGroups.length).toBeGreaterThan(0);
        expect(orphanage.classesPerWeek).toBeGreaterThan(0);
        expect(orphanage.description).toBeTruthy();
      }
    });

    it("has unique IDs for all orphanages", () => {
      const orphanages = getAllOrphanages();
      const ids = orphanages.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("class group student counts sum correctly", () => {
      const orphanages = getAllOrphanages();
      for (const orphanage of orphanages) {
        const sum = orphanage.classGroups.reduce((acc, g) => acc + g.studentCount, 0);
        expect(sum).toBe(orphanage.studentCount);
      }
    });
  });

  describe("getOrphanageById", () => {
    it("returns correct orphanage for valid ID", () => {
      const orphanage = getOrphanageById("chloe");
      expect(orphanage).toBeDefined();
      expect(orphanage!.name).toBe("Chloe Orphanage");
    });

    it("returns each orphanage by ID", () => {
      const ids = ["chloe", "seeds-of-hope", "sekar-pengharapan", "sunya-giri"];
      for (const id of ids) {
        expect(getOrphanageById(id)).toBeDefined();
      }
    });

    it("returns undefined for unknown ID", () => {
      expect(getOrphanageById("nonexistent")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(getOrphanageById("")).toBeUndefined();
    });
  });
});
