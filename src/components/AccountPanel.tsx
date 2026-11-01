"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, firebaseConfigured, isInvited } from "@/lib/firebase";
import { setProgressEnabled } from "@/lib/progress-queue";
import { loadNewPerDay, saveNewPerDay } from "@/lib/progress-store";
import { DEFAULT_NEW_PER_DAY, NEW_PER_DAY_OPTIONS } from "@/lib/schedule";

const EMAIL_KEY = "sign-in-email";

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/invalid-action-code": "This sign-in link has expired or was already used. Request a new one.",
  "auth/expired-action-code": "This sign-in link has expired. Request a new one.",
  "auth/unauthorized-domain": "This site isn't authorized for sign-in yet.",
  "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection and try again.",
};

// Closing the Google window isn't a problem worth reporting.
const IGNORED_ERRORS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

function errorMessage(err: unknown): string | null {
  if (err instanceof FirebaseError) {
    if (IGNORED_ERRORS.has(err.code)) return null;
    return FRIENDLY_ERRORS[err.code] ?? "Something went wrong signing in. Please try again.";
  }
  return "Something went wrong signing in. Please try again.";
}

function readStoredEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

function storeEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    // A link opened elsewhere just asks for the email again.
  }
}

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-900";
const primaryClass =
  "h-12 w-full rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "h-12 w-full rounded-xl border border-zinc-300 px-5 font-medium transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700";

function NewItemsSetting({ uid }: { uid: string }) {
  const [value, setValue] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadNewPerDay(uid)
      .then((saved) => {
        if (current) setValue(saved);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [uid]);

  async function change(next: number) {
    setValue(next);
    setFailed(false);
    try {
      await saveNewPerDay(uid, next);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor="new-per-day" className="block text-sm text-zinc-500">
        New items per day in Today&apos;s review
      </label>
      <select
        id="new-per-day"
        value={value ?? DEFAULT_NEW_PER_DAY}
        disabled={value === null}
        onChange={(e) => change(Number(e.target.value))}
        className={inputClass}
      >
        {NEW_PER_DAY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t save that setting. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function SignedIn({ user }: { user: User }) {
  const [invited, setInvited] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    isInvited(user.email ?? "")
      .then((result) => {
        setProgressEnabled(result);
        if (current) setInvited(result);
      })
      .catch((err: unknown) => {
        console.error("Invite check failed", err);
        if (current) setCheckError(err instanceof FirebaseError ? err.code : "unknown");
      });
    return () => {
      current = false;
    };
  }, [user.email]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-500">Signed in as</p>
        <p className="text-lg font-medium break-all">{user.email}</p>
      </div>

      {checkError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t check your invite ({checkError}). Everything else still works, so try again later.
        </p>
      )}
      {invited === true && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          You&apos;re on the invite list, so your drills and quizzes are saved. See your <Link href="/progress" prefetch={false} className="underline">progress</Link>.
        </p>
      )}
      {invited === true && <NewItemsSetting uid={user.uid} />}
      {invited === false && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Saved progress is invite-only for now, and this email isn&apos;t on the list. Everything else on the site is yours to use.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setProgressEnabled(false);
          signOut(auth());
        }}
        className={secondaryClass}
      >
        Sign out
      </button>
    </div>
  );
}

function SignInForm({ onError }: { onError: (message: string | null) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function withGoogle() {
    onError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function withEmail() {
    onError(null);
    setBusy(true);
    try {
      const address = email.trim();
      await sendSignInLinkToEmail(auth(), address, { url: `${window.location.origin}/account`, handleCodeInApp: true });
      storeEmail(address);
      setSentTo(address);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="space-y-2">
        <p className="font-medium">Check your email</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          We sent a sign-in link to <span className="break-all">{sentTo}</span>. Open it on this device to finish, and check your
          spam folder if it doesn&apos;t arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={withGoogle} disabled={busy} className={secondaryClass}>
        Continue with Google
      </button>

      <p className="text-center text-sm text-zinc-500">or get a sign-in link by email</p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          withEmail();
        }}
      >
        <label htmlFor="account-email" className="sr-only">
          Email address
        </label>
        <input
          id="account-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={busy || !email.trim()} className={primaryClass}>
          Email me a link
        </button>
      </form>
    </div>
  );
}

/** Shown when a sign-in link is opened on a different browser or device, where the email wasn't saved. */
function ConfirmEmail({ onConfirm }: { onConfirm: (email: string) => void }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(email.trim());
      }}
    >
      <label htmlFor="confirm-email" className="block font-medium">
        Confirm your email to finish signing in
      </label>
      <input
        id="confirm-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <button type="submit" disabled={!email.trim()} className={primaryClass}>
        Finish signing in
      </button>
    </form>
  );
}

export default function AccountPanel() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);

  async function finishLink(email: string) {
    setNeedsEmail(false);
    try {
      await signInWithEmailLink(auth(), email, window.location.href);
      storeEmail(null);
      // Drop the one-time code from the address bar.
      window.history.replaceState(null, "", "/account");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (!firebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(auth(), setUser);
    if (isSignInWithEmailLink(auth(), window.location.href)) {
      const email = readStoredEmail();
      queueMicrotask(() => {
        if (email) finishLink(email);
        else setNeedsEmail(true);
      });
    }
    return unsubscribe;
  }, []);

  if (!firebaseConfigured) {
    return <p className="text-zinc-600 dark:text-zinc-400">Sign-in isn&apos;t available right now.</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {user === undefined && <p className="text-zinc-500">Loading…</p>}
      {user && <SignedIn user={user} />}
      {user === null && (needsEmail ? <ConfirmEmail onConfirm={finishLink} /> : <SignInForm onError={setError} />)}
    </div>
  );
}
