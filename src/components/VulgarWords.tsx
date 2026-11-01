"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import RegionalCard from "@/components/RegionalCard";
import { auth, canSeeVulgar, firebaseConfigured } from "@/lib/firebase";
import type { RegionalEntry } from "@/lib/guides";

/** Renders nothing unless the signed-in person's invite has `vulgar: true`. */
export default function VulgarWords() {
  const [entries, setEntries] = useState<RegionalEntry[]>([]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let latest = 0;
    const unsubscribe = onAuthStateChanged(auth(), async (user) => {
      const check = ++latest;
      setEntries([]);
      if (!user?.email) return;
      try {
        if (!(await canSeeVulgar(user.email))) return;
        const { VULGAR } = await import("@/lib/vulgar-data");
        if (check === latest) setEntries(VULGAR);
      } catch (err) {
        // The section just stays hidden.
        console.error("Vulgar words check failed", err);
      }
    });
    return () => {
      latest++;
      unsubscribe();
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
