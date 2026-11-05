"use client";

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { setProgressEnabled } from "@/lib/progress-queue";
import { loadReviewSettings, saveReviewSetting, type ReviewSettings } from "@/lib/progress-store";
import { DEFAULT_NEW_PER_DAY, DEFAULT_REVIEWS_PER_DAY, NEW_PER_DAY_OPTIONS, REVIEWS_PER_DAY_OPTIONS } from "@/lib/schedule";

const EMAIL_KEY = "sign-in-email";

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/invalid-action-code": "This sign-in link has expired or was already used. Request a new one.",
  "auth/expired-action-code": "This sign-in link has expired. Request a new one.",
  "auth/unauthorized-domain": "This site isn't authorized for sign-in yet.",
  "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection and try again.",
  "auth/invalid-credential":
    "Wrong email or password. If you usually sign in with Google or an email link, do that, or use \"Forgot password?\" to set one.",
  "auth/wrong-password": "Wrong email or password. Try again, or use \"Forgot password?\".",
  "auth/user-not-found": "There's no account with that email yet. Create one below.",
  "auth/email-already-in-use":
    "There's already an account with this email. Sign in instead, or use \"Forgot password?\" if it was made with Google or an email link.",
  "auth/weak-password": "That password is too short. Use at least 6 characters.",
  "auth/password-does-not-meet-requirements": "That password doesn't meet the requirements. Try a longer one.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
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
  "h-12 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none transition focus:border-accent-600 focus:ring-2 focus:ring-accent-600/30 dark:border-stone-700 dark:bg-stone-900";
const primaryClass =
  "h-12 w-full rounded-xl bg-accent-700 px-5 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "h-12 w-full rounded-xl border border-stone-300 px-5 font-medium transition hover:border-accent-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700";

const REVIEW_SETTINGS: { key: keyof ReviewSettings; id: string; label: string; fallback: number; options: number[] }[] = [
  { key: "reviewsPerDay", id: "reviews-per-day", label: "Reviews per day", fallback: DEFAULT_REVIEWS_PER_DAY, options: REVIEWS_PER_DAY_OPTIONS },
  { key: "newPerDay", id: "new-per-day", label: "New items per day", fallback: DEFAULT_NEW_PER_DAY, options: NEW_PER_DAY_OPTIONS },
];

function ReviewSettingsPanel({ uid }: { uid: string }) {
  const [value, setValue] = useState<ReviewSettings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadReviewSettings(uid)
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

  async function change(setting: Partial<ReviewSettings>) {
    setValue((previous) => previous && { ...previous, ...setting });
    setFailed(false);
    try {
      await saveReviewSetting(uid, setting);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">Today&apos;s review</p>
      {REVIEW_SETTINGS.map(({ key, id, label, fallback, options }) => (
        <div key={key} className="space-y-1">
          <label htmlFor={id} className="block text-sm text-stone-500">
            {label}
          </label>
          <select
            id={id}
            value={value?.[key] ?? fallback}
            disabled={value === null}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
            className={inputClass}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t save that setting. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function SignedIn({ user }: { user: User }) {
  useEffect(() => {
    setProgressEnabled(true);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-stone-500">Signed in as</p>
        <p className="text-lg font-medium break-all">{user.email}</p>
      </div>

      <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        Your drills and quizzes are saved. See your <Link href="/progress" prefetch={false} className="underline">progress</Link>.
      </p>
      <ReviewSettingsPanel uid={user.uid} />

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
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ kind: "link" | "reset"; to: string } | null>(null);
  const address = email.trim();

  async function run(action: () => Promise<void>) {
    onError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const withGoogle = () =>
    run(async () => {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    });

  const withPassword = () =>
    run(async () => {
      if (!creating) {
        await signInWithEmailAndPassword(auth(), address, password);
        return;
      }
      const { user } = await createUserWithEmailAndPassword(auth(), address, password);
      // Saving progress doesn't need this, but invite extras do. Some providers never deliver it, so don't wait on it.
      sendEmailVerification(user).catch((err) => console.error("Verification email failed", err));
    });

  const withLink = () =>
    run(async () => {
      await sendSignInLinkToEmail(auth(), address, { url: `${window.location.origin}/account`, handleCodeInApp: true });
      storeEmail(address);
      setSent({ kind: "link", to: address });
    });

  const resetPassword = () =>
    run(async () => {
      await sendPasswordResetEmail(auth(), address);
      setSent({ kind: "reset", to: address });
    });

  if (sent) {
    return (
      <div role="status" className="space-y-2">
        <p className="font-medium">Check your email</p>
        <p className="text-stone-600 dark:text-stone-400">
          {sent.kind === "link" ? (
            <>
              We sent a sign-in link to <span className="break-all">{sent.to}</span>. Open it on this device to finish.
            </>
          ) : (
            <>
              If there&apos;s an account for <span className="break-all">{sent.to}</span>, we sent it a link to set a new password.
            </>
          )}{" "}
          Check your spam folder if it doesn&apos;t arrive.
        </p>
        <button type="button" onClick={() => setSent(null)} className="text-sm text-accent-700 underline dark:text-accent-400">
          Back
        </button>
      </div>
    );
  }

  const linkButton = "text-sm text-accent-700 underline disabled:opacity-50 dark:text-accent-400";

  return (
    <div className="space-y-4">
      <button type="button" onClick={withGoogle} disabled={busy} className={secondaryClass}>
        Continue with Google
      </button>

      <p className="text-center text-sm text-stone-500">{creating ? "or create an account with your email" : "or sign in with your email"}</p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          withPassword();
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
        <label htmlFor="account-password" className="sr-only">
          Password
        </label>
        <input
          id="account-password"
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          placeholder={creating ? "Choose a password (6+ characters)" : "Password"}
          required
          minLength={creating ? 6 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={busy || !address || !password} className={primaryClass}>
          {creating ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => {
            onError(null);
            setCreating(!creating);
          }}
          className={linkButton}
        >
          {creating ? "I already have an account" : "New here? Create an account"}
        </button>
        {!creating && (
          <button type="button" onClick={resetPassword} disabled={busy || !address} className={linkButton}>
            Forgot password?
          </button>
        )}
        <button type="button" onClick={withLink} disabled={busy || !address} className={linkButton}>
          Email me a sign-in link instead
        </button>
      </div>
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
      <p id="confirm-email-why" className="text-sm text-stone-600 dark:text-stone-400">
        You&apos;re not signed in yet. This happens when a link opens in a different browser or in your email app. Enter the same address
        you used.
      </p>
      <input
        id="confirm-email"
        type="email"
        autoComplete="email"
        aria-describedby="confirm-email-why"
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
    return <p className="text-stone-600 dark:text-stone-400">Sign-in isn&apos;t available right now.</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {user === undefined && <p className="text-stone-500">Loading…</p>}
      {user && <SignedIn user={user} />}
      {user === null && (needsEmail ? <ConfirmEmail onConfirm={finishLink} /> : <SignInForm onError={setError} />)}
    </div>
  );
}
