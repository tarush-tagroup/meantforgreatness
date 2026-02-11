export interface ClassGroup {
  name: string;
  studentCount: number;
  ageRange: string;
}

export interface Orphanage {
  id: string;
  name: string;
  indonesianName?: string;
  address?: string;
  location: string;
  studentCount: number;
  classGroups: ClassGroup[];
  classesPerWeek: number;
  hoursPerWeek?: number;
  description: string;
  curriculum?: string;
  runningSince?: string;
  imageUrl?: string;
}
