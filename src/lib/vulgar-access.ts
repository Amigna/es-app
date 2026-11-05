import { auth, canSeeVulgar } from "./firebase";
import type { RegionalEntry } from "./guides";

// Imported on demand and only for invited people, so the regional page doesn't bring in Firebase for everyone.

/** Empty unless the signed-in person's invite has `vulgar: true`. */
export async function vulgarEntries(): Promise<RegionalEntry[]> {
  await auth().authStateReady();
  const user = auth().currentUser;
  // The rules only show invites to verified emails.
  if (!user?.email || !user.emailVerified || !(await canSeeVulgar(user.email))) return [];
  return (await import("./vulgar-data")).VULGAR;
}
