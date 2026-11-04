import { accentLastVowel, attachEnclitic, tidy } from "./accent";
import { DOUBLE_PARTICIPLES, IRREGULARS, PARTICIPLE_SUFFIXES, applyPrefix } from "./irregulars";
import type { Boot, Conjugation, Spec, TenseForms, TenseId, VerbInput } from "./types";

// Regional target: Latin American / Caribbean Spanish. "ustedes" shares the 3rd-person plural
// slot (there is no vosotros) and voseo is exposed as an extra `vos` form where it differs.

type Kind = "ar" | "er" | "ir";

const PRESENT_END: Record<Kind, string[]> = {
  ar: ["o", "as", "a", "amos", "an"],
  er: ["o", "es", "e", "emos", "en"],
  ir: ["o", "es", "e", "imos", "en"],
};
const VOS_END: Record<Kind, string> = { ar: "ás", er: "és", ir: "ís" };
const PRET_END: Record<Kind, string[]> = {
  ar: ["é", "aste", "ó", "amos", "aron"],
  er: ["í", "iste", "ió", "imos", "ieron"],
  ir: ["í", "iste", "ió", "imos", "ieron"],
};
const IMPERFECT_END: Record<Kind, string[]> = {
  ar: ["aba", "abas", "aba", "ábamos", "aban"],
  er: ["ía", "ías", "ía", "íamos", "ían"],
  ir: ["ía", "ías", "ía", "íamos", "ían"],
};
const FUTURE_END = ["é", "ás", "á", "emos", "án"];
const CONDITIONAL_END = ["ía", "ías", "ía", "íamos", "ían"];
const STRONG_PRET_END = ["e", "iste", "o", "imos", "ieron"];
const SUBJ_END: Record<Kind, string[]> = {
  ar: ["e", "es", "e", "emos", "en"],
  er: ["a", "as", "a", "amos", "an"],
  ir: ["a", "as", "a", "amos", "an"],
};
const SUBJ_VOS_END: Record<Kind, string> = { ar: "és", er: "ás", ir: "ás" };
const CLITICS = ["me", "te", "se", "nos", "se"];

// The -ir stem changes of the preterite, gerund and nosotros subjunctive (dormir -> durmió).
export const IR_CHANGE: Partial<Record<Boot, string>> = { "e>ie": "e>i", "e>i": "e>i", "o>ue": "o>u" };
const NO_ZC = new Set(["mecer", "remecer", "cocer", "escocer", "recocer"]);

export function applyChange(stem: string, change: string): string {
  const [from, to] = change.split(">");
  const i = stem.lastIndexOf(from);
  return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + 1);
}

function accentStem(stem: string, vowel: "i" | "u"): string {
  const i = stem.lastIndexOf(vowel);
  return i < 0 ? stem : stem.slice(0, i) + (vowel === "i" ? "í" : "ú") + stem.slice(i + 1);
}

/** stem + ending with the spelling changes that keep the sound (busc-é -> busqué, venc-o -> venzo). */
function join(stem: string, ending: string, inf: string): string {
  const c = ending[0];
  let s = stem;
  if ("eé".includes(c)) {
    if (inf.endsWith("car") && s.endsWith("c")) s = s.slice(0, -1) + "qu";
    else if (inf.endsWith("guar") && s.endsWith("gu")) s = s.slice(0, -2) + "gü";
    else if (inf.endsWith("gar") && s.endsWith("g")) s += "u";
    else if (inf.endsWith("zar") && s.endsWith("z")) s = s.slice(0, -1) + "c";
  } else if ("aáoó".includes(c)) {
    if (/c[ei]r$/.test(inf) && s.endsWith("c")) s = s.slice(0, -1) + "z";
    else if (/g[ei]r$/.test(inf) && s.endsWith("g")) s = s.slice(0, -1) + "j";
    else if (inf.endsWith("guir") && s.endsWith("gu")) s = s.slice(0, -1);
    else if (inf.endsWith("quir") && s.endsWith("qu")) s = s.slice(0, -2) + "c";
  }
  return s + ending;
}

