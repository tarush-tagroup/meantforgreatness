import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-warmgray-800 text-warmgray-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold text-white mb-3">
              Meant for Greatness
            </h3>
            <p className="text-sm leading-relaxed">
              Transforming lives through English education for orphan children in
              Bali, Indonesia. Every child deserves a shot at a better future.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/orphanages"
                  className="hover:text-white transition-colors"
                >
                  Orphanages
                </Link>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="hover:text-white transition-colors"
                >
                  Donate
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Our Partner</h4>
            <p className="text-sm leading-relaxed">
              Classes delivered in partnership with TransforMe Academy by Bahasa
              Bule — bringing quality English education to those who need it
              most.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-warmgray-700 pt-6 text-center text-sm text-warmgray-400" suppressHydrationWarning>
          &copy; {new Date().getFullYear()} Meant for Greatness. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
