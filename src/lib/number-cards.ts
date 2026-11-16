import type { Card } from "./drill";
import type { NumberKind, NumberMax } from "./drill-settings";
import { MONTHS_EN, SPLIT_TEENS, dateWords, digitForms, numberWords, ordinalWord, timeWords, withNoun, type NumberUse } from "./numbers";

// Number, date and time cards, made up as they're asked, so there's nothing to write by hand. Answers are saved as
// tallies by kind (`number:words`, `number:time`…), not scheduled: there's no fixed set of items to review.

type Random = () => number;

interface CountNoun {
  es: string;
  plural: string;
  gender: "m" | "f";
  /** Makes sense with thousands: dólares, personas. Not hermanos. */
  big?: boolean;
  /** Takes an ordinal naturally: el tercer piso, la segunda calle. */
  ordinal?: boolean;
}

/** Everyday countable nouns from the word lists. A test checks each one is there with this gender. */
export const COUNT_NOUNS: CountNoun[] = [
  { es: "persona", plural: "personas", gender: "f", big: true },
  { es: "dólar", plural: "dólares", gender: "m", big: true },
  { es: "peso", plural: "pesos", gender: "m", big: true },
  { es: "año", plural: "años", gender: "m", big: true, ordinal: true },
  { es: "día", plural: "días", gender: "m", big: true, ordinal: true },
  { es: "libro", plural: "libros", gender: "m", big: true },
  { es: "casa", plural: "casas", gender: "f", big: true, ordinal: true },
  { es: "botella", plural: "botellas", gender: "f", big: true },
  { es: "página", plural: "páginas", gender: "f", big: true, ordinal: true },
  { es: "árbol", plural: "árboles", gender: "m", big: true },
  { es: "carro", plural: "carros", gender: "m", big: true },
  { es: "semana", plural: "semanas", gender: "f", ordinal: true },
  { es: "mes", plural: "meses", gender: "m", ordinal: true },
  { es: "hora", plural: "horas", gender: "f" },
  { es: "minuto", plural: "minutos", gender: "m" },
  { es: "vez", plural: "veces", gender: "f", ordinal: true },
  { es: "mujer", plural: "mujeres", gender: "f" },
  { es: "hombre", plural: "hombres", gender: "m" },
  { es: "silla", plural: "sillas", gender: "f" },
  { es: "mesa", plural: "mesas", gender: "f", ordinal: true },
  { es: "ciudad", plural: "ciudades", gender: "f", big: true },
  { es: "taza", plural: "tazas", gender: "f" },
  { es: "noche", plural: "noches", gender: "f", ordinal: true },
  { es: "piso", plural: "pisos", gender: "m", ordinal: true },
  { es: "calle", plural: "calles", gender: "f", ordinal: true },
  { es: "capítulo", plural: "capítulos", gender: "m", ordinal: true },
  { es: "lección", plural: "lecciones", gender: "f", ordinal: true },
  { es: "puerta", plural: "puertas", gender: "f", ordinal: true },
  { es: "fila", plural: "filas", gender: "f", ordinal: true },
  { es: "asiento", plural: "asientos", gender: "m", ordinal: true },
  { es: "lugar", plural: "lugares", gender: "m", ordinal: true },
  { es: "premio", plural: "premios", gender: "m", ordinal: true },
  { es: "edificio", plural: "edificios", gender: "m", ordinal: true },
];

export const NUMBER_LABELS: Record<NumberKind, string> = {
  words: "Number in words",
  noun: "Number with a noun",
  digits: "Words to number",
  ordinal: "Ordinal",
  date: "Date",
  year: "Date with year",
  time: "Time",
};

const pick = <T,>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];
const between = (lo: number, hi: number, random: Random) => lo + Math.floor(random() * (hi - lo + 1));
/** 21,000 rather than 21.000, which an English speaker could read as twenty-one. */
const shownNumber = (n: number) => n.toLocaleString("en-US");

