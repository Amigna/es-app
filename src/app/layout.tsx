import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NAV = [
  ["/", "Verbs"],
  ["/nouns", "Nouns"],
  ["/adjectives", "Adjectives"],
  ["/adverbs", "Adverbs"],
  ["/small-words", "Small words"],
  ["/phrases", "Phrases"],
  ["/regional", "Regional"],
  ["/reading", "Reading"],
  ["/guides", "Guides"],
  ["/drill", "Drills"],
] as const;

export const metadata: Metadata = {
  title: "Conjugar",
  description: "Every conjugation of every Spanish verb, in Latin American and Caribbean Spanish.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex items-center justify-between lg:contents">
              <Link href="/" className="py-1 text-lg font-semibold tracking-tight">
                Conjugar
              </Link>
              {/* No prefetch: these pages bring in the Firebase SDK, which other pages shouldn't download. */}
              <div className="flex gap-4 text-sm lg:order-last">
                <Link href="/progress" prefetch={false} className="flex min-h-10 items-center hover:text-emerald-700 dark:hover:text-emerald-400">
                  Progress
                </Link>
                <Link href="/account" prefetch={false} className="flex min-h-10 items-center hover:text-emerald-700 dark:hover:text-emerald-400">
                  Account
                </Link>
              </div>
            </div>
            {/* A tidy grid on phones with the last link centered, a row under the title on tablets, all one line on wide screens. */}
            <nav className="grid grid-cols-3 text-sm md:flex md:gap-1">
              {NAV.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-10 items-center justify-center rounded-lg last:col-start-2 md:px-2 hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