/** Endings that start with i: i becomes y between vowels (leyó), disappears after ñ/ll/j (riñó), and takes an accent in hiatus (leíste). */
function joinI(stem: string, ending: string, strongPret = false): string {
  const last = stem[stem.length - 1];
  const glide = ending.startsWith("ió") || ending.startsWith("ie");
  if (glide) {
    const beforeU = stem[stem.length - 2] ?? "";
    if ("aeo".includes(last) || (last === "u" && !"gq".includes(beforeU))) return stem + "y" + ending.slice(1);
    if (last === "ñ" || stem.endsWith("ll") || (strongPret && last === "j")) return stem + ending.slice(1);
  } else if ("aeo".includes(last)) {
    return stem + "í" + ending.slice(1);
  }
  return stem + ending;
}

interface Simple {
  present: TenseForms;
  preterite: TenseForms;
  imperfect: TenseForms;
  future: TenseForms;
  conditional: TenseForms;
  subjPresent: TenseForms;
  subjImperfect: TenseForms;
  subjImperfectSe: TenseForms;
  impAffirmative: TenseForms;
  impNegative: TenseForms;
  gerund: string;
  participle: string;
  participleAlt?: string;
}

function simple(input: VerbInput): Simple {
  const inf = input.inf;
  const type: Kind = inf.endsWith("ar") ? "ar" : inf.endsWith("er") ? "er" : "ir"; // "ir" also covers -ír
  const base = inf.slice(0, -2);

  const rootKey = input.like ?? inf;
  let spec: Spec = IRREGULARS[rootKey] ?? {};
  if (input.like) spec = applyPrefix(spec, inf.slice(0, inf.length - input.like.length));

  const boot = input.boot ?? spec.boot;
  const bootStem = boot ? applyChange(base, boot) : base;
  const changeKey = boot ? IR_CHANGE[boot] : undefined;
  const irStem = type === "ir" && changeKey ? applyChange(base, changeKey) : base;
  const hiatusStem = input.accent ? accentStem(bootStem, input.accent) : bootStem;
  const uirY = /[^gq]uir$/.test(inf) ? base + "y" : null;

  let rawYo = spec.yoStem ?? null;
  if (!rawYo && !NO_ZC.has(inf) && /([aeo]cer|ucir)$/.test(inf)) rawYo = base.slice(0, -1) + "zc";

  // ---- present
  let present: TenseForms;
  if (spec.present) {
    present = { forms: spec.present, vos: spec.presentVos ?? join(base, VOS_END[type], inf) };
  } else {
    const e = PRESENT_END[type];
    const strong = uirY ?? hiatusStem;
    present = {
      forms: [
        rawYo ? rawYo + "o" : join(strong, e[0], inf),
        join(strong, e[1], inf),
        join(strong, e[2], inf),
        join(base, e[3], inf),
        join(strong, e[4], inf),
      ],
      vos: spec.presentVos ?? join(base, VOS_END[type], inf),
    };
  }

  // ---- present subjunctive
  let subjPresent: TenseForms;
  if (spec.subj) {
    subjPresent = { forms: spec.subj, vos: spec.subjVos ?? spec.subj[1] };
  } else {
    const e = SUBJ_END[type];
    const stemA = rawYo ?? uirY ?? hiatusStem;
    const stemB = rawYo ?? uirY ?? irStem;
    const make = (stem: string, ending: string) => (rawYo ? stem + ending : join(stem, ending, inf));
    subjPresent = {
      forms: [make(stemA, e[0]), make(stemA, e[1]), make(stemA, e[2]), make(stemB, e[3]), make(stemA, e[4])],
      vos: spec.subjVos ?? make(stemB, SUBJ_VOS_END[type]),
    };
  }

  // ---- preterite
  let preterite: TenseForms;
  if (spec.pret) {
    preterite = { forms: spec.pret };
  } else if (spec.pretStem) {
    const s = spec.pretStem;
    preterite = {
      forms: [
        s + STRONG_PRET_END[0],
        s + STRONG_PRET_END[1],
        s + STRONG_PRET_END[2],
        s + STRONG_PRET_END[3],
        joinI(s, STRONG_PRET_END[4], true),
      ],
    };
  } else if (/ducir$/.test(inf)) {
    const s = base.slice(0, -1) + "j";
    preterite = {
      forms: [s + "e", s + "iste", s + "o", s + "imos", joinI(s, "ieron", true)],
    };
  } else if (type === "ar") {
    const e = PRET_END.ar;
    preterite = { forms: [join(base, e[0], inf), base + e[1], base + e[2], base + e[3], base + e[4]] };
  } else {
    const e = PRET_END[type];
    preterite = {
      forms: [base + e[0], joinI(base, e[1]), joinI(irStem, e[2]), joinI(base, e[3]), joinI(irStem, e[4])],
    };
  }

  // ---- imperfect
  const imperfect: TenseForms = {
    forms: spec.imperfect ?? IMPERFECT_END[type].map((end) => base + end),
  };

  // ---- future / conditional
  const futStem = spec.futStem ?? inf.replace("ír", "ir");
  const future: TenseForms = { forms: FUTURE_END.map((end) => futStem + end) };
  const conditional: TenseForms = { forms: CONDITIONAL_END.map((end) => futStem + end) };

  // ---- imperfect subjunctive, derived from the 3rd-person plural preterite
  const pret3 = preterite.forms[4]!;
  const ranStem = pret3.endsWith("ron") ? pret3.slice(0, -3) : pret3;
  const accented = accentLastVowel(ranStem);
  const subjImperfect: TenseForms = {
    forms: [ranStem + "ra", ranStem + "ras", ranStem + "ra", accented + "ramos", ranStem + "ran"],
  };
  const subjImperfectSe: TenseForms = {
    forms: [ranStem + "se", ranStem + "ses", ranStem + "se", accented + "semos", ranStem + "sen"],
  };

  // ---- gerund / participle
  const gerund = spec.gerund ?? (type === "ar" ? base + "ando" : joinI(irStem, "iendo"));
  let participle = spec.participle;
  if (!participle) {
    for (const [suffix, form] of Object.entries(PARTICIPLE_SUFFIXES)) {
      if (inf.endsWith(suffix)) {
        participle = inf.slice(0, inf.length - suffix.length) + form;
        break;
      }
    }
  }
  participle ??= type === "ar" ? base + "ado" : base + ("aeo".includes(base[base.length - 1]) ? "ído" : "ido");
  let participleAlt: string | undefined;
  for (const [suffix, [main, also]] of Object.entries(DOUBLE_PARTICIPLES)) {
    if (inf.endsWith(suffix)) {
      const prefix = inf.slice(0, inf.length - suffix.length);
      participle = prefix + main;
      participleAlt = prefix + also;
      break;
    }
  }

  // ---- imperative
  const none: TenseForms = { forms: [null, null, null, null, null], vos: null };
  let impAffirmative = none;
  let impNegative = none;
  if (!spec.noImperative) {
    const vosForm = spec.impVos ?? accentLastVowel(inf.slice(0, -1));
    impAffirmative = {
      forms: [null, spec.impTu ?? present.forms[2], subjPresent.forms[2], spec.impNos ?? subjPresent.forms[3], subjPresent.forms[4]],
      vos: vosForm,
    };
    impNegative = {
      forms: [null, ...[1, 2, 3, 4].map((i) => "no " + subjPresent.forms[i])],
      vos: "no " + subjPresent.vos,
    };
  }

  return {
    present,
    preterite,
    imperfect,
    future,
    conditional,
    subjPresent,
    subjImperfect,
    subjImperfectSe,
    impAffirmative,
    impNegative,
    gerund,
    participle,
    ...(participleAlt ? { participleAlt } : {}),
  };
}

