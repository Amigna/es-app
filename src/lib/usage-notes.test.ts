import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usageNote } from "./usage-notes";

describe("usage notes", () => {
  it("catch an a that querer and poder don't take", () => {
    assert.equal(
      usageNote("Queríamos a comprar una casa cerca del mar", "Queríamos comprar una casa cerca del mar."),
      "Querer goes straight to the infinitive, with no a: queríamos comprar.",
    );
    assert.equal(usageNote("no puedo a dormir", "No puedo dormir."), "Poder goes straight to the infinitive, with no a: puedo dormir.");
  });

  it("catch a missing or wrong link word", () => {
    assert.equal(usageNote("Vamos comer en la playa", "Vamos a comer en la playa."), "Ir takes a before an infinitive: vamos a comer.");
    assert.equal(usageNote("Tengo estudiar", "Tengo que estudiar."), "Tener (have to) takes que before an infinitive: tengo que estudiar.");
    assert.equal(usageNote("Trato a llegar temprano", "Trato de llegar temprano."), "Tratar (try to) takes de before an infinitive, not a: trato de llegar.");
    assert.equal(usageNote("Empecé estudiar", "Empecé a estudiar."), "Empezar takes a before an infinitive: empecé a estudiar.");
  });

  it("say nothing when the answer is right, or the a belongs there", () => {
    assert.equal(usageNote("Queríamos comprar una casa", "Queríamos comprar una casa."), null);
    // Personal a before a person, not an infinitive.
    assert.equal(usageNote("Quiero a Pilar", "Quiero a Pilar."), null);
    // Dejar with no de means let, so the de rule doesn't apply.
    assert.equal(usageNote("Mi papá no me dejaba de salir", "Mi papá no me dejaba salir."), null);
    // A different mistake, like the wrong verb form, isn't this note's business.
    assert.equal(usageNote("Queremos a comprar una casa", "Queríamos comprar una casa."), null);
  });
});
