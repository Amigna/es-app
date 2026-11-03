import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import SiteShell from "@/components/SiteShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// For page titles and section headings.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const NAME = "Aprendalgo";
const DESCRIPTION = "Learn Latin American and Caribbean Spanish: every verb conjugated, thousands of words, short stories, grammar guides and drills.";

// Pages give only their own part of the title, and the template adds the name.
export const metadata: Metadata = {
  title: { default: NAME, template: `%s · ${NAME}` },
  description: DESCRIPTION,
  // For the preview when a link is shared in a message.
  openGraph: { title: NAME, description: DESCRIPTION, siteName: NAME, type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