/** Leans on the numbers that catch people out: 16 to 29, cien and ciento, the odd hundreds, and mil. */
export function pickNumber(max: NumberMax, random: Random): number {
  const r = random();
  if (max === 100 || r < 0.2) {
    const s = random();
    return s < 0.4 ? between(16, 29, random) : s < 0.6 ? between(1, 15, random) : between(30, 100, random);
  }
  if (max === 1000 || r < 0.35) {
    const s = random();
    if (s < 0.2) return between(100, 199, random);
    if (s < 0.45) return between(1, 9, random) * 100;
    // The irregular hundreds come up more often.
    if (s < 0.65) return pick([5, 7, 9], random) * 100 + between(1, 99, random);
    return s < 0.95 ? between(101, 999, random) : 1000;
  }
  const s = random();
  if (s < 0.25) return between(1000, 1999, random);
  if (s < 0.45) return pick([21, 31, 100, 200, 500, 700, 900, between(2, 99, random)], random) * 1000;
  if (s < 0.95) return between(2000, 999_999, random);
  return 1_000_000;
}

/** A number for a noun card: one that ends in 1, a hundred that agrees, or cien, more often than chance would. */
function pickNounNumber(max: NumberMax, random: Random): number {
  const s = random();
  const hundredsOk = max >= 1000;
  if (s < 0.3) return pick([1, 21, 31, 41, 51, 61, 71, 81, 91, ...(hundredsOk ? [101, 201, 301, 501] : [])], random);
  if (s < 0.5 && hundredsOk) return between(2, 9, random) * 100 + (random() < 0.5 ? 0 : between(1, 99, random));
  if (s < 0.6) return 100;
  return pickNumber(max, random);
}

/** The rule worth seeing after a number question, the most specific first. */
export function numberNote(n: number, use: NumberUse): string {
  const lastTwo = n % 100;
  const hundreds = Math.floor((n % 1000) / 100);
  if (n >= 1_000_000) return n % 1_000_000 === 0 && use !== "alone" ? "Millón takes un, and de before a noun: un millón de dólares." : "Millón takes un: un millón, dos millones.";
  if (use !== "alone" && lastTwo % 10 === 1 && lastTwo !== 11)
    return use === "m" ? "Uno shortens to un before a masculine noun: un año, veintiún años." : "Uno becomes una before a feminine noun: una casa, treinta y una personas.";
  if (use === "f" && (hundreds >= 2 || Math.floor((n % 1_000_000) / 100_000) >= 2)) return "Hundreds agree with a feminine noun: doscientas personas.";
  if (n % 1000 === 100 || n === 100_000) return "Cien on its own or before a noun, ciento in combinations: ciento cinco.";
  if (hundreds === 1) return "Ciento in combinations, cien on its own: ciento cinco, cien.";
  if ([5, 7, 9].includes(hundreds) || [5, 7, 9].includes(Math.floor((n % 1_000_000) / 100_000))) return "Watch the irregular hundreds: quinientos, setecientos, novecientos.";
  if (n >= 1000 && n < 2000) return "Mil has no un: mil, mil doscientos.";
  if (lastTwo >= 16 && lastTwo <= 29) return "16 to 29 are written as one word: dieciséis, veintidós.";
  if (lastTwo > 30 && lastTwo % 10 !== 0) return "From 31 on, it's tens + y + ones, and y only goes there: treinta y uno, ciento cuarenta y dos.";
  return "Numbers are written as said, with y only between tens and ones.";
}

/** Words that end a group and can't take y after them: the hundreds, mil and millón. */
const BIG = /^(ciento|\S*cient[oa]s|quinient[oa]s|mil|millón|millones)$/;
/** A number word that could follow them. */
const NUMBER_WORD =
  /^(uno?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|dieci\S+|veinti\S+|ciento|\S*cient[oa]s|quinient[oa]s)$/;

export const EXTRA_Y_NOTE = "No y after the hundreds or mil: y only goes between tens and ones. Quinientos seis, mil dos, ciento cuarenta y dos.";
export const SPLIT_TEENS_NOTE = "16 to 29 are written as one word: dieciséis, veintidós. Diez y seis is an old spelling.";

