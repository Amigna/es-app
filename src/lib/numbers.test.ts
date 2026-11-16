import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import nouns from "../data/vocab/nouns.json";
import { gradeCard, wrongNote } from "./drill";
import { NUMBER_KINDS } from "./drill-settings";
import { COUNT_NOUNS, EXTRA_Y_NOTE, SPLIT_TEENS_NOTE, numberCard, numberDeck, numberTraps, pickNumber } from "./number-cards";
import { dateWords, digitForms, numberWords, ordinalWord, timeWords, withNoun } from "./numbers";

// Hand-checked against the numbers guide and the RAE's rules for numerals.

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

describe("numberWords", () => {
  const cases: [number, string][] = [
    [0, "cero"],
    [1, "uno"],
    [15, "quince"],
    [16, "dieciséis"],
    [21, "veintiuno"],
    [22, "veintidós"],
    [23, "veintitrés"],
    [26, "veintiséis"],
    [30, "treinta"],
    [31, "treinta y uno"],
    [99, "noventa y nueve"],
    [100, "cien"],
    [101, "ciento uno"],
    [115, "ciento quince"],
    [200, "doscientos"],
    [500, "quinientos"],
    [537, "quinientos treinta y siete"],
    [700, "setecientos"],
    [704, "setecientos cuatro"],
    [900, "novecientos"],
    [999, "novecientos noventa y nueve"],
    [1000, "mil"],
    [1001, "mil uno"],
    [1100, "mil cien"],
    [1990, "mil novecientos noventa"],
    [2026, "dos mil veintiséis"],
    [21000, "veintiún mil"],
    [100000, "cien mil"],
    [101000, "ciento un mil"],
    [500500, "quinientos mil quinientos"],
    [999999, "novecientos noventa y nueve mil novecientos noventa y nueve"],
    [1000000, "un millón"],
    [2000000, "dos millones"],
    [21000000, "veintiún millones"],
    [1200000, "un millón doscientos mil"],
  ];
  for (const [n, words] of cases) it(`${n} is ${words}`, () => assert.equal(numberWords(n)[0], words));

  it("shortens or changes uno before a noun", () => {
    assert.equal(numberWords(1, "m")[0], "un");
    assert.equal(numberWords(1, "f")[0], "una");
    assert.equal(numberWords(21, "m")[0], "veintiún");
    assert.equal(numberWords(21, "f")[0], "veintiuna");
    assert.equal(numberWords(31, "f")[0], "treinta y una");
    assert.equal(numberWords(101, "m")[0], "ciento un");
  });

  it("makes the hundreds agree with a feminine noun, into the thousands", () => {
    assert.equal(numberWords(200, "f")[0], "doscientas");
    assert.equal(numberWords(200, "m")[0], "doscientos");
    assert.equal(numberWords(555, "f")[0], "quinientas cincuenta y cinco");
    assert.equal(numberWords(200000, "f")[0], "doscientas mil");
    assert.equal(numberWords(100, "f")[0], "cien");
  });

  it("accepts veintiún mil as well as veintiuna mil before a feminine noun", () => {
    assert.deepEqual(numberWords(21000, "f"), ["veintiuna mil", "veintiún mil"]);
    assert.deepEqual(numberWords(21000, "m"), ["veintiún mil"]);
  });

  it("keeps millón masculine, with de only after a round million", () => {
    assert.equal(withNoun(1000000, numberWords(1000000, "f")[0], "personas"), "un millón de personas");
    assert.equal(withNoun(200000000, numberWords(200000000, "f")[0], "personas"), "doscientos millones de personas");
    assert.equal(withNoun(1200000, numberWords(1200000, "f")[0], "personas"), "un millón doscientas mil personas");
    assert.equal(withNoun(200, numberWords(200, "f")[0], "personas"), "doscientas personas");
  });

  it("never writes 16 to 29 as diez y or veinte y", () => {
    for (let n = 16; n <= 29; n++) assert.ok(!numberWords(n)[0].includes(" "), numberWords(n)[0]);
  });
});

