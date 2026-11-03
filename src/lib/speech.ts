// Spoken Spanish with the voices already on the device, so nothing is downloaded or paid for.

const LATIN_AMERICAN = new Set(
  "ar bo cl co cr cu do ec gt hn ni pa pe pr py sv uy ve".split(" "),
);

/** A little slower than normal, for learners. */
const RATE = 0.9;
/** For catching every word of a whole sentence. */
export const SLOW_RATE = 0.6;

/** Lower is better, null means it can't speak Spanish. Android writes these as es_MX. */
export function voiceRank(lang: string): number | null {
  const [language, region] = lang.toLowerCase().replace("_", "-").split("-");
  if (language !== "es") return null;
  if (region === "419") return 0;
  if (region === "mx") return 1;
  if (region === "us") return 2;
  if (LATIN_AMERICAN.has(region)) return 3;
  return region === "es" ? 5 : 4;
}

/** The closest voice to Latin American Spanish, keeping the device's order within a rank. */
export function bestVoice<V extends { lang: string }>(voices: readonly V[]): V | null {
  let best: V | null = null;
  let bestRank = Infinity;
  for (const voice of voices) {
    const rank = voiceRank(voice.lang);
    if (rank !== null && rank < bestRank) {
      best = voice;
      bestRank = rank;
    }
  }
  return best;
}

/** "Me llamo..." is a phrase to finish, and voices may read the dots aloud. */
export function spokenText(text: string): string {
  return text.replace(/\s*(\.{3}|…)/g, "").trim();
}

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

let voice: SpeechSynthesisVoice | null = null;
// Chrome can drop an utterance that nothing refers to, cutting it off partway.
let current: SpeechSynthesisUtterance | null = null;

function spanishVoice() {
  voice ??= bestVoice(synth()?.getVoices() ?? []);
  return voice;
}

export const canSpeak = () => spanishVoice() !== null;

export function speak(text: string, rate = RATE) {
  const speech = synth();
  const chosen = spanishVoice();
  if (!speech || !chosen) return;
  speech.cancel();
  current = new SpeechSynthesisUtterance(spokenText(text));
  current.voice = chosen;
  // Some Android browsers ignore the voice unless the language matches it.
  current.lang = chosen.lang.replace("_", "-");
  current.rate = rate;
  speech.speak(current);
}

const listeners = new Set<() => void>();
const voicesChanged = () => {
  voice = null;
  for (const listener of listeners) listener();
};
// Voices load late, and not every browser announces them, so look again a few times.
const RETRIES_MS = [250, 1000, 3000];

/** For useSyncExternalStore. Every button on a page shares one listener. */
export function subscribeToVoices(listener: () => void) {
  const speech = synth();
  if (!speech) return () => {};
  if (listeners.size === 0) {
    speech.addEventListener("voiceschanged", voicesChanged);
    if (!canSpeak()) for (const ms of RETRIES_MS) setTimeout(voicesChanged, ms);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) speech.removeEventListener("voiceschanged", voicesChanged);
  };
}
