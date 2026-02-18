import Image from "next/image";

export default function Solution() {
  const features = [
    {
      title: "3x Per Week",
      description:
        "Language fluency requires consistency. Our kids get 3 classes every week — the kind of frequency that takes them from zero English to real conversations within 12-18 months.",
    },
    {
      title: "Small Groups (3-15 Kids)",
      description:
        "Every child speaks, practices, and gets feedback — not just listens. Small groups mean real participation and real progress.",
    },
    {
      title: "Structured Curriculum",
      description:
        "Progress tracking, level assessments, and class logs ensure kids are actually learning — not just attending. Donors see results through quarterly transparency reports.",
    },
    {
      title: "Every Level Covered",
      description:
        "From phonics for 6-year-olds to conversational English for teens preparing for jobs. Multiple class levels mean every child learns at their pace.",
    },
  ];

  const careerPaths = [
    {
      icon: "🏨",
      title: "Tourism & Hospitality",
      description:
        "Hotel receptionists earn $600/mo. Tour guides earn $600+/mo. Waiters at tourist restaurants earn $840/mo with tips. These jobs all require English.",
    },
    {
      icon: "💼",
      title: "International Business",
      description:
        "Export companies, foreign NGOs, and Bali's growing expat economy all need English speakers.",
    },
    {
      icon: "🎓",
      title: "Higher Education",
      description:
        "English-medium university programs and international scholarships open up with fluency.",
    },
    {
      icon: "💻",
      title: "Digital Economy",
      description:
        "Freelance translation, remote customer support, content writing — $2,400-4,000/mo working from Bali for international clients.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-sand-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-6">
            How We Uplevel These Kids
          </h2>
          <p className="text-lg text-sand-600 leading-relaxed">
            We fund structured, consistent English classes at orphanages across
            Bali — delivered by professional teachers who visit orphanages every
            afternoon. Here&apos;s what makes our program different:
          </p>
        </div>

        <div className="mx-auto max-w-4xl mb-12">
          <Image
            src="/images/classroom.jpg"
            alt="English class in session at an orphanage in Bali"
            width={1200}
            height={800}
            className="rounded-xl w-full h-auto"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-white p-6 shadow-sm border border-sand-200"
            >
              <h3 className="text-lg font-semibold text-green-700 mb-3">
                {feature.title}
              </h3>
              <p className="text-sand-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Where English Takes Them */}
        <div className="mx-auto max-w-3xl text-center mb-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-sand-900 mb-4">
            Where English Takes Them
          </h3>
          <p className="text-sand-600 leading-relaxed">
            Tourism makes up 75-80% of Bali&apos;s GDP. English is the gateway
            to every high-paying career on the island.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {careerPaths.map((path) => (
            <div
              key={path.title}
              className="rounded-xl bg-white p-6 shadow-sm border border-sand-200"
            >
              <div className="text-2xl mb-3">{path.icon}</div>
              <h4 className="text-base font-semibold text-sand-900 mb-2">
                {path.title}
              </h4>
              <p className="text-sand-600 text-sm leading-relaxed">
                {path.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
