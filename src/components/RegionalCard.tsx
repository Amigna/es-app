import type { RegionalEntry } from "@/lib/guides";

export default function RegionalCard({ entry }: { entry: RegionalEntry }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">{entry.en}</h3>
      <dl className="mt-2 space-y-1">
        {entry.words.map((w) => (
          <div key={w.es} className="grid grid-cols-[8rem_1fr] gap-3">
            <dt lang="es" className="font-medium">
              {w.es}
            </dt>
            <dd className="text-sm text-zinc-500">{w.where}</dd>
          </div>
        ))}
      </dl>
      {entry.note && <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">{entry.note}</p>}
    </article>
  );
}
