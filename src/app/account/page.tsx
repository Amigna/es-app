import type { Metadata } from "next";
import AccountPanel from "@/components/AccountPanel";

export const metadata: Metadata = { title: "Account · Conjugar" };

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <header className="mx-auto max-w-md space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          You don&apos;t need an account to use the site. Signing in will let invited people save their progress.
        </p>
      </header>
      <AccountPanel />
    </div>
  );
}
