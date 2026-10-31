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
  ["/phrases", "Phrases"],
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
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Conjugar
            </Link>
            <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-emerald-700 dark:hover:text-emerald-400">
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
