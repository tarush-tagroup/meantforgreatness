import Image from "next/image";

const highlights = [
  {
    title: "Experienced Teachers",
    description:
      "A dedicated team led by Head Teacher Leonika, with structured lesson plans for reading groups (ages 6\u20138) and beginner English (ages 10\u201313). The same quality delivered to hundreds of paying students worldwide.",
  },
  {
    title: "Daily Commitment",
    description:
      "Teachers visit orphanages almost every afternoon \u2014 not once a week, not once a month. This consistency takes children from zero English to holding real conversations with foreign visitors.",
  },
  {
    title: "More Than Textbooks",
    description:
      "Classes include reading, singing, art projects, craft activities, and visits from foreign volunteer sub-teachers. Learning English becomes something the kids look forward to, not a chore.",
  },
];

export default function Partnership() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* A) Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-4">
            Our Teaching Partner
          </h2>
          <p className="text-lg text-sand-600 leading-relaxed">
            Every class we fund is delivered by Bahasa Bule &mdash; an
            established Bali-based language school whose teachers visit
            orphanages almost every afternoon to teach English, fully funded.
          </p>
        </div>

        {/* B) Two-Column Feature: Photo + Story Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-14">
          <div className="overflow-hidden rounded-xl">
            <Image
              src="/images/seeds-of-hope.jpg"
              alt="Teacher working with children at Seeds of Hope orphanage in Bali"
              width={1200}
              height={800}
              className="w-full h-auto"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div className="rounded-xl bg-green-50 border border-green-200 p-8 sm:p-10">
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">
              Founded 2021 in Bali
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-4">
              Bahasa Bule &amp; TransforMe Academy
            </h3>
            <p className="text-sand-700 leading-relaxed mb-4">
              <span className="font-semibold">Bahasa Bule</span> is an
              established language institute in Bali with hundreds of learners
              from around the world. Their programs span General English,
              Hospitality English, Indonesian for Expats, and IELTS Prep
              &mdash; all taught through structured courses with clear levels
              and custom materials.
            </p>
            <p className="text-sand-700 leading-relaxed mb-4">
              Through{" "}
              <span className="font-semibold">TransforMe Academy</span>, their
              social impact arm, Bahasa Bule provides fully funded English
              lessons to children across multiple orphanages in Bali. Their
              experienced teachers &mdash; led by Head Teacher Leonika &mdash;
              visit orphanages almost every afternoon, teaching everything from
              phonics basics to conversational English.
            </p>
            <p className="text-sand-700 leading-relaxed">
              We partner with TransforMe Academy to deliver every class we fund.
              Their teaching expertise and deep relationships with orphanage
              communities, combined with our mission to reach every orphanage in
              Bali, means donations go directly to proven, high-quality
              education.
            </p>
          </div>
        </div>

        {/* C) Three Highlight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-xl bg-white p-6 shadow-sm border border-sand-200"
            >
              <h3 className="text-lg font-semibold text-green-700 mb-3">
                {item.title}
              </h3>
              <p className="text-sand-600 text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* D) Teacher Quote */}
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl bg-sand-50 border border-sand-200 p-8 sm:p-10 text-center">
            <blockquote className="text-lg sm:text-xl text-sand-700 leading-relaxed italic">
              &ldquo;No matter how much I teach them, it always feels like
              it&apos;s nothing compared to what these kids have taught me. They
              teach me gratitude, sincerity, and most importantly, how to find
              wonder and magic in the small, ordinary parts of life.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm font-semibold text-sand-500">
              &mdash; Leonika, Head Teacher at Bahasa Bule
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
