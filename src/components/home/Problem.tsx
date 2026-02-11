export default function Problem() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-6">
            The Problem
          </h2>
          <p className="text-lg text-warmgray-600 leading-relaxed mb-8">
            Indonesia is one of the poorest countries in the world. Orphan
            children growing up without support will typically earn around{" "}
            <span className="font-semibold text-warmgray-800">
              $250 USD per month
            </span>{" "}
            as adults — barely enough to survive.
          </p>
        </div>

        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="rounded-xl bg-warmgray-50 p-8 text-center border border-warmgray-200">
            <div className="text-4xl font-bold text-warmgray-400 mb-2">
              ~$250
            </div>
            <div className="text-sm text-warmgray-500 uppercase tracking-wide font-medium">
              per month without English
            </div>
            <p className="mt-4 text-warmgray-600 text-sm">
              Limited to local-only jobs with minimal growth opportunities
            </p>
          </div>

          <div className="rounded-xl bg-teal-50 p-8 text-center border border-teal-200">
            <div className="text-4xl font-bold text-teal-700 mb-2">~$500</div>
            <div className="text-sm text-teal-600 uppercase tracking-wide font-medium">
              per month with English
            </div>
            <p className="mt-4 text-teal-700 text-sm">
              Access to tourism, international business, and higher-paying
              careers
            </p>
          </div>
        </div>

        <p className="mx-auto max-w-3xl text-center mt-10 text-warmgray-600 leading-relaxed">
          If these children can speak English, they unlock access to far better
          jobs — materially impacting them, their families, and their entire
          communities. But the English they learn in school simply isn&apos;t
          enough.
        </p>
      </div>
    </section>
  );
}
