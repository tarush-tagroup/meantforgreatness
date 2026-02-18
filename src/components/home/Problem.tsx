export default function Problem() {
  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-6">
            The Opportunity Gap
          </h2>
          <p className="text-lg text-sand-600 leading-relaxed mb-4">
            A child growing up in a Bali orphanage dreams of working at a
            hotel, guiding tourists through rice terraces, or helping visitors
            from around the world. But without English, these dreams have no
            path forward.
          </p>
          <p className="text-lg text-sand-600 leading-relaxed">
            They&apos;ll likely end up in informal labor — farming,
            construction, market work — earning as little as $100/month. With
            English, that same child can access Bali&apos;s massive tourism
            economy, where hotel receptionists earn $600/month, tour guides
            earn $600+/month, and resort managers earn $1,150+/month.{" "}
            <span className="font-semibold text-sand-800">
              One skill changes everything.
            </span>
          </p>
        </div>

        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          {/* Without English */}
          <div className="rounded-xl bg-sand-50 p-8 text-center border border-sand-200">
            <div className="text-4xl font-bold text-sand-400 mb-2">
              $100–190
            </div>
            <div className="text-sm text-sand-500 uppercase tracking-wide font-medium">
              per month without English
            </div>
            <p className="mt-4 text-sand-600 text-sm leading-relaxed">
              Agricultural and informal labor. Bali&apos;s minimum wage is
              just $187/month — and many orphanage graduates earn less.
              Limited to local-only jobs with no career path.
            </p>
          </div>

          {/* With English */}
          <div className="rounded-xl bg-green-50 p-8 text-center border border-green-200">
            <div className="text-4xl font-bold text-green-700 mb-2">
              $500–1,150+
            </div>
            <div className="text-sm text-green-600 uppercase tracking-wide font-medium">
              per month with English
            </div>
            <p className="mt-4 text-green-700 text-sm leading-relaxed">
              Hotel receptionist: $600/mo. Tour guide: $600/mo. Resort
              manager: $1,150/mo. Dive instructor: $840/mo.
              English-speaking workers earn 6-12x more.
            </p>
          </div>
        </div>

        {/* Ripple effect */}
        <div className="mx-auto max-w-3xl mt-10 rounded-xl bg-sage-50 border border-sage-200 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-sage-800 mb-3 text-center">
            It&apos;s Not Just One Life
          </h3>
          <p className="text-sand-700 text-sm leading-relaxed text-center">
            Indonesian workers send 50-70% of their salary home to family. One
            child who learns English and lands a tourism job lifts their
            parents, their siblings, and their community out of poverty. The
            World Bank has found that every additional year of education
            returns 10-13.5% in earnings in developing countries — making
            education the single highest-return investment there is.
          </p>
        </div>

        {/* Case Studies */}
        <div className="mx-auto max-w-4xl mt-12">
          <h3 className="text-2xl sm:text-3xl font-bold text-sand-900 mb-8 text-center">
            Proof It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-white p-6 border border-sand-200 shadow-sm">
              <div className="text-3xl font-bold text-green-700 mb-2">
                88%
              </div>
              <h4 className="font-semibold text-sand-900 mb-2">
                Bali Children Foundation
              </h4>
              <p className="text-sand-600 text-sm leading-relaxed">
                Within 3 months of graduation, 88% of sponsored students
                commenced tertiary studies, apprenticeships, or employment.
                Three graduates were accepted into the Hyatt International
                Scholarship Program.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-sand-200 shadow-sm">
              <div className="text-3xl font-bold text-green-700 mb-2">
                310+
              </div>
              <h4 className="font-semibold text-sand-900 mb-2">
                East Bali Poverty Project
              </h4>
              <p className="text-sand-600 text-sm leading-relaxed">
                Started with 35 students from villages with 85-100%
                illiteracy. Now 310+ graduates — the first sponsored
                university students now work overseas and have become
                community leaders.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-sand-200 shadow-sm">
              <div className="text-3xl font-bold text-green-700 mb-2">
                6-12x
              </div>
              <h4 className="font-semibold text-sand-900 mb-2">
                From Orphanage to Luxury Resort
              </h4>
              <p className="text-sand-600 text-sm leading-relaxed">
                Oki grew up in a Klungkung orphanage. Today he works at Alila
                Hotels, a luxury resort brand. English-speaking tourism
                workers in Bali earn 6-12x more than those in informal labor.
              </p>
            </div>
          </div>
        </div>

        <p className="mx-auto max-w-3xl text-center mt-10 text-sand-600 leading-relaxed">
          English is the single highest-leverage skill we can give these kids.
          But only 5% of Bali teachers rate the current school English
          curriculum as effective. These kids need real, consistent practice
          with qualified teachers.{" "}
          <span className="font-semibold text-sand-800">
            That&apos;s where we come in.
          </span>
        </p>
      </div>
    </section>
  );
}