describe("ordinals", () => {
  it("agree with the noun, and primero and tercero shorten before a masculine singular", () => {
    assert.equal(ordinalWord(1, "m"), "primer");
    assert.equal(ordinalWord(3, "m"), "tercer");
    assert.equal(ordinalWord(1, "f"), "primera");
    assert.equal(ordinalWord(3, "f"), "tercera");
    assert.equal(ordinalWord(2, "f"), "segunda");
    assert.equal(ordinalWord(4, "m"), "cuarto");
    assert.equal(ordinalWord(7, "f"), "séptima");
    assert.equal(ordinalWord(10, "m"), "décimo");
    assert.equal(ordinalWord(1, "m", true), "primeros");
    assert.equal(ordinalWord(1, "f", true), "primeras");
  });
});

describe("dates", () => {
  it("say el + number + de + month, with primero for the 1st", () => {
    assert.equal(dateWords(15, 6)[0], "el quince de junio");
    assert.equal(dateWords(1, 1)[0], "el primero de enero");
    assert.ok(dateWords(1, 1).includes("el uno de enero"));
    assert.ok(dateWords(21, 3).includes("veintiuno de marzo"));
    assert.equal(dateWords(10, 6, 1990)[0], "el diez de junio de mil novecientos noventa");
    assert.ok(dateWords(5, 5, 2024).includes("el cinco de mayo del dos mil veinticuatro"));
    assert.ok(!dateWords(5, 5, 1999).some((d) => d.includes(" del ")));
  });
});

describe("times", () => {
  const main = (h: number, m: number) => timeWords(h, m)[0];
  it("use es la una and son las, with y for minutes past", () => {
    assert.equal(main(1, 0), "es la una");
    assert.equal(main(3, 0), "son las tres");
    assert.equal(main(2, 10), "son las dos y diez");
    assert.equal(main(4, 30), "son las cuatro y media");
    assert.equal(main(5, 15), "son las cinco y cuarto");
    assert.equal(main(1, 15), "es la una y cuarto");
  });

  it("count down to the next hour after :30, and accept para and the straight reading", () => {
    assert.equal(main(7, 50), "son las ocho menos diez");
    assert.equal(main(12, 45), "es la una menos cuarto");
    const all = timeWords(7, 50);
    for (const ok of ["diez para las ocho", "faltan diez para las ocho", "son las siete y cincuenta", "las ocho menos diez"]) assert.ok(all.includes(ok), ok);
    const quarter = timeWords(2, 45);
    for (const ok of ["un cuarto para las tres", "son las dos y cuarenta y cinco", "son las tres menos quince"]) assert.ok(quarter.includes(ok), ok);
  });

  it("accept en punto, y quince and y treinta, and a part of the day", () => {
    assert.ok(timeWords(3, 0).includes("son las tres en punto"));
    assert.ok(timeWords(5, 15).includes("son las cinco y quince"));
    assert.ok(timeWords(4, 30).includes("son las cuatro y treinta"));
    assert.ok(timeWords(8, 0).includes("son las ocho de la mañana"));
    assert.ok(!timeWords(1, 0).includes("son la una"));
  });
});

describe("digits", () => {
  it("accept the usual ways of grouping thousands", () => {
    assert.deepEqual(digitForms(704), ["704"]);
    assert.deepEqual(digitForms(21000), ["21000", "21.000", "21,000", "21 000"]);
    assert.deepEqual(digitForms(1000000), ["1000000", "1.000.000", "1,000,000", "1 000 000"]);
  });
});

