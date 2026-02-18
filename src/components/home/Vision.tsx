const goals = [
  {
    stat: "250",
    label: "Kids",
    description:
      "Grow from our current reach to 250 children receiving regular English classes across Bali.",
  },
  {
    stat: "10",
    label: "Orphanages",
    description:
      "Expand to 10 partner orphanages, bringing structured English education to more communities.",
  },
  {
    stat: "4",
    label: "Events",
    description:
      "Host four community events this year to bring kids, teachers, donors, and volunteers together.",
  },
  {
    stat: "Quarterly",
    label: "Reports",
    description:
      "Publish transparency reports every quarter so donors can see exactly where their money goes and what impact it\u2019s having.",
  },
];

export default function Vision() {
  return (
    <section className="py-16 sm:py-20 bg-sand-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* A) Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-4">
            Our Vision for 2026
          </h2>
          <p className="text-lg text-sand-600 leading-relaxed">
            We have concrete goals for this year &mdash; more kids, more
            orphanages, and real accountability to the people who make it
            possible.
          </p>
        </div>

        {/* B) Four Goal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {goals.map((goal) => (
            <div
              key={goal.label}
              className="rounded-xl bg-white p-6 shadow-sm border border-sand-200 text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold text-green-700 mb-1">
                {goal.stat}
              </div>
              <div className="text-sm font-medium text-sand-500 uppercase tracking-wide mb-3">
                {goal.label}
              </div>
              <p className="text-sand-600 text-sm leading-relaxed">
                {goal.description}
              </p>
            </div>
          ))}
        </div>

        {/* C) Coming Soon — Donor Connection Feature */}
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 sm:p-8 text-center">
            <h3 className="text-xl font-semibold text-green-800 mb-3">
              Connect With Your Sponsored Child
            </h3>
            <p className="text-sand-700 leading-relaxed">
              We&apos;re building a way for donors to receive direct updates
              from the children they sponsor &mdash; hear about their progress,
              see their class photos, and feel connected to the impact
              they&apos;re making. Launching later this year.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
