import { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Meant for Greatness. We'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-sand-900 sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-4 text-lg text-sand-600">
            Have a question or want to get involved? We&apos;d love to hear from
            you.
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 sm:p-8 shadow-sm border border-sand-200">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
