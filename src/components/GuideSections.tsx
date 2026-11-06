import type { GuideSection } from "@/lib/guides";

/** A guide's sections, as the guide page and a course chapter's lesson show them. */
export default function GuideSections({ sections }: { sections: GuideSection[] }) {
  return sections.map((section) => (
    <section key={section.heading}>
      <h2 className="mb-3 text-xl font-semibold">{section.heading}</h2>
      <div className="space-y-3">
        {section.rules.map((r) => (
          <div key={r.rule} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <h3 className="font-medium">{r.rule}</h3>
            <ul className="mt-2 space-y-1.5">
              {r.examples.map((e) => (
                <li key={e.es}>
                  <span lang="es" className="text-accent-800 dark:text-accent-300">
                    {e.es}
                  </span>
                  <span className="block text-sm text-stone-500">{e.en}</span>
                </li>
              ))}
            </ul>
            {r.note && <p className="mt-2 text-sm italic text-stone-600 dark:text-stone-400">{r.note}</p>}
          </div>
        ))}
      </div>
    </section>
  ));
}
