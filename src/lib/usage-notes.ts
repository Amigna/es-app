import { stripAccents } from "./conjugation/accent";

// Notes on common Spanish usage mistakes, shown when a written answer doesn't match. Each note only fires when the
// mistake is in the learner's answer and not in the expected one, so "Quiero a Pilar" never trips the querer rule.
// Add a link verb to LINKS when the same slip keeps coming up.

/** How a verb joins an infinitive: straight on (quiero comprar), or through a word (voy a comer, tengo que ir). */
interface Link {
  verb: string;
  /** The start of the verb's forms, accents removed. */
  stems: RegExp;
  /** The word between the verb and the infinitive, or "" for none. */
  link: "" | "a" | "de" | "que";
  /** What the construction means, when it's worth saying. */
  means?: string;
}

const LINKS: Link[] = [
  { verb: "querer", stems: /^(quier|quer|quis)/, link: "" },
  { verb: "poder", stems: /^(pued|pod|pud)/, link: "" },
  { verb: "deber", stems: /^deb/, link: "" },
  { verb: "saber", stems: /^(sab|sup)/, link: "" },
  { verb: "necesitar", stems: /^necesit/, link: "" },
  { verb: "preferir", stems: /^(prefier|prefer|prefir)/, link: "" },
  { verb: "ir", stems: /^(voy|vas|va|vamos|van|iba|ibas|ibamos|iban|fui|fuiste|fue|fuimos|fueron|vaya|vayas|vayamos|vayan)$/, link: "a" },
  { verb: "empezar", stems: /^(empiez|empez|empec)/, link: "a" },
  { verb: "comenzar", stems: /^(comienz|comenz|comenc)/, link: "a" },
  { verb: "aprender", stems: /^aprend/, link: "a" },
  { verb: "ayudar", stems: /^ayud/, link: "a" },
  { verb: "enseñar", stems: /^ensen/, link: "a" },
  { verb: "volver", stems: /^(vuelv|volv)/, link: "a", means: "do again" },
  { verb: "tener", stems: /^(teng|tien|ten|tuv)/, link: "que", means: "have to" },
  { verb: "acabar", stems: /^acab/, link: "de", means: "have just" },
  { verb: "dejar", stems: /^dej/, link: "de", means: "stop" },
  { verb: "tratar", stems: /^trat/, link: "de", means: "try to" },
];

const LINK_WORDS = new Set(["a", "de", "que"]);
const INFINITIVE = /(ar|er|ir)(me|te|se|nos|lo|la|le|los|las|les){0,2}$/;