/**
 * Wrong answers worth a note of their own: a y after the hundreds or mil (quinientos y seis, mil y dos), and 16 to 29
 * split up (diez y seis). Anything that is in fact an accepted answer is left out.
 */
export function numberTraps(answers: string[]): { answers: string[]; note: string }[] {
  const extraY = new Set<string>();
  const split = new Set<string>();
  for (const answer of answers) {
    const words = answer.split(" ");
    const spots = words.flatMap((w, i) => (BIG.test(w) && NUMBER_WORD.test(words[i + 1] ?? "") ? [i] : []));
    const withY = (at: number[]) => words.flatMap((w, i) => (at.includes(i) ? [w, "y"] : [w])).join(" ");
    for (const spot of spots) extraY.add(withY([spot]));
    if (spots.length > 1) extraY.add(withY(spots));
    if (words.some((w) => SPLIT_TEENS[w])) split.add(words.map((w) => SPLIT_TEENS[w] ?? w).join(" "));
  }
  const accepted = new Set(answers);
  return [
    { answers: [...extraY].filter((a) => !accepted.has(a)), note: EXTRA_Y_NOTE },
    { answers: [...split].filter((a) => !accepted.has(a)), note: SPLIT_TEENS_NOTE },
  ].filter((t) => t.answers.length > 0);
}

const base = (kind: NumberKind, title: string) => ({
  id: `number:${kind}:${title}`,
  badge: NUMBER_LABELS[kind],
  track: { item: `number:${kind}` },
  // Typed phrases: a capital letter or a final period shouldn't matter.
  loosePunctuation: true,
});

function wordsCard(max: NumberMax, random: Random): Card {
  const n = pickNumber(max, random);
  const answers = numberWords(n);
  return {
    ...base("words", shownNumber(n)),
    title: shownNumber(n),
    titleIsSpanish: false,
    ask: "Write it in words",
    answers,
    shown: answers[0],
    explain: numberNote(n, "alone"),
    wrongNotes: numberTraps(answers),
  };
}

function nounCard(max: NumberMax, random: Random): Card {
  const n = pickNounNumber(max, random);
  const noun = pick(COUNT_NOUNS.filter((c) => n < 1000 || c.big), random);
  const word = n === 1 ? noun.es : noun.plural;
  const title = `${shownNumber(n)} ${word}`;
  const words = numberWords(n, noun.gender);
  // The noun is there for the agreement; typing the number alone is fine too.
  const answers = [...words.map((w) => withNoun(n, w, word)), ...words];
  return {
    ...base("noun", title),
    title,
    titleIsSpanish: true,
    ask: "Write the number in words, with the noun",
    answers,
    shown: answers[0],
    explain: numberNote(n, noun.gender),
    wrongNotes: numberTraps(answers),
  };
}

function digitsCard(max: NumberMax, random: Random): Card {
  const n = pickNumber(max, random);
  const title = numberWords(n)[0];
  return {
    ...base("digits", title),
    loosePunctuation: false,
    title,
    titleIsSpanish: true,
    ask: "Type it in numbers",
    answers: digitForms(n),
    shown: shownNumber(n),
    explain: numberNote(n, "alone"),
  };
}

const ENGLISH_ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
/** Shown with every ordinal answer, so the whole set is there when one is missed. */
const ORDINAL_SERIES = "primero, segundo, tercero, cuarto, quinto, sexto, séptimo, octavo, noveno, décimo";

