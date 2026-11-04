import { stripAccents } from "./accent";
import { IR_CHANGE, applyChange, conjugate } from "./engine";
import { IRREGULARS } from "./irregulars";
import type { Boot, Conjugation, TenseForms, TenseId } from "./types";
import type { Verb } from "../verbs";

/** How a form compares with the regular pattern. */
export type Change = "spelling" | "stem" | "irregular";

/** Where a regular form's ending starts, or how the form departs from the pattern. */
export type FormMark = { ending: number } | { change: Change };
export type TenseMarks = { forms: (FormMark | null)[]; vos?: FormMark | null };

// Each verb is compared with a regular model of its type, with the model's stem swapped for its own.
const MODELS = { ar: "habl", er: "com", ir: "viv" } as const;
type VerbType = keyof typeof MODELS;

const models = new Map<string, Conjugation>();
function model(type: VerbType, reflexive: boolean) {
  const inf = MODELS[type] + type + (reflexive ? "se" : "");
  if (!models.has(inf)) models.set(inf, conjugate({ inf }));
  return models.get(inf)!;
}

function parts(infinitive: string) {
  const base = stripAccents(infinitive.replace(/se$/, ""));
  const type: VerbType = base.endsWith("ar") ? "ar" : base.endsWith("er") ? "er" : "ir";
  return { stem: base.slice(0, -2), type };
}

/**
 * Spellings that keep a sound when the ending changes are written the same way here, so busqué
 * matches busce, llegue matches llege, cojo matches cogo, sigo matches siguo, leyó matches leió
 * and riñó matches riñió.
 */
const canon = (s: string) =>
  s
    .replace(/gü/g, "gu")
    .replace(/qu(?=[ei])/g, "c")
    .replace(/gu(?=[aeio])/g, "g")
    .replace(/z/g, "c")
    .replace(/j/g, "g")
    .replace(/([aeiou])y(?=[aeiou])/g, "$1i")
    .replace(/(ñ|ll)i(?=[aeo])/g, "$1");

/**
 * Compares a form with the regular model. Written accents are ignored, so a stress mark that moves
 * (levántate) isn't flagged. Then it tries spelling changes alone, then with the verb's stem change.
 */
function mark(
  form: string | null | undefined,
  modelForm: string | null | undefined,
  modelStem: string,
  stem: string,
  changedStems: string[],
): FormMark | null {
  if (!form) return null;
  if (!modelForm) return { change: "irregular" };
  const plainModel = stripAccents(modelForm);
  const at = plainModel.lastIndexOf(modelStem);
  if (at < 0) return { change: "irregular" };
  const withStem = (s: string) => plainModel.slice(0, at) + s + plainModel.slice(at + modelStem.length);
  const plainForm = stripAccents(form);
  if (withStem(stem) === plainForm) return { ending: at + stem.length };
  if (canon(withStem(stem)) === canon(plainForm)) return { change: "spelling" };
  if (changedStems.some((s) => canon(withStem(s)) === canon(plainForm))) return { change: "stem" };
  return { change: "irregular" };
}

/**
 * Marks every form of a conjugation. `boot` is the verb's stem change, if any; -ir verbs also get
 * the narrower change some of their forms use (pidió, durmió).
 */
export function markForms(conjugation: Conjugation, boot?: Boot): Partial<Record<TenseId, TenseMarks>> {
  const { stem, type } = parts(conjugation.infinitive);
  const reference = model(type, conjugation.reflexive);
  const modelStem = MODELS[type];
  const changes = boot ? [boot, ...(type === "ir" && IR_CHANGE[boot] ? [IR_CHANGE[boot]] : [])] : [];
  const changedStems = changes.map((c) => applyChange(stem, c)).filter((s) => s !== stem);
  const out: Partial<Record<TenseId, TenseMarks>> = {};
  for (const [id, t] of Object.entries(conjugation.tenses) as [TenseId, TenseForms][]) {
    const ref = reference.tenses[id];
    out[id] = {
      forms: t.forms.map((f, i) => mark(f, ref?.forms[i], modelStem, stem, changedStems)),
      ...(t.vos !== undefined ? { vos: mark(t.vos, ref?.vos, modelStem, stem, changedStems) } : {}),
    };
  }
  return out;
}

/** The marks for a verb from the list, taking its stem change from the verb or the irregular it's modeled on. */
export function markVerb(verb: Verb, conjugation: Conjugation = conjugate(verb)): Partial<Record<TenseId, TenseMarks>> {
  return markForms(conjugation, verb.boot ?? IRREGULARS[verb.like ?? verb.inf.replace(/se$/, "")]?.boot);
}

/** A verb's group in the verb list: any irregular form wins, then any stem change. Spelling changes count as regular. */
export type VerbGroup = "irregular" | "stem" | "regular";

export function verbGroup(verb: Verb): VerbGroup {
  let stem = false;
  for (const t of Object.values(markVerb(verb))) {
    for (const m of [...t.forms, t.vos]) {
      if (!m || !("change" in m)) continue;
      if (m.change === "irregular") return "irregular";
      if (m.change === "stem") stem = true;
    }
  }
  return stem ? "stem" : "regular";
}
