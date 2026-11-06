"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { LevelPrompt } from "@/components/LevelPicker";

// Each section's hue, which the accent-* colors in globals.css are built from.
const NAV = [
  ["/", "Verbs", 180],
  ["/nouns", "Nouns", 35],
  ["/adjectives", "Adjectives", 75],
  ["/adverbs", "Adverbs", 135],
  ["/small-words", "Small words", 235],
  ["/phrases", "Phrases", 350],
  ["/regional", "Regional", 300],
  ["/reading", "Reading", 270],
  ["/course", "Course", 105],
  ["/guides", "Guides", 205],
  ["/drill", "Drills", 325],
] as const;

const ACCOUNT_LINKS = [
  ["/progress", "Progress", 160],
  ["/account", "Account", 180],
] as const;

// The top-level segment each nav link covers: "/" covers the home page and every verb page.
function segmentOf(href: string) {
  return href === "/" ? null : href.slice(1);
}

function isActive(href: string, segment: string | null) {
  return href === "/" ? segment === null || segment === "verb" : segmentOf(href) === segment;
}

function hueFor(segment: string | null) {
  const all = [...NAV, ...ACCOUNT_LINKS];
  return all.find(([href]) => isActive(href, segment))?.[2] ?? 180;
}

const hueStyle = (hue: number) => ({ "--hue": hue }) as CSSProperties;

export default function SiteShell({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();

  return (
    <div className="flex flex-1 flex-col" style={hueStyle(hueFor(segment))}>
      <header className="bg-linear-to-b from-accent-100/70 to-transparent dark:from-accent-950/60">
        <div className="section-stripe h-1" />
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
          <div className="flex items-center justify-between xl:contents">
            <Link href="/" className="flex items-center gap-2 py-1 font-display text-xl font-semibold tracking-tight">
              <span aria-hidden className="section-stripe size-5 rounded-md" />
              Aprendalgo
            </Link>
            {/* No prefetch: these pages bring in the Firebase SDK, which other pages shouldn't download. */}
            <div className="flex gap-1 text-sm xl:order-last">
              {ACCOUNT_LINKS.map(([href, label, hue]) => (
                <NavLink key={href} href={href} label={label} hue={hue} active={isActive(href, segment)} prefetch={false} />
              ))}
            </div>
          </div>
          {/* A tidy grid on phones with the last two links centered, a row under the title on tablets, all one line on wide screens. */}
          <nav className="grid grid-cols-6 gap-1 text-sm md:flex">
            {NAV.map(([href, label, hue]) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                hue={hue}
                active={isActive(href, segment)}
                className="col-span-2 nth-last-2:col-start-2"
              />
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* The drill page asks on its setup screen instead, so the question never sits above a drill in progress. */}
        {segment !== "drill" && <LevelPrompt className="mb-8" />}
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href,
  label,
  hue,
  active,
  prefetch,
  className = "",
}: {
  href: string;
  label: string;
  hue: number;
  active: boolean;
  prefetch?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      style={hueStyle(hue)}
      className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-2 font-medium transition ${
        active
          ? "bg-accent-600 text-white dark:bg-accent-700"
          : "text-accent-700 hover:bg-accent-100 dark:text-accent-300 dark:hover:bg-accent-950"
      } ${className}`}
    >
      {label}
    </Link>
  );
}
