import { Orphanage } from "@/types/orphanage";

const orphanages: Orphanage[] = [
  {
    id: "chloe",
    name: "Chloe Orphanage",
    address:
      "Gg. Satriya Buana Jl. Buana Raya No.1x, Padangsambian, Kec. Denpasar Bar., Kota Denpasar, Bali 80351",
    location: "Denpasar, Bali",
    imageUrl: "/images/chloe.jpg",
    studentCount: 18,
    classGroups: [
      { name: "Kids", studentCount: 4, ageRange: "8–9" },
      { name: "Junior", studentCount: 14, ageRange: "10–16" },
    ],
    classesPerWeek: 2,
    description:
      "Chloe Orphanage is home to 18 students receiving beginner English instruction. With a small Kids group and a larger Junior class, students build foundational English skills through consistent, twice-weekly sessions.",
  },
  {
    id: "seeds-of-hope",
    name: "Seeds of Hope Orphanage",
    indonesianName: "Benih Harapan",
    location: "Denpasar, Bali",
    imageUrl: "/images/seeds-of-hope.jpg",
    studentCount: 40,
    classGroups: [
      { name: "Kids I", studentCount: 8, ageRange: "7–9" },
      { name: "Kids II", studentCount: 8, ageRange: "8–10" },
      { name: "Junior Primary I & II", studentCount: 10, ageRange: "10–14" },
      { name: "Young Adult I & II", studentCount: 8, ageRange: "15–18" },
      { name: "Pre-Intermediate", studentCount: 6, ageRange: "16–19" },
    ],
    classesPerWeek: 15,
    hoursPerWeek: 15,
    runningSince: "September 2024",
    description:
      "Our largest program with over 40 students across 5 class levels. Seeds of Hope runs 15 classes per week, Monday through Friday, covering everything from beginner Kids groups to Pre-Intermediate level. This orphanage has been part of our program since the very beginning.",
  },
  {
    id: "sekar-pengharapan",
    name: "Sekar Pengharapan Orphanage",
    address:
      "Jl. Veteran No.3, Buduk, Kec. Mengwi, Kabupaten Badung, Bali 80351",
    location: "Badung, Bali",
    imageUrl: "/images/sekar-pengharapan.jpg",
    studentCount: 26,
    classGroups: [
      { name: "Junior", studentCount: 14, ageRange: "13–15" },
      { name: "Young Adult", studentCount: 12, ageRange: "16–19" },
    ],
    classesPerWeek: 2,
    curriculum: "English for Everyone – Level 2",
    description:
      "Sekar Pengharapan serves 26 students in two focused class groups. Using the structured \"English for Everyone – Level 2\" curriculum, students progress through grammar, vocabulary, and conversation skills in a systematic way.",
  },
  {
    id: "sunya-giri",
    name: "Sunya Giri Orphanage",
    address:
      "Jl. Tunjung Sari No.38, Padangsambian Kaja, Kec. Denpasar Bar., Kota Denpasar, Bali 80117",
    location: "Denpasar, Bali",
    imageUrl: "/images/sunya-giri.jpg",
    studentCount: 18,
    classGroups: [
      { name: "Junior", studentCount: 9, ageRange: "10–17" },
      { name: "Young Adult", studentCount: 9, ageRange: "17–19" },
    ],
    classesPerWeek: 2,
    description:
      "Sunya Giri Orphanage focuses on practical English skills, with vocabulary centered on jobs, occupations, and personal goals. The 18 students learn language they can directly apply to future career opportunities.",
  },
];

export function getAllOrphanages(): Orphanage[] {
  return orphanages;
}

export function getOrphanageById(id: string): Orphanage | undefined {
  return orphanages.find((o) => o.id === id);
}