describe("number cards", () => {
  it("use nouns from the word lists, with the same gender", () => {
    const listed = new Map((nouns as { es: string; gender: string }[]).map((n) => [n.es, n.gender]));
    for (const n of COUNT_NOUNS) assert.equal(listed.get(n.es), n.gender, n.es);
  });

  it("keep numbers within the range", () => {
    const random = seeded(7);
    for (const max of [100, 1000, 1000000] as const) {
      for (let i = 0; i < 500; i++) {
        const n = pickNumber(max, random);
        assert.ok(n >= 1 && n <= max, `${n} > ${max}`);
      }
    }
  });

  it("grade their own main answer right, and ignore capitals and a final period", () => {
    const random = seeded(3);
    for (const kind of NUMBER_KINDS) {
      for (let i = 0; i < 40; i++) {
        const card = numberCard(kind, 1000000, random);
        assert.equal(gradeCard(card, card.answers[0]), "correct", `${kind}: ${card.title}`);
        assert.equal(gradeCard(card, card.shown), "correct", `${kind} shown: ${card.shown}`);
        if (kind !== "digits") assert.equal(gradeCard(card, `${card.answers[0].toUpperCase()}.`), "correct", card.answers[0]);
        assert.ok(card.explain, card.title);
        // The feedback adds its own period after the answer.
        assert.ok(!card.shown.endsWith("."), card.shown);
        assert.equal(card.track?.item, `number:${kind}`);
      }
    }
  });

  it("count a missing accent as a slip and a wrong agreement as wrong", () => {
    const card = { ...numberCard("words", 100, () => 0), answers: ["dieciséis"], shown: "dieciséis" };
    assert.equal(gradeCard(card, "dieciseis"), "accent");
    assert.equal(gradeCard(card, "diez y seis"), "wrong");
  });

  it("explain a y after the hundreds or mil, and 16 to 29 split up, with a note of their own", () => {
    const traps = (n: number) => numberTraps(numberWords(n));
    assert.deepEqual(traps(506), [{ answers: ["quinientos y seis"], note: EXTRA_Y_NOTE }]);
    assert.ok(traps(1002)[0].answers.includes("mil y dos"));
    assert.ok(traps(1506)[0].answers.includes("mil y quinientos y seis"));
    assert.deepEqual(traps(16), [{ answers: ["diez y seis"], note: SPLIT_TEENS_NOTE }]);
    assert.deepEqual(traps(536)[0].answers, ["quinientos y treinta y seis"], "the y after the hundreds is the wrong one");
    assert.deepEqual(traps(200000), [], "nothing follows doscientos mil");

    const card = { ...numberCard("words", 1000, () => 0), answers: numberWords(506), shown: "quinientos seis", wrongNotes: traps(506) };
    assert.equal(gradeCard(card, "quinientos y seis"), "wrong");
    assert.equal(wrongNote(card, "Quinientos y seis."), EXTRA_Y_NOTE);
    assert.equal(wrongNote(card, "quinientos siete"), null);
  });

  it("never list an accepted answer as a mistake", () => {
    const random = seeded(9);
    for (const kind of ["words", "noun", "date", "year", "time"] as const) {
      for (let i = 0; i < 60; i++) {
        const card = numberCard(kind, 1000000, random);
        for (const answer of card.answers) assert.equal(wrongNote(card, answer), null, `${card.title}: ${answer}`);
      }
    }
  });

  it("ask a noun card's number with the noun or on its own", () => {
    const random = seeded(11);
    for (let i = 0; i < 60; i++) {
      const card = numberCard("noun", 1000, random);
      const [digits, ...noun] = card.title.split(" ");
      const n = Number(digits.replace(/,/g, ""));
      assert.ok(card.answers.some((a) => a.endsWith(noun.join(" "))), card.title);
      assert.ok(card.answers.includes(numberWords(n, COUNT_NOUNS.find((c) => c.es === noun.join(" ") || c.plural === noun.join(" "))!.gender)[0]), card.title);
    }
  });

  it("don't repeat a card in a session, and give nothing with no kinds", () => {
    const deck = numberDeck({ kinds: NUMBER_KINDS, max: 1000 }, seeded(5));
    const ids = Array.from({ length: 15 }, () => deck()!.id);
    assert.equal(new Set(ids).size, 15);
    assert.equal(numberDeck({ kinds: [], max: 1000 })(), null);
  });
});