let haberCache: Simple | undefined;
const haber = () => (haberCache ??= simple({ inf: "haber" }));

function compound(aux: TenseForms, participle: string, withVos = false): TenseForms {
  return {
    forms: aux.forms.map((f) => (f ? `${f} ${participle}` : null)),
    ...(withVos && aux.vos ? { vos: `${aux.vos} ${participle}` } : {}),
  };
}

function withClitics(id: TenseId, t: TenseForms): TenseForms {
  if (id === "impAffirmative") {
    const [, tu, usted, nos, ustedes] = t.forms;
    return {
      forms: [
        null,
        attachEnclitic(tu!, "te"),
        attachEnclitic(usted!, "se"),
        attachEnclitic(nos!.slice(0, -1), "nos"),
        attachEnclitic(ustedes!, "se"),
      ],
      vos: t.vos ? attachEnclitic(t.vos, "te") : t.vos,
    };
  }
  if (id === "impNegative") {
    const put = (f: string | null | undefined, c: string) => (f ? `no ${c} ${f.slice(3)}` : f ?? null);
    return {
      forms: t.forms.map((f, i) => (i === 0 ? null : put(f, CLITICS[i]))),
      vos: put(t.vos, "te"),
    };
  }
  return {
    forms: t.forms.map((f, i) => (f ? `${CLITICS[i]} ${f}` : null)),
    vos: t.vos ? `te ${t.vos}` : t.vos,
  };
}

