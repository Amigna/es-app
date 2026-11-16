// Spanish numbers, ordinals, dates and times in words, following the numbers guide. No data files and no Firebase, so
// it's small and safe to load anywhere. Every function returns all accepted answers, the main one first.

/** How the number is used: on its own (counting, dates, years), or before a masculine or feminine noun. */
export type NumberUse = "alone" | "m" | "f";

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
/** The hundreds without their ending, which agrees with the noun: doscientos hombres, doscientas personas. */
const HUNDREDS = ["", "", "doscient", "trescient", "cuatrocient", "quinient", "seiscient", "setecient", "ochocient", "novecient"];

/** 1 and 21 change before a noun: un año, una casa, veintiún años, veintiuna casas. */
function belowThirty(n: number, use: NumberUse): string {
  if (n === 1) return use === "alone" ? "uno" : use === "m" ? "un" : "una";
  if (n === 21) return use === "alone" ? "veintiuno" : use === "m" ? "veintiún" : "veintiuna";
  return UNITS[n];
}

function belowHundred(n: number, use: NumberUse): string {
  if (n < 30) return belowThirty(n, use);
  const units = n % 10;
  return units === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]} y ${belowThirty(units, use)}`;
}

/** 1 to 999. Cien alone, ciento in combinations; the other hundreds agree with a feminine noun. */
function belowThousand(n: number, use: NumberUse): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return belowHundred(rest, use);
  const head = hundreds === 1 ? (rest === 0 ? "cien" : "ciento") : HUNDREDS[hundreds] + (use === "f" ? "as" : "os");
  return rest === 0 ? head : `${head} ${belowHundred(rest, use)}`;
}

/**
 * The thousands in front of mil. Mil counts like a masculine word, so 21,000 is veintiún mil. Before a feminine noun the
 * hundreds still agree (doscientas mil personas), and veintiuna mil is accepted beside veintiún mil.
 */
function thousands(n: number, use: NumberUse): string[] {
  if (n === 1) return ["mil"];
  const main = `${belowThousand(n, use === "f" ? "f" : "m")} mil`;
  const also = use === "f" && n % 10 === 1 && n % 100 !== 11 ? [`${belowThousand(n, "m")} mil`] : [];
  // Before a feminine noun the agreement is what's taught, so veintiuna mil leads; veintiún mil is also right.
  return [main, ...also.filter((a) => a !== main)];
}

/** Each way of writing `n` (0 to 999,999,999) in words, the main one first. Before a noun, add it with `withNoun`. */
export function numberWords(n: number, use: NumberUse = "alone"): string[] {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000_000) throw new Error(`Out of range: ${n}`);
  if (n === 0) return ["cero"];
  const millions = Math.floor(n / 1_000_000);
  const thousandsPart = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  // Millón is a masculine noun: un millón, veintiún millones, doscientos millones de personas.
  const millionWords = millions === 0 ? [""] : [millions === 1 ? "un millón" : `${belowThousand(millions, "m")} millones`];
  const thousandWords = thousandsPart === 0 ? [""] : thousands(thousandsPart, use);
  const restWords = rest === 0 ? "" : belowThousand(rest, use);
  return thousandWords.map((t) => [millionWords[0], t, restWords].filter(Boolean).join(" "));
}

/** A round million takes de before a noun: un millón de dólares. Anything after the millions drops it. */
export function withNoun(n: number, words: string, noun: string): string {
  return n >= 1_000_000 && n % 1_000_000 === 0 ? `${words} de ${noun}` : `${words} ${noun}`;
}

const ORDINALS = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];

/** First to tenth, agreeing with the noun. Primero and tercero shorten before a masculine singular noun. */
export function ordinalWord(n: number, gender: "m" | "f", plural = false): string {
  if (n < 1 || n > 10) throw new Error(`No ordinal for ${n}`);
  const base = ORDINALS[n];
  if (gender === "m" && !plural && (n === 1 || n === 3)) return base.slice(0, -1);
  const stem = gender === "f" ? `${base.slice(0, -1)}a` : base;
  return plural ? `${stem}s` : stem;
}

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * A date as said in Latin America: el quince de junio, el primero de enero (Spain's el uno is accepted too), and the
 * year read as a whole number. From 2000 on, del año is common too: el cinco de mayo del 2024. The el is optional.
 */
export function dateWords(day: number, month: number, year?: number): string[] {
  const days = day === 1 ? ["primero", "uno"] : [numberWords(day)[0]];
  const years = year === undefined ? [""] : year >= 2000 ? [` de ${numberWords(year)[0]}`, ` del ${numberWords(year)[0]}`] : [` de ${numberWords(year)[0]}`];
  const out: string[] = [];
  for (const d of days) for (const y of years) out.push(`el ${d} de ${MONTHS[month - 1]}${y}`);
  return [...out, ...out.map((s) => s.slice(3))];
}

/** "la una" or "las tres". The hour is a feminine count of horas: la una, never el uno. */
const hourPhrase = (h: number) => (h === 1 ? "la una" : `las ${numberWords(h)[0]}`);
const hourVerb = (h: number) => (h === 1 ? "es" : "son");
const next = (h: number) => (h % 12) + 1;

const MINUTE_NAMES: Record<number, string[]> = { 15: ["cuarto", "quince"], 30: ["media", "treinta"] };
const minuteNames = (m: number) => MINUTE_NAMES[m] ?? [numberWords(m)[0]];
const PARTS_OF_DAY = ["de la mañana", "de la tarde", "de la noche", "de la madrugada"];

/**
 * A time on a 12-hour clock, minutes in steps of five, the main answer first: son las tres y media, es la una y cuarto.
 * From :35 on the main answer counts down to the next hour, as the guide teaches (son las ocho menos diez), and
 * Latin America's para forms are accepted (diez para las ocho, faltan diez para las ocho), as is reading the minutes
 * straight (son las siete y cincuenta). Es or son is optional, and so is a part of the day like de la tarde.
 */
export function timeWords(h: number, m: number): string[] {
  if (h < 1 || h > 12 || m < 0 || m > 55 || m % 5 !== 0) throw new Error(`Bad time ${h}:${m}`);
  const said: string[] = [];
  const say = (hour: number, phrase: string) => said.push(`${hourVerb(hour)} ${phrase}`, phrase);
  const up = (names: string[]) => names.forEach((name) => say(h, `${hourPhrase(h)} y ${name}`));
  if (m === 0) {
    say(h, hourPhrase(h));
    say(h, `${hourPhrase(h)} en punto`);
  } else if (m <= 30) up(minuteNames(m));
  else {
    const to = 60 - m;
    const toNames = to === 15 ? ["cuarto", "quince"] : [numberWords(to)[0]];
    const coming = hourPhrase(next(h));
    for (const name of toNames) say(next(h), `${coming} menos ${name}`);
    for (const name of toNames) said.push(`${name} para ${coming}`);
    if (to === 15) said.push(`un cuarto para ${coming}`, `falta un cuarto para ${coming}`, `faltan quince para ${coming}`);
    else said.push(`faltan ${toNames[0]} para ${coming}`);
    up(minuteNames(m));
  }
  const main = [...new Set(said)];
  return [...main, ...main.flatMap((s) => PARTS_OF_DAY.map((p) => `${s} ${p}`))];
}

/** 16 to 29 split into the old three-word spelling, which is now wrong: diez y seis, veinte y dos. */
export const SPLIT_TEENS: Record<string, string> = Object.fromEntries([
  ...UNITS.slice(16, 20).map((w, i) => [w, `diez y ${UNITS[6 + i]}`]),
  ...UNITS.slice(21, 30).map((w, i) => [w, `veinte y ${UNITS[1 + i]}`]),
  ["veintiún", "veinte y un"],
  ["veintiuna", "veinte y una"],
]);

/** Digits as people write them: 1000, 1.000 (Latin America and Spain), 1,000 (Mexico, the US) or 1 000. */
export function digitForms(n: number): string[] {
  const plain = String(n);
  if (n < 1000) return [plain];
  const grouped = (sep: string) => plain.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return [plain, grouped("."), grouped(","), grouped(" ")];
}
