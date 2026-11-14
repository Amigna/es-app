import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, inviteId } from "./firebase";

// Imported on demand, so pages with a report link don't bring in Firebase. Reports are read in the Firebase console.

export async function sendReport(about: string, message: string, page: string) {
  await auth().authStateReady();
  const email = auth().currentUser?.email;
  if (!email) throw new Error("Not signed in");
  await addDoc(collection(db(), "reports"), { about, message, page, email: inviteId(email), createdAt: serverTimestamp() });
}

// These match the limits in firestore.rules.
const MAX_CARD = 200;
const MAX_TEXT = 300;

/**
 * A translation the learner marked "Mine works" when it didn't match, kept for review in the `mineWorks` collection so
 * good alternatives can be accepted later. `card` is the card id (write:side:verb:tense:person), which finds the sentence.
 */
export async function sendMineWorks(card: string, prompt: string, typed: string, expected: string) {
  await auth().authStateReady();
  const email = auth().currentUser?.email;
  if (!email) return;
  await addDoc(collection(db(), "mineWorks"), {
    card: card.slice(0, MAX_CARD),
    prompt: prompt.slice(0, MAX_TEXT),
    typed: typed.slice(0, MAX_TEXT),
    expected: expected.slice(0, MAX_TEXT),
    email: inviteId(email),
    createdAt: serverTimestamp(),
  });
}
