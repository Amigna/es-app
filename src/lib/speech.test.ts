import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestVoice, spokenText, voiceRank } from "./speech";

const voices = (...langs: string[]) => langs.map((lang) => ({ lang }));

describe("voice choice", () => {
  it("prefers Latin American Spanish, in order", () => {
    assert.equal(bestVoice(voices("es-ES", "es-US", "es-MX", "es-419"))?.lang, "es-419");
    assert.equal(bestVoice(voices("es-ES", "es-US", "es-MX"))?.lang, "es-MX");
    assert.equal(bestVoice(voices("es-ES", "es-CO", "es-US"))?.lang, "es-US");
    assert.equal(bestVoice(voices("es-ES", "es-CU"))?.lang, "es-CU");
  });

  it("falls back to Spain only when nothing else is there", () => {
    assert.equal(bestVoice(voices("en-US", "es-ES", "es"))?.lang, "es");
    assert.equal(bestVoice(voices("en-US", "es-ES"))?.lang, "es-ES");
  });

  it("reads Android's language codes", () => {
    assert.equal(bestVoice(voices("es_ES", "es_MX"))?.lang, "es_MX");
    assert.equal(voiceRank("ES-mx"), 1);
  });

  it("keeps the device's order within a rank", () => {
    const list = [
      { lang: "es-MX", name: "first" },
      { lang: "es-MX", name: "second" },
    ];
    assert.equal(bestVoice(list)?.name, "first");
  });

  it("finds nothing when no Spanish voice is installed", () => {
    assert.equal(bestVoice(voices("en-US", "fr-FR", "est-EE")), null);
    assert.equal(bestVoice([]), null);
  });
});

describe("spoken text", () => {
  it("drops trailing dots from unfinished phrases", () => {
    assert.equal(spokenText("Me llamo..."), "Me llamo");
    assert.equal(spokenText("Soy de…"), "Soy de");
  });

  it("leaves ordinary sentences alone", () => {
    assert.equal(spokenText("Hola, ¿cómo estás?"), "Hola, ¿cómo estás?");
    assert.equal(spokenText("Mi casa es grande."), "Mi casa es grande.");
  });
});
