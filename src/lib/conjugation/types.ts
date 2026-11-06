export type Boot = "e>ie" | "o>ue" | "o>hue" | "e>ye" | "e>i" | "u>ue" | "i>ie";

/** What the seed file says about a verb; everything else is inferred from the infinitive. */
export interface VerbInput {
  inf: string;
  boot?: Boot;
  /** Hiatus verbs: enviar -> envío ("i"), continuar -> continúo ("u"). */
  accent?: "i" | "u";
  /** Conjugate like this irregular root, e.g. contener -> "tener". */
  like?: string;
}

/** Per-verb irregularities. Stems are plain strings; word fields are whole forms. */
export interface Spec {
  boot?: Boot;
  yoStem?: string; // present yo = yoStem + o; also the stem of the whole present subjunctive
  pretStem?: string; // strong preterite: stem + e, iste, o, imos, ieron
  futStem?: string;
  present?: string[];
  presentVos?: string;
  pret?: string[];
  imperfect?: string[];
  subj?: string[];
  subjVos?: string;
  impTu?: string;
  impVos?: string;
  impNos?: string;
  gerund?: string;
  participle?: string;
  noImperative?: boolean;
}

export type TenseId =
  | "present"
  | "preterite"
  | "imperfect"
  | "future"
  | "conditional"
  | "presentPerfect"
  | "pluperfect"
  | "futurePerfect"
  | "conditionalPerfect"
  | "subjPresent"
  | "subjImperfect"
  | "subjImperfectSe"
  | "subjPresentPerfect"
  | "subjPluperfect"
  | "impAffirmative"
  | "impNegative";

export type Mood = "indicative" | "subjunctive" | "imperative";

/** Slots: 0 yo, 1 tú, 2 él/ella/usted, 3 nosotros, 4 ellos/ellas/ustedes. `vos` is the optional voseo form. */
export interface TenseForms {
  forms: (string | null)[];
  vos?: string | null;
}

export interface Conjugation {
  infinitive: string;
  reflexive: boolean;
  gerund: string;
  participle: string;
  /** A second participle that's also correct, like imprimido beside impreso. Shown as an aside and accepted in drills. */
  participleAlt?: string;
  tenses: Partial<Record<TenseId, TenseForms>>;
}

export interface TenseMeta {
  id: TenseId;
  mood: Mood;
  name: string;
  spanish: string;
  hint: string;
}

export const TENSES: TenseMeta[] = [
  { id: "present", mood: "indicative", name: "Present", spanish: "Presente", hint: "What happens now or habitually" },
  { id: "preterite", mood: "indicative", name: "Preterite", spanish: "Pretérito", hint: "A completed action in the past" },
  { id: "imperfect", mood: "indicative", name: "Imperfect", spanish: "Imperfecto", hint: "Ongoing or habitual past; \"used to\"" },
  { id: "future", mood: "indicative", name: "Future", spanish: "Futuro", hint: "What will happen" },
  { id: "conditional", mood: "indicative", name: "Conditional", spanish: "Condicional", hint: "What would happen" },
  { id: "presentPerfect", mood: "indicative", name: "Present perfect", spanish: "Pretérito perfecto", hint: "Has/have done" },
  { id: "pluperfect", mood: "indicative", name: "Pluperfect / Past perfect", spanish: "Pluscuamperfecto", hint: "Had done" },
  { id: "futurePerfect", mood: "indicative", name: "Future perfect", spanish: "Futuro perfecto", hint: "Will have done" },
  { id: "conditionalPerfect", mood: "indicative", name: "Conditional perfect", spanish: "Condicional perfecto", hint: "Would have done" },
  { id: "subjPresent", mood: "subjunctive", name: "Present subjunctive", spanish: "Presente de subjuntivo", hint: "Wishes, doubts, emotions about the present or future" },
  { id: "subjImperfect", mood: "subjunctive", name: "Imperfect subjunctive (-ra)", spanish: "Imperfecto de subjuntivo (-ra)", hint: "Hypotheticals and past wishes; the common form" },
  { id: "subjImperfectSe", mood: "subjunctive", name: "Imperfect subjunctive (-se)", spanish: "Imperfecto de subjuntivo (-se)", hint: "Same meaning as -ra; more literary" },
  { id: "subjPresentPerfect", mood: "subjunctive", name: "Present perfect subjunctive", spanish: "Pretérito perfecto de subjuntivo", hint: "Subjunctive for something that has happened" },
  { id: "subjPluperfect", mood: "subjunctive", name: "Pluperfect / Past perfect subjunctive", spanish: "Pluscuamperfecto de subjuntivo", hint: "Contrary-to-fact past: \"if I had...\"" },
  { id: "impAffirmative", mood: "imperative", name: "Affirmative imperative", spanish: "Imperativo afirmativo", hint: "Commands: do it!" },
  { id: "impNegative", mood: "imperative", name: "Negative imperative", spanish: "Imperativo negativo", hint: "Commands: don't do it!" },
];
