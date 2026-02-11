import Link from "next/link";

export default function Sponsorship() {
  const options = [
    {
      title: "Sponsor a Kid",
      price: "$25/month",
      description:
        "Cover the cost of English classes for one child for a full month. Your support gives a child consistent access to quality education.",
    },
    {
      title: "Sponsor Multiple Kids",
      price: "$100/month",
      description:
        "Support an entire class group, helping 4-5 children build English fluency together through regular group lessons.",
    },
    {
      title: "Sponsor a Teacher",
      price: "$250/month",
      description:
        "Fund a dedicated teacher for a year, ensuring a full orphanage has continuous, professional English instruction.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-amber-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-6">
            How You Can Help
          </h2>
          <p className="text-lg text-warmgray-600 leading-relaxed">
            Every dollar goes directly to funding classes for these children.
            Choose a sponsorship level that works for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {options.map((option) => (
            <div
              key={option.title}
              className="rounded-xl bg-white p-8 shadow-sm border border-amber-200 flex flex-col"
            >
              <h3 className="text-xl font-semibold text-warmgray-900 mb-2">
                {option.title}
              </h3>
              <div className="text-2xl font-bold text-amber-600 mb-4">
                {option.price}
              </div>
              <p className="text-warmgray-600 text-sm leading-relaxed flex-1">
                {option.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/donate"
            className="inline-block rounded-lg bg-amber-500 px-8 py-3.5 text-lg font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Make a Donation
          </Link>
        </div>

        {/* Impact stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: "4", label: "Orphanages" },
            { stat: "100+", label: "Kids" },
            { stat: "Bali", label: "Indonesia" },
            { stat: "Sept 2024", label: "Classes Since" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-3xl sm:text-4xl font-bold text-teal-700">
                {item.stat}
              </div>
              <div className="mt-1 text-sm text-warmgray-500 font-medium uppercase tracking-wide">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
