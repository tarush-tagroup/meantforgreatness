import Image from "next/image";
import { Orphanage } from "@/types/orphanage";

export default function OrphanageSection({
  orphanage,
}: {
  orphanage: Orphanage;
}) {
  return (
    <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden">
      {orphanage.imageUrl && (
        <div className="aspect-video relative">
          <Image
            src={orphanage.imageUrl}
            alt={`Students at ${orphanage.name}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
          />
        </div>
      )}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-warmgray-900">
              {orphanage.name}
            </h2>
            {orphanage.indonesianName && (
              <p className="text-warmgray-500 text-sm mt-1">
                ({orphanage.indonesianName})
              </p>
            )}
            <p className="text-warmgray-500 text-sm mt-1">
              {orphanage.location}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700 border border-teal-200">
              {orphanage.studentCount} students
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 border border-amber-200">
              {orphanage.classesPerWeek}x/week
            </span>
          </div>
        </div>

        {orphanage.address && (
          <p className="text-sm text-warmgray-500 mb-4">
            <span className="font-medium text-warmgray-600">Address:</span>{" "}
            {orphanage.address}
          </p>
        )}

        <p className="text-warmgray-600 leading-relaxed mb-6">
          {orphanage.description}
        </p>

        {orphanage.curriculum && (
          <p className="text-sm text-warmgray-500 mb-6">
            <span className="font-medium text-warmgray-600">Curriculum:</span>{" "}
            {orphanage.curriculum}
          </p>
        )}

        {orphanage.runningSince && (
          <p className="text-sm text-warmgray-500 mb-6">
            <span className="font-medium text-warmgray-600">
              Running since:
            </span>{" "}
            {orphanage.runningSince}
          </p>
        )}

        {orphanage.hoursPerWeek && (
          <p className="text-sm text-warmgray-500 mb-6">
            <span className="font-medium text-warmgray-600">
              Total hours per week:
            </span>{" "}
            {orphanage.hoursPerWeek}
          </p>
        )}

        <div>
          <h3 className="font-semibold text-warmgray-800 mb-3">
            Class Groups
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orphanage.classGroups.map((group) => (
              <div
                key={group.name}
                className="rounded-lg bg-warmgray-50 p-4 border border-warmgray-100"
              >
                <div className="font-medium text-warmgray-800">
                  {group.name}
                </div>
                <div className="text-sm text-warmgray-500 mt-1">
                  {group.studentCount} students &middot; Ages {group.ageRange}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
