import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">That doesn’t look like a Spanish verb</h1>
      <p className="text-stone-600 dark:text-stone-400">Verbs end in -ar, -er or -ir (or -se when reflexive).</p>
      <Link href="/" className="text-accent-700 underline dark:text-accent-400">
        Back to search
      </Link>
    </div>
  );
}
