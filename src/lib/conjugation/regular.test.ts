import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conjugate } from "./engine";
import { IRREGULARS } from "./irregulars";
import { markForms, type FormMark } from "./regular";
import type { Boot, TenseId } from "./types";

const SIGN = { stem: "~", spelling: "+", irregular: "*" } as const;

/** Each form shown as stem|ending, or wrapped as ~stem change~, +spelling change+ or *irregular*. */
function show(inf: string, tense: TenseId, boot?: Boot) {
  const c = conjugate({ inf, boot });
  const t = c.tenses[tense]!;
  const marks = markForms(c, boot ?? IRREGULARS[inf.replace(/se$/, "")]?.boot)[tense]!;
  return t.forms.map((f, i) => {
    const m = marks.forms[i] as FormMark | null;
    if (!f || !m) return null;
    return "change" in m ? `${SIGN[m.change]}${f}${SIGN[m.change]}` : `${f.slice(0, m.ending)}|${f.slice(m.ending)}`;
  });
}

describe("regular forms", () => {
  it("splits regular forms into stem and ending", () => {
    assert.deepEqual(show("hablar", "present"), ["habl|o", "habl|as", "habl|a", "habl|amos", "habl|an"]);
    assert.deepEqual(show("comer", "preterite"), ["com|í", "com|iste", "com|ió", "com|imos", "com|ieron"]);
    assert.deepEqual(show("vivir", "future"), ["viv|iré", "viv|irás", "viv|irá", "viv|iremos", "viv|irán"]);
  });

  it("handles compound tenses and reflexive pronouns", () => {
    assert.deepEqual(show("trabajar", "presentPerfect"), ["he trabaj|ado", "has trabaj|ado", "ha trabaj|ado", "hemos trabaj|ado", "han trabaj|ado"]);
    assert.deepEqual(show("levantarse", "present"), ["me levant|o", "te levant|as", "se levant|a", "nos levant|amos", "se levant|an"]);
  });

  it("ignores a stress mark that moves when a pronoun is attached", () => {
    assert.deepEqual(show("levantarse", "impAffirmative"), [null, "levánt|ate", "levánt|ese", "levant|émonos", "levánt|ense"]);
  });

  it("marks ir's regular future with the whole word as the ending", () => {
    assert.deepEqual(show("ir", "imperfect"), ["*iba*", "*ibas*", "*iba*", "*íbamos*", "*iban*"]);
    assert.deepEqual(show("ir", "future"), ["|iré", "|irás", "|irá", "|iremos", "|irán"]);
  });
});

describe("stem changes", () => {
  it("marks the changed forms and leaves the rest regular", () => {
    assert.deepEqual(show("pensar", "present", "e>ie"), ["~pienso~", "~piensas~", "~piensa~", "pens|amos", "~piensan~"]);
    assert.deepEqual(show("volver", "present", "o>ue"), ["~vuelvo~", "~vuelves~", "~vuelve~", "volv|emos", "~vuelven~"]);
    assert.deepEqual(show("pedir", "present", "e>i"), ["~pido~", "~pides~", "~pide~", "ped|imos", "~piden~"]);
    assert.deepEqual(show("jugar", "present", "u>ue"), ["~juego~", "~juegas~", "~juega~", "jug|amos", "~juegan~"]);
  });

  it("includes the narrower change -ir verbs use in the preterite", () => {
    assert.deepEqual(show("dormir", "preterite", "o>ue"), ["dorm|í", "dorm|iste", "~durmió~", "dorm|imos", "~durmieron~"]);
    assert.deepEqual(show("sentir", "preterite", "e>ie"), ["sent|í", "sent|iste", "~sintió~", "sent|imos", "~sintieron~"]);
  });

  it("counts a stem change that also needs a spelling change", () => {
    assert.deepEqual(show("empezar", "subjPresent", "e>ie"), ["~empiece~", "~empieces~", "~empiece~", "+empecemos+", "~empiecen~"]);
    assert.deepEqual(show("seguir", "present", "e>i"), ["~sigo~", "~sigues~", "~sigue~", "segu|imos", "~siguen~"]);
    assert.deepEqual(show("reñir", "preterite", "e>i"), ["reñ|í", "reñ|iste", "~riñó~", "reñ|imos", "~riñeron~"]);
  });

  it("uses the stem change of an irregular verb", () => {
    assert.deepEqual(show("tener", "present"), ["*tengo*", "~tienes~", "~tiene~", "ten|emos", "~tienen~"]);
    assert.deepEqual(show("poder", "present"), ["~puedo~", "~puedes~", "~puede~", "pod|emos", "~pueden~"]);
  });
});

describe("spelling changes and irregulars", () => {
  it("tells spelling changes apart from irregular forms", () => {
    assert.deepEqual(show("buscar", "preterite"), ["+busqué+", "busc|aste", "busc|ó", "busc|amos", "busc|aron"]);
    assert.deepEqual(show("llegar", "preterite")[0], "+llegué+");
    assert.deepEqual(show("coger", "present")[0], "+cojo+");
    assert.deepEqual(show("leer", "preterite")[2], "+leyó+");
    assert.deepEqual(show("averiguar", "preterite")[0], "+averigüé+");
  });

  it("keeps true irregulars irregular", () => {
    assert.deepEqual(show("tener", "preterite"), ["*tuve*", "*tuviste*", "*tuvo*", "*tuvimos*", "*tuvieron*"]);
    assert.deepEqual(show("escribir", "presentPerfect")[0], "*he escrito*");
    assert.deepEqual(show("conocer", "present")[0], "*conozco*");
  });
});
