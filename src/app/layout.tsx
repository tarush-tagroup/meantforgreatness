import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Analytics } from "@vercel/analytics/react";
import ErrorReporter from "@/components/ErrorReporter";
import PageViewTracker from "@/components/PageViewTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Meant for Greatness — English Education for Orphan Kids in Bali",
    template: "%s | Meant for Greatness",
  },
  description:
    "We organize English classes for orphan children in Bali, Indonesia — giving them the language skills to access better careers and transform their futures.",
  keywords: [
    "charity",
    "Bali",
    "Indonesia",
    "orphanage",
    "English education",
    "donate",
  ],
  openGraph: {
    title: "Meant for Greatness",
    description:
      "Transforming lives through English education for orphan kids in Bali, Indonesia.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <Analytics />
        <ErrorReporter />
        <PageViewTracker />
      </body>
    </html>
  );
}
