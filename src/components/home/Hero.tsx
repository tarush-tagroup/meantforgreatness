import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative bg-teal-800 text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900 to-teal-700 opacity-90" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Meant for Greatness
        </h1>
        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-teal-100 mb-10 leading-relaxed">
          Transforming the lives of orphan children in Bali, Indonesia through
          the power of English education. One class at a time, we&apos;re
          opening doors to brighter futures.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/donate"
            className="rounded-lg bg-amber-500 px-8 py-3.5 text-lg font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Donate Now
          </Link>
          <Link
            href="/orphanages"
            className="rounded-lg border-2 border-white/30 px-8 py-3.5 text-lg font-semibold text-white hover:bg-white/10 transition-colors"
          >
            See Our Orphanages
          </Link>
        </div>
      </div>
    </section>
  );
}
