"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/orphanages", label: "Orphanages" },
  { href: "/transparency", label: "Transparency" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-green-700 sticky top-0 z-50">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-white.svg"
              alt="meantforgreatness"
              width={200}
              height={25}
              className="h-6 w-auto sm:h-7"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex sm:items-center sm:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-green-100 hover:text-white font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/donate"
              className="rounded-lg bg-sage-400 px-4 py-2 font-semibold text-white hover:bg-sage-500 transition-colors"
            >
              Donate Now
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 text-green-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-green-600 pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-3 px-2 text-green-100 hover:text-white font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/donate"
              className="mt-2 block rounded-lg bg-sage-400 px-4 py-2 text-center font-semibold text-white hover:bg-sage-500"
              onClick={() => setMobileOpen(false)}
            >
              Donate Now
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
