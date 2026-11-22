import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lessNaturalVariants, usageNote } from "./usage-notes";

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

  it("accept hablar a for hablar con, with a note that con fits better", () => {
    assert.deepEqual(lessNaturalVariants("Mis padres hablaron con la maestra."), [
      {
        answer: "Mis padres hablaron a la maestra.",
        note: "This works, but hablaron con is the more natural fit for talking with someone. With a, Spanish usually adds le: Mis padres le hablaron a la maestra.",
      },
      // With le it sounds natural, so it needs no note.
      { answer: "Mis padres le hablaron a la maestra." },
    ]);
    assert.equal(lessNaturalVariants("Mis padres hablaron con el maestro.")[0].answer, "Mis padres hablaron al maestro.");
    assert.equal(lessNaturalVariants("Hablé con mis primos.")[1].answer, "Les hablé a mis primos.");
    assert.equal(lessNaturalVariants("¿Hablaste con tu mamá?")[1].answer, "¿Le hablaste a tu mamá?");
    assert.equal(lessNaturalVariants("Tienes que hablar con el jefe.")[1].answer, "Tienes que hablarle al jefe.");
    assert.equal(lessNaturalVariants("Nunca he hablado con el vecino.")[1].answer, "Nunca le he hablado al vecino.");
    assert.equal(lessNaturalVariants("¿Has hablado con tu abuela?")[1].answer, "¿Le has hablado a tu abuela?");
    assert.deepEqual(lessNaturalVariants("No hables con la boca llena."), []);
    // Con before something that isn't a person stays as it is.
    assert.deepEqual(lessNaturalVariants("Hablamos con calma."), []);
  });

  it("catch the wrong word after casarse, soñar and pensar", () => {
    assert.equal(usageNote("Se casó a un médico", "Se casó con un médico."), "Casarse takes con: casó con.");
    assert.equal(usageNote("Anoche soñé de ti", "Anoche soñé contigo.") , null, "contigo isn't con, so no note");
    assert.equal(usageNote("Soñé de mi abuela", "Soñé con mi abuela."), "Soñar takes con: soñé con.");
    assert.match(usageNote("Pienso de ti", "Pienso en ti.")!, /^Thinking about something is pensar en: pienso en\./);
    // The right word gets no note.
    assert.equal(usageNote("Soñé con mi abuela", "Soñé con mi abuela."), null);
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