export function conjugate(input: VerbInput): Conjugation {
  const reflexive = input.inf.endsWith("se");
  const inf = reflexive ? input.inf.slice(0, -2) : input.inf;
  const s = simple({ ...input, inf });
  const hab = haber();

  const tenses: Partial<Record<TenseId, TenseForms>> = {
    present: s.present,
    preterite: s.preterite,
    imperfect: s.imperfect,
    future: s.future,
    conditional: s.conditional,
    presentPerfect: compound(hab.present, s.participle),
    pluperfect: compound(hab.imperfect, s.participle),
    futurePerfect: compound(hab.future, s.participle),
    conditionalPerfect: compound(hab.conditional, s.participle),
    subjPresent: s.subjPresent,
    subjImperfect: s.subjImperfect,
    subjImperfectSe: s.subjImperfectSe,
    subjPresentPerfect: compound(hab.subjPresent, s.participle),
    subjPluperfect: compound(hab.subjImperfect, s.participle),
    impAffirmative: s.impAffirmative,
    impNegative: s.impNegative,
  };

  if (reflexive) {
    for (const id of Object.keys(tenses) as TenseId[]) {
      const t = tenses[id]!;
      if (id === "impAffirmative" || id === "impNegative") {
        if (t.forms[1] === null) continue;
      }
      tenses[id] = withClitics(id, t);
    }
  }

  for (const id of Object.keys(tenses) as TenseId[]) {
    const t = tenses[id]!;
    tenses[id] = { forms: t.forms.map((f) => (f ? tidy(f) : f)), ...(t.vos !== undefined ? { vos: t.vos ? tidy(t.vos) : t.vos } : {}) };
  }

  return {
    infinitive: reflexive ? attachEnclitic(inf, "se") : inf,
    reflexive,
    gerund: tidy(reflexive ? attachEnclitic(s.gerund, "se") : s.gerund),
    participle: tidy(s.participle),
    ...(s.participleAlt ? { participleAlt: tidy(s.participleAlt) } : {}),
    tenses,
  };
}

/** The same compound form with the other accepted participle (había impreso -> había imprimido), or nothing. */
export function alsoAccepted(c: Conjugation, form: string): string[] {
  if (!c.participleAlt) return [];
  const words = form.split(" ");
  if (words.length < 2 || words[words.length - 1].toLowerCase() !== c.participle) return [];
  return [[...words.slice(0, -1), c.participleAlt].join(" ")];
}
