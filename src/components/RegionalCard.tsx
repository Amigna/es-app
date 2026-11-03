import ReportProblem from "@/components/ReportProblem";
import type { RegionalEntry } from "@/lib/guides";

export default function RegionalCard({ entry }: { entry: RegionalEntry }) {
  return (
    <article className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="font-semibold">{entry.en}</h3>
      <dl className="mt-2 space-y-1">
        {entry.words.map((w) => (
          <div key={w.es} className="grid grid-cols-[8rem_1fr] gap-3">
            <dt lang="es" className="font-medium">
              {w.es}
            </dt>
            <dd className="text-sm text-stone-500">{w.where}</dd>
          </div>
        ))}
      </dl>
      {entry.note && <p className="mt-2 text-sm italic text-stone-600 dark:text-stone-400">{entry.note}</p>}
      <ReportProblem about={`Regional: ${entry.en}`} />
    </article>
  );
}
