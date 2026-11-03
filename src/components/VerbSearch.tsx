"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { VERB_SHAPE, searchVerbs, verbSlug } from "@/lib/verbs";

export default function VerbSearch({
  autoFocus = false,
}: {
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const results = searchVerbs(query, 7);
  const showList = open && results.length > 0;

  function go(inf: string) {
    setOpen(false);
    router.push(`/verb/${encodeURIComponent(verbSlug(inf))}`);
  }

  function submit() {
    const picked = results[active] ?? results[0];
    if (picked) return go(picked.inf);
    const typed = query.trim().toLowerCase();
    if (VERB_SHAPE.test(typed)) return go(typed);
    setError(
      "Type a Spanish verb ending in -ar, -er or -ir, or an English meaning like “to eat”.",
    );
  }

  return (
    <form
      className="relative w-full"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for a verb
      </label>
      <div className="flex gap-2">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="hablar, or to eat"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            setOpen(true);
            setError("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg outline-none transition focus:border-accent-600 focus:ring-2 focus:ring-accent-600/30 dark:border-stone-700 dark:bg-stone-900"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-accent-700 px-5 font-medium text-white cursor-pointer transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Conjugate
        </button>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          {results.map((v, i) => (
            <li
              key={v.inf}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown fires before the input's blur, so the click is not lost
              onMouseDown={(e) => {
                e.preventDefault();
                go(v.inf);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 ${
                i === active ? "bg-accent-50 dark:bg-accent-950" : ""
              }`}
            >
              <span className="font-medium">{v.inf}</span>
              <span className="truncate text-sm text-stone-500">{v.en}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
