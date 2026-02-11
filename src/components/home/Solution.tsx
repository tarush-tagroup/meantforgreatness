export default function Solution() {
  const features = [
    {
      title: "3x Per Week",
      description:
        "Consistent, regular classes that build real fluency over time — not one-off sessions.",
    },
    {
      title: "Small Groups",
      description:
        "Under 10 kids per class so every child gets attention, practice time, and feedback.",
    },
    {
      title: "Real Accountability",
      description:
        "Structured curriculum with progress tracking to make sure kids are actually learning.",
    },
    {
      title: "Multiple Levels",
      description:
        "Kids, Junior, Young Adult, and Pre-Intermediate classes so every child learns at their level.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-warmgray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-6">
            What We Do
          </h2>
          <p className="text-lg text-warmgray-600 leading-relaxed">
            We organize English classes for orphan kids across Bali — structured,
            consistent, and designed to produce real results.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-white p-6 shadow-sm border border-warmgray-200"
            >
              <h3 className="text-lg font-semibold text-teal-700 mb-3">
                {feature.title}
              </h3>
              <p className="text-warmgray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