const words = (s: string) =>
  stripAccents(s.toLowerCase())
    .replace(/[’‘]/g, "'")
    .replace(/[.,;:!?¿¡"“”]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Where the answer has verb, link and infinitive in a row, with what the learner wrote in place of the link. */
function linkNote(rule: Link, verb: string, wrote: string, infinitive: string): string {
  const right = [verb, rule.link, infinitive].filter(Boolean).join(" ");
  const name = rule.verb[0].toUpperCase() + rule.verb.slice(1);
  const means = rule.means ? ` (${rule.means})` : "";
  if (!rule.link) return `${name} goes straight to the infinitive, with no ${wrote}: ${right}.`;
  if (!wrote) return `${name}${means} takes ${rule.link} before an infinitive: ${right}.`;
  return `${name}${means} takes ${rule.link} before an infinitive, not ${wrote}: ${right}.`;
}

/** Verbs that take a particular word before a person or thing, with the note for using another one. */
interface Preposition {
  stems: RegExp;
  right: string;
  wrong: string[];
  note: (right: string) => string;
}

const PREPOSITIONS: Preposition[] = [
  {
    stems: /^cas/,
    right: "con",
    wrong: ["a"],
    note: (right) => `Casarse takes con: ${right}.`,
  },
  {
    stems: /^(sueñ|soñ)/,
    right: "con",
    wrong: ["de", "en"],
    note: (right) => `Soñar takes con: ${right}.`,
  },
  {
    stems: /^(piens|pens)/,
    right: "en",
    wrong: ["de", "sobre"],
    note: (right) => `Thinking about something is pensar en: ${right}. Pensar de asks for an opinion: ¿qué piensas de...?`,
  },
];

// Only hablar: platicar a and conversar a aren't said.
const HABLAR_CON = /(?<!\p{L})(habl\p{L}*) con (el|la|los|las|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras)(?!\p{L})/iu;

/**
 * Other ways to say an answer that are understood but less natural, each accepted with a note on the better one:
 * hablaron a la maestra for hablaron con la maestra.
 */
/** Things you talk with rather than people you talk to: hablar con la boca llena, con el corazón. */
const NOT_PEOPLE = /^(boca|corazón|voz|verdad|razón|mano|manos|mirada|acento|tono|ojos|mente)$/i;

export function lessNaturalVariants(answer: string): { answer: string; note?: string }[] {
  const m = answer.match(HABLAR_CON);
  if (!m) return [];
  const after = answer.slice((m.index ?? 0) + m[0].length).trim().split(/[\s.,;:!?]+/)[0] ?? "";
  if (NOT_PEOPLE.test(after)) return [];
  const [, verb, next] = m;
  const swapped = answer.replace(HABLAR_CON, (_, v: string, n: string) => (n.toLowerCase() === "el" ? `${v} al` : `${v} a ${n}`));
  // With a, Spanish usually doubles the person with le or les: le hablaron a la maestra. That one is just right.
  const plural = /s$/i.test(next);
  const at = swapped.indexOf(verb);
  const pronoun = plural ? "les" : "le";
  const lower = verb.toLowerCase();
  let doubled: string;
  if (/ar$/.test(lower) || /ando$/.test(lower)) {
    // An infinitive or gerund takes it on the end: hablarle, hablándole.
    const joined = /ando$/.test(lower) ? verb.replace(/ando$/i, `ándo${pronoun}`) : verb + pronoun;
    doubled = swapped.slice(0, at) + joined + swapped.slice(at + verb.length);
  } else {
    // Before the verb, or before haber in a perfect tense (nunca le he hablado), taking the capital if that word
    // opened the sentence: Les hablé a mis primos, ¿Le hablaste?
    let ins = at;
    if (/ado$/.test(lower)) {
      const aux = swapped.slice(0, at).match(/(\p{L}+)\s+$/u);
      if (aux && /^(he|has|ha|hemos|han|hab\p{L}*|hay\p{L}*|hub\p{L}*)$/iu.test(aux[1])) ins = at - aux[0].length;
    }
    const opens = /^[¿¡]*$/.test(swapped.slice(0, ins));
    const word = opens ? pronoun[0].toUpperCase() + pronoun.slice(1) : pronoun;
    const next = swapped.slice(ins);
    const rest = opens ? next[0].toLowerCase() + next.slice(1) : next;
    doubled = `${swapped.slice(0, ins)}${word} ${rest}`;
  }
  const example = doubled;
  const note = `This works, but ${verb.toLowerCase()} con is the more natural fit for talking with someone. With a, Spanish usually adds ${plural ? "les" : "le"}: ${example}`;
  return [{ answer: swapped, note }, { answer: doubled }];
}

function prepositionNote(mine: string[], theirs: string[], shownWords: string[]): string | null {
  for (let i = 0; i < theirs.length - 1; i++) {
    const rule = PREPOSITIONS.find((r) => r.stems.test(theirs[i]) && theirs[i + 1] === r.right);
    if (!rule) continue;
    for (let j = 0; j < mine.length - 1; j++) {
      if (mine[j] === theirs[i] && rule.wrong.includes(mine[j + 1])) return rule.note(`${shownWords[i].toLowerCase()} ${rule.right}`);
    }
  }
  return null;
}

/** A note on a usage slip in a Spanish answer, like "queríamos a comprar", or null when there's nothing to say. */
export function usageNote(input: string, answer: string): string | null {
  const mine = words(input);
  // The answer's own spelling, accents and all, so the note shows the right form.
  const shownWords = answer.replace(/[.,;:!?¿¡"“”]/g, " ").split(/\s+/).filter(Boolean);
  const theirs = shownWords.map((w) => stripAccents(w.toLowerCase()));
  for (let i = 0; i < theirs.length; i++) {
    const rule = LINKS.find((r) => r.stems.test(theirs[i]));
    if (!rule) continue;
    const hasLink = rule.link !== "" && theirs[i + 1] === rule.link;
    // Only the construction the rule is about: dejar salir (let go out) has no de, so dejar's rule stays quiet.
    if (rule.link && !hasLink) continue;
    const inf = theirs[i + (hasLink ? 2 : 1)];
    if (!inf || !INFINITIVE.test(inf)) continue;
    // Find the same verb and infinitive in the learner's answer, with at most one word between them.
    for (let j = 0; j < mine.length; j++) {
      if (mine[j] !== theirs[i]) continue;
      const between = mine[j + 1] === inf ? "" : mine[j + 2] === inf ? mine[j + 1] : null;
      if (between === null || between === rule.link) continue;
      if (between && !LINK_WORDS.has(between)) continue;
      const verb = shownWords[i].toLowerCase();
      return linkNote(rule, verb, between, shownWords[i + (hasLink ? 2 : 1)].toLowerCase());
    }
  }
  return prepositionNote(mine, theirs, shownWords);
}
