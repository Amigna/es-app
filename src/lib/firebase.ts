import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";

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

export async function isInvited(email: string): Promise<boolean> {
  return (await getDoc(doc(db(), "invites", inviteId(email)))).exists();
}
