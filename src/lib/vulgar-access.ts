import { auth, canSeeVulgar } from "./firebase";
import type { RegionalEntry } from "./guides";

// Imported on demand and only for invited people, so the regional page doesn't bring in Firebase for everyone.

/** Empty unless the signed-in person's invite has `vulgar: true`. */
export async function vulgarEntries(): Promise<RegionalEntry[]> {
  await auth().authStateReady();
  const email = auth().currentUser?.email;
  if (!email || !(await canSeeVulgar(email))) return [];
  return (await import("./vulgar-data")).VULGAR;
}
