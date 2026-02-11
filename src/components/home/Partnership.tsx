import Image from "next/image";

export default function Partnership() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-10 text-center">
          Our Partnership
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-10">
          <div className="overflow-hidden rounded-xl">
            <Image
              src="/images/kids-learning.jpg"
              alt="Young kids doing English worksheets on the floor"
              width={1200}
              height={800}
              className="w-full h-auto"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div className="rounded-xl bg-teal-50 border border-teal-200 p-8 sm:p-10">
            <h3 className="text-xl font-semibold text-teal-800 mb-4">
              TransforMe Academy by Bahasa Bule
            </h3>
            <p className="text-warmgray-700 leading-relaxed mb-4">
              <span className="font-semibold">Bahasa Bule</span> is a
              well-known language school on the island that teaches foreigners
              how to speak Bahasa Indonesia. They launched{" "}
              <span className="font-semibold">TransforMe Academy</span> as
              their dedicated arm for teaching English to local kids.
            </p>
            <p className="text-warmgray-700 leading-relaxed mb-4">
              Same team. Same quality teachers. Now focused on giving orphan
              children the English skills they need to transform their futures.
            </p>
            <p className="text-warmgray-700 leading-relaxed">
              We partner with TransforMe Academy to deliver all our classes —
              combining their teaching expertise with our mission to reach every
              orphanage in Bali.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl bg-warmgray-50 p-6 border border-warmgray-200">
            <h4 className="font-semibold text-warmgray-800 mb-2">
              Bahasa Bule
            </h4>
            <p className="text-sm text-warmgray-600">
              Established language school teaching Bahasa Indonesia to expats
              and tourists. Proven teaching methodology and experienced
              instructors.
            </p>
          </div>
          <div className="rounded-xl bg-warmgray-50 p-6 border border-warmgray-200">
            <h4 className="font-semibold text-warmgray-800 mb-2">
              TransforMe Academy
            </h4>
            <p className="text-sm text-warmgray-600">
              Their social impact arm — taking the same quality of education
              and directing it toward local children who need it most.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
