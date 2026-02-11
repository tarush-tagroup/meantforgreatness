import Link from "next/link";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative text-white">
      <Image
        src="/images/hero.jpg"
        alt="Girl with arms spread, laughing at Waterbom Bali"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Meant for Greatness
        </h1>
        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-white/90 mb-10 leading-relaxed">
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
