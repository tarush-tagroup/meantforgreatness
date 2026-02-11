import Image from "next/image";

const photos = [
  {
    src: "/images/waterbom-group.jpg",
    alt: "Full group of about 25 kids at Waterbom Bali",
  },
  {
    src: "/images/waterbom-girls.jpg",
    alt: "Three girls with peace signs at Waterbom Bali",
  },
  {
    src: "/images/waterbom-kids.jpg",
    alt: "Group of kids smiling together at Waterbom Bali",
  },
];

export default function EventSection() {
  return (
    <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <h3 className="text-2xl font-bold text-warmgray-900 mb-2">
          Waterbom Bali Outing
        </h3>
        <p className="text-warmgray-600 leading-relaxed mb-6">
          A fun day out at Waterbom water park with kids from Seeds of Hope and
          Chloe Orphanage. These outings give the children a chance to have fun,
          build friendships, and create lasting memories outside the classroom.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.src} className="aspect-video relative rounded-lg overflow-hidden">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
