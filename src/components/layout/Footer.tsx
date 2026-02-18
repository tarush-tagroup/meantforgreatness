import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-green-800 text-green-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Image
              src="/logo-white.svg"
              alt="meantforgreatness"
              width={180}
              height={22}
              className="h-5 w-auto mb-3"
            />
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
              <li>
                <Link
                  href="/donor"
                  className="hover:text-white transition-colors"
                >
                  Manage Donations
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

        <div className="mt-10 border-t border-green-700 pt-6 text-center text-sm text-green-200" suppressHydrationWarning>
          <p className="mb-2 text-green-300">
            White Light Ventures, Inc is a registered 501(c)(3) nonprofit
            organization. All donations are tax-deductible to the extent
            allowed by law.
          </p>
          &copy; {new Date().getFullYear()} Meant for Greatness. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
