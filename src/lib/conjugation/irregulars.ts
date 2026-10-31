import { prefixWord } from "./accent";
import type { Spec } from "./types";

// Irregular roots. Derived verbs (detener, prever, sonreír...) reuse these via `like`.
// Only what deviates from the regular rules needs to be listed.
export const IRREGULARS: Record<string, Spec> = {
  ser: {
    present: ["soy", "eres", "es", "somos", "son"],
    presentVos: "sos",
    pret: ["fui", "fuiste", "fue", "fuimos", "fueron"],
    imperfect: ["era", "eras", "era", "éramos", "eran"],
    subj: ["sea", "seas", "sea", "seamos", "sean"],
    subjVos: "seas",
    impTu: "sé",
    impVos: "sé",
    gerund: "siendo",
    participle: "sido",
  },
  ir: {
    present: ["voy", "vas", "va", "vamos", "van"],
    presentVos: "vas",
    pret: ["fui", "fuiste", "fue", "fuimos", "fueron"],
    imperfect: ["iba", "ibas", "iba", "íbamos", "iban"],
    subj: ["vaya", "vayas", "vaya", "vayamos", "vayan"],
    subjVos: "vayas",
    impTu: "ve",
    impVos: "andá",
    impNos: "vamos",
    gerund: "yendo",
    participle: "ido",
  },
  estar: {
    present: ["estoy", "estás", "está", "estamos", "están"],
    presentVos: "estás",
    pretStem: "estuv",
    subj: ["esté", "estés", "esté", "estemos", "estén"],
    subjVos: "estés",
    impTu: "está",
  },
  haber: {
    present: ["he", "has", "ha", "hemos", "han"],
    presentVos: "has",
    pretStem: "hub",
    futStem: "habr",
    subj: ["haya", "hayas", "haya", "hayamos", "hayan"],
    subjVos: "hayas",
    noImperative: true,
  },
  dar: {
    present: ["doy", "das", "da", "damos", "dan"],
    presentVos: "das",
    impVos: "da",
    pret: ["di", "diste", "dio", "dimos", "dieron"],
    subj: ["dé", "des", "dé", "demos", "den"],
    subjVos: "des",
  },
  ver: {
    present: ["veo", "ves", "ve", "vemos", "ven"],
    presentVos: "ves",
    impVos: "ve",
    pret: ["vi", "viste", "vio", "vimos", "vieron"],
    imperfect: ["veía", "veías", "veía", "veíamos", "veían"],
    yoStem: "ve",
    participle: "visto",
  },
  saber: {
    present: ["sé", "sabes", "sabe", "sabemos", "saben"],
    yoStem: "sep",
    pretStem: "sup",
    futStem: "sabr",
  },
  caber: { yoStem: "quep", pretStem: "cup", futStem: "cabr" },
  andar: { pretStem: "anduv" },
  querer: { boot: "e>ie", pretStem: "quis", futStem: "querr" },
  poder: { boot: "o>ue", pretStem: "pud", futStem: "podr", gerund: "pudiendo" },
  poner: { yoStem: "pong", pretStem: "pus", futStem: "pondr", impTu: "pon", participle: "puesto" },
  tener: { boot: "e>ie", yoStem: "teng", pretStem: "tuv", futStem: "tendr", impTu: "ten" },
  venir: { boot: "e>ie", yoStem: "veng", pretStem: "vin", futStem: "vendr", impTu: "ven", gerund: "viniendo" },
  salir: { yoStem: "salg", futStem: "saldr", impTu: "sal" },
  valer: { yoStem: "valg", futStem: "valdr", impTu: "vale" },
  hacer: {
    yoStem: "hag",
    pret: ["hice", "hiciste", "hizo", "hicimos", "hicieron"],
    futStem: "har",
    impTu: "haz",
    participle: "hecho",
  },
  decir: {
    boot: "e>i",
    yoStem: "dig",
    pretStem: "dij",
    futStem: "dir",
    impTu: "di",
    participle: "dicho",
  },
  traer: { yoStem: "traig", pretStem: "traj" },
  caer: { yoStem: "caig" },
  oír: {
    present: ["oigo", "oyes", "oye", "oímos", "oyen"],
    presentVos: "oís",
    yoStem: "oig",
  },
  reír: {
    present: ["río", "ríes", "ríe", "reímos", "ríen"],
    presentVos: "reís",
    pret: ["reí", "reíste", "rió", "reímos", "rieron"],
    subj: ["ría", "rías", "ría", "riamos", "rían"],
    subjVos: "rías",
    impTu: "ríe",
    impVos: "reí",
    gerund: "riendo",
    participle: "reído",
  },
};

// Past participles that only depend on how the infinitive ends (abrir -> reabierto, escribir -> escrito).
export const PARTICIPLE_SUFFIXES: Record<string, string> = {
  abrir: "abierto",
  cubrir: "cubierto",
  scribir: "scrito",
  solver: "suelto",
  volver: "vuelto",
  romper: "roto",
  morir: "muerto",
};

const STEM_FIELDS = ["yoStem", "pretStem", "futStem"] as const;
const WORD_FIELDS = ["impTu", "impVos", "impNos", "gerund", "participle", "presentVos", "subjVos"] as const;
const LIST_FIELDS = ["present", "pret", "imperfect", "subj"] as const;

/** Prepends a derivational prefix (con + tener) to every form in a spec. */
export function applyPrefix(spec: Spec, prefix: string): Spec {
  if (!prefix) return spec;
  const out: Spec = { ...spec };
  for (const f of STEM_FIELDS) if (spec[f]) out[f] = prefix + spec[f];
  for (const f of WORD_FIELDS) if (spec[f]) out[f] = prefixWord(prefix, spec[f]!);
  for (const f of LIST_FIELDS) if (spec[f]) out[f] = spec[f]!.map((w) => prefixWord(prefix, w));
  return out;
}
