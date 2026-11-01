"use client";

import { useEffect, useState } from "react";
import RegionalCard from "@/components/RegionalCard";
import type { RegionalEntry } from "@/lib/guides";
import { progressEnabled } from "@/lib/progress-queue";

/** Renders nothing unless the signed-in person's invite has `vulgar: true`. */
export default function VulgarWords() {
  const [entries, setEntries] = useState<RegionalEntry[]>([]);

  useEffect(() => {
    if (!progressEnabled()) return;
    let current = true;
    import("@/lib/vulgar-access")
      .then(({ vulgarEntries }) => vulgarEntries())
      .then((found) => {
        if (current) setEntries(found);
      })
      .catch((err: unknown) => {
        // The section just stays hidden.
        console.error("Vulgar words check failed", err);
      });
    return () => {
      current = false;
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold">Vulgar words</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Turned on for your account. These are here so you can recognize them and avoid slipping up, and some are strong.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map((r) => (
          <RegionalCard key={r.en} entry={r} />
        ))}
      </div>
    </section>
  );
}
