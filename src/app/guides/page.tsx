import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = { title: "Grammar guides" };

export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Grammar guides</h1>
      <ul className="grid gap-3 md:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="block h-full rounded-xl border border-stone-200 bg-white p-4 transition hover:border-accent-600 dark:border-stone-800 dark:bg-stone-900"
            >
              <span className="block text-lg font-semibold">{g.title}</span>
              <span className="mt-1 block text-stone-600 dark:text-stone-400">{g.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
