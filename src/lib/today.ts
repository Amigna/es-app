import { newItemOrder } from "./card-decks";
import { saveProgress } from "./progress-queue";
import { loadToday } from "./progress-store";
import { pickToday } from "./schedule";

// Works out today's review. Imported on demand, because it brings in Firebase and the word lists.

const SAVE_WAIT_MS = 5000;

/** Null when nobody is signed in. */
export async function prepareToday(rare: Set<string>) {
  // Answers still waiting to be saved change what's due. Offline, a write waits for the connection, so don't wait forever.
  await Promise.race([saveProgress(), new Promise((resolve) => setTimeout(resolve, SAVE_WAIT_MS))]);
  const data = await loadToday();
  return data && pickToday(data, newItemOrder(rare));
}
