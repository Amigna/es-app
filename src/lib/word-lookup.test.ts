import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newItemOrder } from "./card-decks";
import { READINGS } from "./reading-data";
import { tokenize } from "./readings";
import { lookupWord } from "./word-lookup";

const find = (token: string, headword: string) => {
  const match = lookupWord(token).find((m) => m.headword === headword);
  assert.ok(match, `${token} -> ${headword}`);
  return match;
};

describe("lookupWord", () => {
  it("finds nouns and their plurals", () => {
    const casa = find("casas", "la casa");
    assert.equal(casa.detail, "Noun, plural");
    assert.equal(casa.item, "vocab:noun:casa:toEnglish");
    assert.equal(find("Casa", "la casa").detail, "Noun");
  });

  it("finds every entry a spelling could be", () => {
    assert.ok(lookupWord("como").some((m) => m.detail === "Small word"));
    const comer = find("como", "comer");
    assert.match(comer.detail, /Present · yo/);
    assert.equal(comer.item, "verb:comer:present");
    assert.equal(comer.href, "/verb/comer");
  });

  it("lists every person sharing a form", () => {
    assert.match(find("comía", "comer").detail, /Imperfect · yo, él \/ ella \/ usted/);
    assert.equal(find("comió", "comer").item, "verb:comer:preterite");
  });

  it("finds reflexive forms without their pronoun", () => {
    assert.equal(find("levanto", "levantarse").item, "verb:levantarse:present");
    assert.ok(lookupWord("levanto").some((m) => m.headword === "levantar"));
  });

  it("finds infinitives, gerunds and forms with pronouns attached", () => {
    assert.equal(find("hablando", "hablar").detail, "Gerund (-ing form)");
    assert.equal(find("hablar", "hablar").item, "verb:hablar:present");
    assert.match(find("dime", "decir").detail, /Command, with a pronoun attached/);
    assert.match(find("decirlo", "decir").detail, /Infinitive/);
  });

  it("finds both participles of a verb that has two", () => {
    assert.equal(find("impreso", "imprimir").detail, "Past participle");
    assert.equal(find("imprimido", "imprimir").detail, "Past participle");
  });

  it("finds nothing for names", () => {
    assert.deepEqual(lookupWord("Xochimilco"), []);
  });

  it("finds forms the word lists only hint at", () => {
    assert.equal(find("sus", "su").detail, "Small word");
    assert.equal(find("miles", "mil").detail, "Small word");
    assert.match(find("gran", "grande").detail, /short form before a noun/);
    assert.match(find("ningún", "ninguno").detail, /short form before a noun/);
    assert.equal(find("unidos", "unir").detail, "Past participle");
    assert.match(find("hay", "haber").detail, /there is, there are/);
    assert.equal(find("diseñadoras", "el diseñador").detail, "Noun, feminine plural");
    assert.equal(find("abogada", "el abogado").item, "vocab:noun:abogado:toEnglish");
    assert.match(find("embargo", "sin embargo").detail, /part of “sin embargo”/);
    assert.equal(find("gracias", "Gracias.").item, undefined);
  });

  it("finds every word in the readings apart from names and places", () => {
    // Add a new reading's names here. Any other word it uses needs to be in the word lists.
    const names = new Set(
      "américa ana andrés argentina bogotá camila caracas carlos carmen centroamérica chile cocibolca cuba cusco daniela diego elena ernesto europa habana heredia honduras juan lima luis machu marta mateo mejía miami montevideo méxico nicaragua panamá perú picchu puebla quetzalcóatl rafael santiago sofía uruguay valentina venezuela".split(" "),
    );
    const missing = new Set<string>();
    for (const r of READINGS) {
      for (const p of r.paragraphs) {
        for (const t of tokenize(p.es)) if (t.word && !names.has(t.text.toLowerCase()) && lookupWord(t.text).length === 0) missing.add(`${r.slug}: ${t.text}`);
      }
      // A word the story glosses, like ingresos, should also be one people can add to their reviews.
      for (const w of r.words) if (!/\s/.test(w.es) && lookupWord(w.es).length === 0) missing.add(`${r.slug} glossary: ${w.es}`);
    }
    assert.deepEqual([...missing], []);
  });

  it("only offers items Today's review can show", () => {
    const order = new Set(newItemOrder(new Set()));
    const words = READINGS.flatMap((r) => r.paragraphs.flatMap((p) => tokenize(p.es).filter((t) => t.word).map((t) => t.text)));
    let found = 0;
    for (const word of words) {
      for (const match of lookupWord(word)) {
        found++;
        // Verbs are checked against the order with no rare tenses, which is the widest it gets. Phrases offer no item.
        if (match.item) assert.ok(order.has(match.item), `${word}: ${match.item}`);
        else assert.match(match.key, /^phrase:/, word);
      }
    }
    assert.ok(found > words.length / 2, `${found} matches for ${words.length} words`);
  });
});

describe("tokenize", () => {
  it("keeps every character, splitting out the words", () => {
    const text = "¿Dónde está el baño? —preguntó Ana.";
    const tokens = tokenize(text);
    assert.equal(tokens.map((t) => t.text).join(""), text);
    assert.deepEqual(tokens.filter((t) => t.word).map((t) => t.text), ["Dónde", "está", "el", "baño", "preguntó", "Ana"]);
  });
});
