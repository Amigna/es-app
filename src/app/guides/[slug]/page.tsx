import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GUIDES, findGuide } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  return { title: guide ? `${guide.title} · Conjugar` : "Guide not found · Conjugar" };
}

// The back link is shared by every guide; the URL-specific part streams in behind Suspense.
export default function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  return (
    <div className="space-y-6">
      <Link href="/guides" className="text-sm text-accent-700 underline dark:text-accent-400">
        All guides
      </Link>
      <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
        <GuideContent params={params} />
      </Suspense>
    </div>
  );
}

function QuizLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/guides/${slug}/quiz`}
      className="inline-block rounded-xl bg-accent-700 px-4 py-2 font-medium text-white transition hover:bg-accent-800"
    >
      Take the quiz
    </Link>
  );
}

async function GuideContent({ params }: { params: PageProps<"/guides/[slug]">["params"] }) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{guide.title}</h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">{guide.summary}</p>
        <QuizLink slug={guide.slug} />
      </header>

      {guide.sections.map((section) => (
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
      ))}

      <QuizLink slug={guide.slug} />
    </article>
  );
}