function ordinalCard(random: Random): Card {
  const noun = pick(COUNT_NOUNS.filter((c) => c.ordinal), random);
  const n = between(1, 10, random);
  // Plurals are natural mostly with first: los primeros días, las primeras semanas.
  const plural = n === 1 && random() < 0.3;
  const article = noun.gender === "m" ? (plural ? "los" : "el") : plural ? "las" : "la";
  const word = ordinalWord(n, noun.gender, plural);
  const nounWord = plural ? noun.plural : noun.es;
  const title = `${article} ___ ${nounWord}`;
  const short = noun.gender === "m" && !plural && (n === 1 || n === 3);
  return {
    ...base("ordinal", `${title}:${n}`),
    title,
    titleIsSpanish: true,
    context: ENGLISH_ORDINALS[n],
    ask: `${ENGLISH_ORDINALS[n]}, agreeing with the noun`,
    answers: [word, `${article} ${word} ${nounWord}`, `${word} ${nounWord}`],
    shown: `${article} ${word} ${nounWord}`,
    explain: `${
      short
        ? "Primero and tercero shorten before a masculine singular noun: el primer día, el tercer piso."
        : "Ordinals agree with the noun: el segundo piso, la segunda calle, las primeras semanas."
    } 1st to 10th: ${ORDINAL_SERIES}.`,
  };
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function dateCard(withYear: boolean, random: Random): Card {
  const month = between(1, 12, random);
  // The 1st is where Latin America and Spain differ, so it comes up more.
  const day = random() < 0.15 ? 1 : between(1, DAYS_IN_MONTH[month - 1], random);
  const year = withYear ? between(1950, 2030, random) : undefined;
  const title = withYear ? `${day}/${month}/${year}` : `${MONTHS_EN[month - 1]} ${day}`;
  const answers = dateWords(day, month, year);
  const notes = [
    day === 1 ? "Latin America says el primero for the 1st; Spain says el uno." : "Dates are el + number + de + month, with no capital.",
    ...(withYear ? ["Written dates put the day first, and years are read as whole numbers."] : []),
  ];
  return {
    ...base(withYear ? "year" : "date", title),
    title,
    titleIsSpanish: false,
    // Spelled out too, since 2/5/1980 reads as February 5 to an American: the point is the words, not decoding it.
    ...(withYear ? { context: `Written day first: ${day} ${MONTHS_EN[month - 1]} ${year}` } : {}),
    ask: "Say the date in words",
    answers,
    shown: answers[0],
    explain: notes.join(" "),
    wrongNotes: numberTraps(answers),
  };
}

function timeCard(random: Random): Card {
  const h = between(1, 12, random);
  // Quarter and half hours, and the countdown past :30, are the ones worth practicing most.
  const m = random() < 0.5 ? pick([0, 15, 30, 45], random) : between(1, 11, random) * 5;
  const title = `${h}:${String(m).padStart(2, "0")}`;
  const answers = timeWords(h, m);
  // The feedback adds the period: "The answer is Son las tres y media."
  const shown = `${answers[0].charAt(0).toUpperCase()}${answers[0].slice(1)}`;
  const note =
    m > 30
      ? "Before the hour: son las ocho menos diez, or in much of Latin America, diez para las ocho."
      : h === 1
        ? "Es la una, and son las for every other hour."
        : m === 15 || m === 30
          ? "Y cuarto for quarter past and y media for half past (y quince and y treinta work too)."
          : "Son las + the hour, then y + the minutes. Es la una for one o'clock.";
  return { ...base("time", title), title, titleIsSpanish: false, ask: "What time is it? In words", answers, shown, explain: note, wrongNotes: numberTraps(answers) };
}

export function numberCard(kind: NumberKind, max: NumberMax, random: Random = Math.random): Card {
  switch (kind) {
    case "words":
      return wordsCard(max, random);
    case "noun":
      return nounCard(max, random);
    case "digits":
      return digitsCard(max, random);
    case "ordinal":
      return ordinalCard(random);
    case "date":
      return dateCard(false, random);
    case "year":
      return dateCard(true, random);
    case "time":
      return timeCard(random);
  }
}

/** Endless, so callers limit it. Kinds take turns at random, and a card asked lately isn't asked again. */
export function numberDeck({ kinds, max }: { kinds: NumberKind[]; max: NumberMax }, random: Random = Math.random): () => Card | null {
  const recent: string[] = [];
  return () => {
    if (kinds.length === 0) return null;
    let card = numberCard(pick(kinds, random), max, random);
    for (let tries = 0; recent.includes(card.id) && tries < 20; tries++) card = numberCard(pick(kinds, random), max, random);
    recent.push(card.id);
    if (recent.length > 30) recent.shift();
    return card;
  };
}
