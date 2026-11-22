import type { ReactNode } from "react";

/** The page header for /privacy and /terms. */
export function PolicyHeader({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-stone-500">Last updated {updated}</p>
      <div className="text-stone-600 dark:text-stone-400">{children}</div>
    </header>
  );
}

/** One titled part of a policy page, with readable spacing for paragraphs and lists. */
export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-stone-700 dark:text-stone-300 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    </section>
  );
}
