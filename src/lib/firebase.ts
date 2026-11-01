import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

// Web config is public by design; access is controlled by firestore.rules.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(Boolean);

// Created on first use, so prerendering pages never touches Firebase.
function app(): FirebaseApp {
  return getApps()[0] ?? initializeApp(config);
}

export const auth = (): Auth => getAuth(app());
export const db = (): Firestore => getFirestore(app());

/** Invites are documents in `invites`, keyed by lowercase email. */
export const inviteId = (email: string) => email.trim().toLowerCase();

export type InviteStatus = "invited" | "requested" | "none";

/** Requests have `added: false` until approved in the console. Invites made by hand have no `added` field. */
export function statusOfInvite(invite: { added?: boolean } | undefined): InviteStatus {
  if (!invite) return "none";
  return invite.added === false ? "requested" : "invited";
}

export async function inviteStatus(email: string): Promise<InviteStatus> {
  return statusOfInvite((await getDoc(doc(db(), "invites", inviteId(email)))).data());
}

/** Set `vulgar: true` on an invite in the console. Off by default, and people can't change their own invite. */
export function inviteAllowsVulgar(invite: { added?: boolean; vulgar?: boolean } | undefined): boolean {
  return statusOfInvite(invite) === "invited" && invite?.vulgar === true;
}

export async function canSeeVulgar(email: string): Promise<boolean> {
  return inviteAllowsVulgar((await getDoc(doc(db(), "invites", inviteId(email)))).data());
}

export async function isInvited(email: string): Promise<boolean> {
  return (await inviteStatus(email)) === "invited";
}

export async function requestInvite(email: string, firstName: string, lastName: string) {
  const id = inviteId(email);
  await setDoc(doc(db(), "invites", id), { firstName, lastName, email: id, added: false, requestedAt: serverTimestamp() });
}
