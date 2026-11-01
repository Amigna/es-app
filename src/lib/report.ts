import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, inviteId } from "./firebase";

// Imported on demand, so pages with a report link don't bring in Firebase. Reports are read in the Firebase console.

export async function sendReport(about: string, message: string, page: string) {
  await auth().authStateReady();
  const email = auth().currentUser?.email;
  if (!email) throw new Error("Not signed in");
  await addDoc(collection(db(), "reports"), { about, message, page, email: inviteId(email), createdAt: serverTimestamp() });
}
