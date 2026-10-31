// Spanish orthographic stress helpers: syllable nuclei, default stress, and
// written-accent placement. Used when attaching clitics (levántate) and when
// a prefixed verb turns a monosyllable into a longer word (ten -> detén).

const VOWELS = "aeiouáéíóúü";
const STRONG = "aeoáéó";
const STRIP: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };
const ADD: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };

const isVowel = (c: string | undefined) => !!c && VOWELS.includes(c);

export interface Nucleus {
  start: number;
  end: number; // exclusive
}

export function nuclei(word: string): Nucleus[] {
  const vowel: boolean[] = [];
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    let v = VOWELS.includes(c);
    if (c === "u" && i > 0) {
      const prev = word[i - 1];
      const next = word[i + 1];
      // silent u in que/qui/gue/gui
      if (prev === "q" || (prev === "g" && next && "eiéí".includes(next))) v = false;
    }
    vowel.push(v);
  }
  const out: Nucleus[] = [];
  let i = 0;
  while (i < word.length) {
    if (!vowel[i]) {
      i++;
      continue;
    }
    const start = i;
    let j = i + 1;
    while (j < word.length && vowel[j]) {
      const a = word[j - 1];
      const b = word[j];
      // Hiatus: two strong vowels, or an accented weak vowel next to a strong one. ui/iu always count as one syllable (RAE 2010).
      const hiatus =
        (STRONG.includes(a) && STRONG.includes(b)) ||
        ("íú".includes(a) && STRONG.includes(b)) ||
        ("íú".includes(b) && STRONG.includes(a));
      if (hiatus) break;
      j++;
    }
    out.push({ start, end: j });
    i = j;
  }
  return out;
}

function defaultStress(word: string, ns: Nucleus[]): number {
  if (ns.length <= 1) return 0;
  const last = word[word.length - 1];
  return isVowel(last) || last === "n" || last === "s" ? ns.length - 2 : ns.length - 1;
}

export function hasAccent(word: string): boolean {
  return /[áéíóú]/.test(word);
}

/** Index of the stressed nucleus (written accent wins, otherwise the default rule). */
export function stressIndex(word: string): number {
  const ns = nuclei(word);
  for (let k = 0; k < ns.length; k++) {
    for (let p = ns[k].start; p < ns[k].end; p++) if ("áéíóú".includes(word[p])) return k;
  }
  return defaultStress(word, ns);
}

/** Rewrites accents so that nucleus `idx` is the stressed one, using as few marks as the rules allow. */
export function setStress(word: string, idx: number): string {
  const ns = nuclei(word);
  if (idx < 0 || idx >= ns.length) return word;

  // A lone í/ú next to another vowel marks a hiatus and must stay.
  const keep = new Set<number>();
  for (const n of ns) {
    if (n.end - n.start === 1 && "íú".includes(word[n.start]) && (isVowel(word[n.start - 1]) || isVowel(word[n.start + 1]))) {
      keep.add(n.start);
    }
  }

  const chars = [...word];
  for (let i = 0; i < chars.length; i++) if (STRIP[chars[i]] && !keep.has(i)) chars[i] = STRIP[chars[i]];
  if (defaultStress(word, ns) === idx) return chars.join("");

  const n = ns[idx];
  let pos = -1;
  for (let p = n.start; p < n.end; p++) {
    if (STRONG.includes(word[p])) {
      pos = p;
      break;
    }
  }
  if (pos < 0) pos = n.end - 1; // iu / ui: the second vowel carries the mark
  chars[pos] = ADD[chars[pos]] ?? chars[pos];
  return chars.join("");
}

/** Appends a clitic (te, se, nos...) keeping the original stress: levanta + te -> levántate. */
export function attachEnclitic(word: string, clitic: string): string {
  return setStress(word + clitic, stressIndex(word));
}

/** prefix + root where the root was a monosyllable that now needs a mark: ten -> detén, vio -> previó. */
export function prefixWord(prefix: string, root: string): string {
  const joined = prefix + root;
  if (!prefix || hasAccent(root) || nuclei(root).length !== 1) return joined;
  return setStress(joined, nuclei(joined).length - 1);
}

/** Puts a written accent on the last vowel (hablar -> hablá). */
export function accentLastVowel(word: string): string {
  const chars = [...word];
  for (let i = chars.length - 1; i >= 0; i--) {
    if (ADD[chars[i]]) {
      chars[i] = ADD[chars[i]];
      break;
    }
    if (STRIP[chars[i]]) break;
  }
  return chars.join("");
}

export const stripAccents = (s: string) => s.replace(/[áéíóú]/g, (c) => STRIP[c]);

// Monosyllables that keep their mark to tell them apart from another word (dé/de, sé/se).
const DIACRITIC = new Set(["dé", "sé", "té", "él", "tú", "mí", "sí", "más", "qué", "cuál"]);

/** RAE 2010: monosyllables take no written accent (rió -> rio, guió -> guio, huí -> hui), except diacritic ones. */
export function tidyWord(word: string): string {
  if (!hasAccent(word) || DIACRITIC.has(word) || nuclei(word).length !== 1) return word;
  return stripAccents(word);
}

export const tidy = (text: string) => text.split(" ").map(tidyWord).join(" ");
