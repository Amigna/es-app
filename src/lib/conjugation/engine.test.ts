import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alsoAccepted, conjugate } from "./engine";
import type { TenseId, VerbInput } from "./types";

const cache = new Map<string, ReturnType<typeof conjugate>>();
function run(v: string | VerbInput) {
  const input = typeof v === "string" ? { inf: v } : v;
  const key = JSON.stringify(input);
  if (!cache.has(key)) cache.set(key, conjugate(input));
  return cache.get(key)!;
}

/** Asserts the five person slots (yo, tú, él, nosotros, ellos/ustedes), and optionally vos. */
function check(v: string | VerbInput, tense: TenseId, forms: (string | null)[], vos?: string) {
  const name = typeof v === "string" ? v : v.inf;
  const t = run(v).tenses[tense]!;
  assert.deepEqual(t.forms, forms, `${name} ${tense}`);
  if (vos !== undefined) assert.equal(t.vos, vos, `${name} ${tense} vos`);
}

const P5 = (s: string) => s.split(" ") as string[];

describe("regular verbs", () => {
  it("hablar", () => {
    check("hablar", "present", P5("hablo hablas habla hablamos hablan"), "hablás");
    check("hablar", "preterite", P5("hablé hablaste habló hablamos hablaron"));
    check("hablar", "imperfect", P5("hablaba hablabas hablaba hablábamos hablaban"));
    check("hablar", "future", P5("hablaré hablarás hablará hablaremos hablarán"));
    check("hablar", "conditional", P5("hablaría hablarías hablaría hablaríamos hablarían"));
    check("hablar", "subjPresent", P5("hable hables hable hablemos hablen"), "hablés");
    check("hablar", "subjImperfect", P5("hablara hablaras hablara habláramos hablaran"));
    check("hablar", "subjImperfectSe", P5("hablase hablases hablase hablásemos hablasen"));
    check("hablar", "impAffirmative", [null, "habla", "hable", "hablemos", "hablen"], "hablá");
    check("hablar", "impNegative", [null, "no hables", "no hable", "no hablemos", "no hablen"], "no hablés");
    assert.equal(run("hablar").gerund, "hablando");
    assert.equal(run("hablar").participle, "hablado");
  });

  it("compound tenses", () => {
    check("hablar", "presentPerfect", ["he hablado", "has hablado", "ha hablado", "hemos hablado", "han hablado"]);
    check("hablar", "pluperfect", ["había hablado", "habías hablado", "había hablado", "habíamos hablado", "habían hablado"]);
    check("hablar", "futurePerfect", ["habré hablado", "habrás hablado", "habrá hablado", "habremos hablado", "habrán hablado"]);
    check("hablar", "conditionalPerfect", ["habría hablado", "habrías hablado", "habría hablado", "habríamos hablado", "habrían hablado"]);
    check("hablar", "subjPresentPerfect", ["haya hablado", "hayas hablado", "haya hablado", "hayamos hablado", "hayan hablado"]);
    check("hablar", "subjPluperfect", ["hubiera hablado", "hubieras hablado", "hubiera hablado", "hubiéramos hablado", "hubieran hablado"]);
  });

  it("comer / vivir", () => {
    check("comer", "present", P5("como comes come comemos comen"), "comés");
    check("comer", "preterite", P5("comí comiste comió comimos comieron"));
    check("comer", "imperfect", P5("comía comías comía comíamos comían"));
    check("comer", "subjPresent", P5("coma comas coma comamos coman"), "comás");
    check("comer", "subjImperfect", P5("comiera comieras comiera comiéramos comieran"));
    check("comer", "impAffirmative", [null, "come", "coma", "comamos", "coman"], "comé");
    assert.equal(run("comer").gerund, "comiendo");
    assert.equal(run("comer").participle, "comido");
    check("vivir", "present", P5("vivo vives vive vivimos viven"), "vivís");
    check("vivir", "preterite", P5("viví viviste vivió vivimos vivieron"));
    check("vivir", "impAffirmative", [null, "vive", "viva", "vivamos", "vivan"], "viví");
  });
});

describe("spelling changes", () => {
  it("-car / -gar / -zar / -guar", () => {
    check("buscar", "preterite", P5("busqué buscaste buscó buscamos buscaron"));
    check("buscar", "subjPresent", P5("busque busques busque busquemos busquen"), "busqués");
    check("pagar", "preterite", P5("pagué pagaste pagó pagamos pagaron"));
    check("pagar", "subjPresent", P5("pague pagues pague paguemos paguen"));
    check("cruzar", "preterite", P5("crucé cruzaste cruzó cruzamos cruzaron"));
    check("cruzar", "subjPresent", P5("cruce cruces cruce crucemos crucen"));
    check("averiguar", "preterite", P5("averigüé averiguaste averiguó averiguamos averiguaron"));
    check("averiguar", "subjPresent", P5("averigüe averigües averigüe averigüemos averigüen"));
  });

  it("-cer / -ger / -guir / -zc", () => {
    check("vencer", "present", P5("venzo vences vence vencemos vencen"));
    check("vencer", "subjPresent", P5("venza venzas venza venzamos venzan"));
    check("coger", "present", P5("cojo coges coge cogemos cogen"));
    check("coger", "subjPresent", P5("coja cojas coja cojamos cojan"));
    check("conocer", "present", P5("conozco conoces conoce conocemos conocen"), "conocés");
    check("conocer", "subjPresent", P5("conozca conozcas conozca conozcamos conozcan"));
    check("conducir", "present", P5("conduzco conduces conduce conducimos conducen"));
    check("conducir", "preterite", P5("conduje condujiste condujo condujimos condujeron"));
    check("conducir", "subjImperfect", P5("condujera condujeras condujera condujéramos condujeran"));
    check({ inf: "mecer" }, "present", P5("mezo meces mece mecemos mecen"));
  });

  it("i -> y and hiatus accents", () => {
    check("leer", "preterite", P5("leí leíste leyó leímos leyeron"));
    check("leer", "subjImperfect", P5("leyera leyeras leyera leyéramos leyeran"));
    assert.equal(run("leer").gerund, "leyendo");
    assert.equal(run("leer").participle, "leído");
    check("construir", "present", P5("construyo construyes construye construimos construyen"), "construís");
    check("construir", "preterite", P5("construí construiste construyó construimos construyeron"));
    check("construir", "subjPresent", P5("construya construyas construya construyamos construyan"));
    check("construir", "impAffirmative", [null, "construye", "construya", "construyamos", "construyan"]);
    assert.equal(run("construir").gerund, "construyendo");
    assert.equal(run("construir").participle, "construido");
    check({ inf: "reñir", boot: "e>i" }, "preterite", P5("reñí reñiste riñó reñimos riñeron"));
    assert.equal(run({ inf: "reñir", boot: "e>i" }).gerund, "riñendo");
  });

  it("enviar / continuar (accented hiatus)", () => {
    check({ inf: "enviar", accent: "i" }, "present", P5("envío envías envía enviamos envían"));
    check({ inf: "enviar", accent: "i" }, "subjPresent", P5("envíe envíes envíe enviemos envíen"));
    check({ inf: "enviar", accent: "i" }, "impAffirmative", [null, "envía", "envíe", "enviemos", "envíen"], "enviá");
    check({ inf: "continuar", accent: "u" }, "present", P5("continúo continúas continúa continuamos continúan"));
  });
});

describe("stem-changing verbs", () => {
  it("e>ie / o>ue (-ar, -er)", () => {
    check({ inf: "cerrar", boot: "e>ie" }, "present", P5("cierro cierras cierra cerramos cierran"), "cerrás");
    check({ inf: "cerrar", boot: "e>ie" }, "subjPresent", P5("cierre cierres cierre cerremos cierren"), "cerrés");
    check({ inf: "contar", boot: "o>ue" }, "present", P5("cuento cuentas cuenta contamos cuentan"));
    check({ inf: "volver", boot: "o>ue" }, "present", P5("vuelvo vuelves vuelve volvemos vuelven"));
    check({ inf: "volver", boot: "o>ue" }, "subjPresent", P5("vuelva vuelvas vuelva volvamos vuelvan"));
    assert.equal(run({ inf: "volver", boot: "o>ue" }).participle, "vuelto");
    assert.equal(run({ inf: "devolver", boot: "o>ue" }).participle, "devuelto");
    assert.equal(run({ inf: "resolver", boot: "o>ue" }).participle, "resuelto");
    check({ inf: "empezar", boot: "e>ie" }, "present", P5("empiezo empiezas empieza empezamos empiezan"));
    check({ inf: "empezar", boot: "e>ie" }, "preterite", P5("empecé empezaste empezó empezamos empezaron"));
    check({ inf: "empezar", boot: "e>ie" }, "subjPresent", P5("empiece empieces empiece empecemos empiecen"));
    check({ inf: "almorzar", boot: "o>ue" }, "present", P5("almuerzo almuerzas almuerza almorzamos almuerzan"));
    check({ inf: "almorzar", boot: "o>ue" }, "preterite", P5("almorcé almorzaste almorzó almorzamos almorzaron"));
    check({ inf: "jugar", boot: "u>ue" }, "present", P5("juego juegas juega jugamos juegan"));
    check({ inf: "jugar", boot: "u>ue" }, "preterite", P5("jugué jugaste jugó jugamos jugaron"));
    check({ inf: "jugar", boot: "u>ue" }, "subjPresent", P5("juegue juegues juegue juguemos jueguen"));
    check({ inf: "oler", boot: "o>hue" }, "present", P5("huelo hueles huele olemos huelen"));
    check({ inf: "errar", boot: "e>ye" }, "present", P5("yerro yerras yerra erramos yerran"));
    check({ inf: "adquirir", boot: "i>ie" }, "present", P5("adquiero adquieres adquiere adquirimos adquieren"));
    check({ inf: "adquirir", boot: "i>ie" }, "preterite", P5("adquirí adquiriste adquirió adquirimos adquirieron"));
  });

  it("-ir verbs also change in the preterite, gerund and nosotros subjunctive", () => {
    const dormir: VerbInput = { inf: "dormir", boot: "o>ue" };
    check(dormir, "present", P5("duermo duermes duerme dormimos duermen"), "dormís");
    check(dormir, "preterite", P5("dormí dormiste durmió dormimos durmieron"));
    check(dormir, "subjPresent", P5("duerma duermas duerma durmamos duerman"), "durmás");
    check(dormir, "subjImperfect", P5("durmiera durmieras durmiera durmiéramos durmieran"));
    assert.equal(run(dormir).gerund, "durmiendo");
    const pedir: VerbInput = { inf: "pedir", boot: "e>i" };
    check(pedir, "present", P5("pido pides pide pedimos piden"));
    check(pedir, "preterite", P5("pedí pediste pidió pedimos pidieron"));
    check(pedir, "subjPresent", P5("pida pidas pida pidamos pidan"));
    assert.equal(run(pedir).gerund, "pidiendo");
    const sentir: VerbInput = { inf: "sentir", boot: "e>ie" };
    check(sentir, "present", P5("siento sientes siente sentimos sienten"));
    check(sentir, "preterite", P5("sentí sentiste sintió sentimos sintieron"));
    check(sentir, "subjPresent", P5("sienta sientas sienta sintamos sientan"));
    const seguir: VerbInput = { inf: "seguir", boot: "e>i" };
    check(seguir, "present", P5("sigo sigues sigue seguimos siguen"), "seguís");
    check(seguir, "preterite", P5("seguí seguiste siguió seguimos siguieron"));
    check(seguir, "subjPresent", P5("siga sigas siga sigamos sigan"));
    assert.equal(run(seguir).gerund, "siguiendo");
    const morir: VerbInput = { inf: "morir", boot: "o>ue" };
    check(morir, "preterite", P5("morí moriste murió morimos murieron"));
    assert.equal(run(morir).gerund, "muriendo");
    assert.equal(run(morir).participle, "muerto");
  });
});

describe("irregular verbs", () => {
  it("ser / ir / estar / haber / dar / ver", () => {
    check("ser", "present", P5("soy eres es somos son"), "sos");
    check("ser", "preterite", P5("fui fuiste fue fuimos fueron"));
    check("ser", "imperfect", P5("era eras era éramos eran"));
    check("ser", "subjPresent", P5("sea seas sea seamos sean"));
    check("ser", "subjImperfect", P5("fuera fueras fuera fuéramos fueran"));
    check("ser", "impAffirmative", [null, "sé", "sea", "seamos", "sean"]);
    check("ser", "future", P5("seré serás será seremos serán"));
    assert.equal(run("ser").gerund, "siendo");
    assert.equal(run("ser").participle, "sido");
    check("ir", "present", P5("voy vas va vamos van"), "vas");
    check("ir", "imperfect", P5("iba ibas iba íbamos iban"));
    check("ir", "subjPresent", P5("vaya vayas vaya vayamos vayan"));
    check("ir", "impAffirmative", [null, "ve", "vaya", "vamos", "vayan"], "andá");
    check("ir", "impNegative", [null, "no vayas", "no vaya", "no vayamos", "no vayan"]);
    assert.equal(run("ir").gerund, "yendo");
    assert.equal(run("ir").participle, "ido");
    check("estar", "present", P5("estoy estás está estamos están"));
    check("estar", "preterite", P5("estuve estuviste estuvo estuvimos estuvieron"));
    check("estar", "subjPresent", P5("esté estés esté estemos estén"));
    check("estar", "impAffirmative", [null, "está", "esté", "estemos", "estén"]);
    check("haber", "present", P5("he has ha hemos han"));
    check("haber", "preterite", P5("hube hubiste hubo hubimos hubieron"));
    check("haber", "future", P5("habré habrás habrá habremos habrán"));
    check("haber", "subjPresent", P5("haya hayas haya hayamos hayan"));
    check("haber", "impAffirmative", [null, null, null, null, null]);
    check("dar", "present", P5("doy das da damos dan"));
    check("dar", "preterite", P5("di diste dio dimos dieron"));
    check("dar", "subjPresent", P5("dé des dé demos den"));
    check("dar", "subjImperfect", P5("diera dieras diera diéramos dieran"));
    check("dar", "impAffirmative", [null, "da", "dé", "demos", "den"], "da");
    check("ver", "present", P5("veo ves ve vemos ven"), "ves");
    check("ver", "preterite", P5("vi viste vio vimos vieron"));
    check("ver", "imperfect", P5("veía veías veía veíamos veían"));
    check("ver", "subjPresent", P5("vea veas vea veamos vean"));
    assert.equal(run("ver").gerund, "viendo");
    assert.equal(run("ver").participle, "visto");
  });

  it("tener / venir / poner / salir / valer", () => {
    check("tener", "present", P5("tengo tienes tiene tenemos tienen"), "tenés");
    check("tener", "preterite", P5("tuve tuviste tuvo tuvimos tuvieron"));
    check("tener", "future", P5("tendré tendrás tendrá tendremos tendrán"));
    check("tener", "subjPresent", P5("tenga tengas tenga tengamos tengan"), "tengás");
    check("tener", "subjImperfect", P5("tuviera tuvieras tuviera tuviéramos tuvieran"));
    check("tener", "impAffirmative", [null, "ten", "tenga", "tengamos", "tengan"], "tené");
    assert.equal(run("tener").participle, "tenido");
    check("venir", "present", P5("vengo vienes viene venimos vienen"), "venís");
    check("venir", "preterite", P5("vine viniste vino vinimos vinieron"));
    check("venir", "future", P5("vendré vendrás vendrá vendremos vendrán"));
    check("venir", "impAffirmative", [null, "ven", "venga", "vengamos", "vengan"], "vení");
    assert.equal(run("venir").gerund, "viniendo");
    check("poner", "present", P5("pongo pones pone ponemos ponen"));
    check("poner", "preterite", P5("puse pusiste puso pusimos pusieron"));
    check("poner", "future", P5("pondré pondrás pondrá pondremos pondrán"));
    check("poner", "impAffirmative", [null, "pon", "ponga", "pongamos", "pongan"], "poné");
    assert.equal(run("poner").participle, "puesto");
    check("salir", "present", P5("salgo sales sale salimos salen"));
    check("salir", "future", P5("saldré saldrás saldrá saldremos saldrán"));
    check("salir", "impAffirmative", [null, "sal", "salga", "salgamos", "salgan"], "salí");
    check("valer", "present", P5("valgo vales vale valemos valen"));
  });

  it("hacer / decir / traer / caer / oír / reír", () => {
    check("hacer", "present", P5("hago haces hace hacemos hacen"));
    check("hacer", "preterite", P5("hice hiciste hizo hicimos hicieron"));
    check("hacer", "future", P5("haré harás hará haremos harán"));
    check("hacer", "subjPresent", P5("haga hagas haga hagamos hagan"));
    check("hacer", "impAffirmative", [null, "haz", "haga", "hagamos", "hagan"]);
    assert.equal(run("hacer").participle, "hecho");
    check("decir", "present", P5("digo dices dice decimos dicen"), "decís");
    check("decir", "preterite", P5("dije dijiste dijo dijimos dijeron"));
    check("decir", "future", P5("diré dirás dirá diremos dirán"));
    check("decir", "subjPresent", P5("diga digas diga digamos digan"));
    check("decir", "subjImperfect", P5("dijera dijeras dijera dijéramos dijeran"));
    check("decir", "impAffirmative", [null, "di", "diga", "digamos", "digan"], "decí");
    assert.equal(run("decir").gerund, "diciendo");
    assert.equal(run("decir").participle, "dicho");
    check("traer", "present", P5("traigo traes trae traemos traen"));
    check("traer", "preterite", P5("traje trajiste trajo trajimos trajeron"));
    check("traer", "subjPresent", P5("traiga traigas traiga traigamos traigan"));
    check("traer", "subjImperfect", P5("trajera trajeras trajera trajéramos trajeran"));
    assert.equal(run("traer").gerund, "trayendo");
    assert.equal(run("traer").participle, "traído");
    check("caer", "present", P5("caigo caes cae caemos caen"));
    check("caer", "preterite", P5("caí caíste cayó caímos cayeron"));
    check("caer", "subjPresent", P5("caiga caigas caiga caigamos caigan"));
    assert.equal(run("caer").gerund, "cayendo");
    assert.equal(run("caer").participle, "caído");
    check("oír", "present", P5("oigo oyes oye oímos oyen"), "oís");
    check("oír", "preterite", P5("oí oíste oyó oímos oyeron"));
    check("oír", "future", P5("oiré oirás oirá oiremos oirán"));
    check("oír", "subjPresent", P5("oiga oigas oiga oigamos oigan"));
    check("oír", "impAffirmative", [null, "oye", "oiga", "oigamos", "oigan"], "oí");
    assert.equal(run("oír").gerund, "oyendo");
    assert.equal(run("oír").participle, "oído");
    check("reír", "present", P5("río ríes ríe reímos ríen"), "reís");
    check("reír", "preterite", P5("reí reíste rio reímos rieron"));
    check("reír", "imperfect", P5("reía reías reía reíamos reían"));
    check("reír", "future", P5("reiré reirás reirá reiremos reirán"));
    check("reír", "subjPresent", P5("ría rías ría riamos rían"));
    check("reír", "subjImperfect", P5("riera rieras riera riéramos rieran"));
    check("reír", "impAffirmative", [null, "ríe", "ría", "riamos", "rían"], "reí");
    assert.equal(run("reír").gerund, "riendo");
    assert.equal(run("reír").participle, "reído");
  });

  it("poder / querer / saber / caber / andar", () => {
    check("poder", "present", P5("puedo puedes puede podemos pueden"), "podés");
    check("poder", "preterite", P5("pude pudiste pudo pudimos pudieron"));
    check("poder", "future", P5("podré podrás podrá podremos podrán"));
    check("poder", "subjPresent", P5("pueda puedas pueda podamos puedan"));
    assert.equal(run("poder").gerund, "pudiendo");
    check("querer", "present", P5("quiero quieres quiere queremos quieren"));
    check("querer", "preterite", P5("quise quisiste quiso quisimos quisieron"));
    check("querer", "future", P5("querré querrás querrá querremos querrán"));
    check("saber", "present", P5("sé sabes sabe sabemos saben"), "sabés");
    check("saber", "preterite", P5("supe supiste supo supimos supieron"));
    check("saber", "future", P5("sabré sabrás sabrá sabremos sabrán"));
    check("saber", "subjPresent", P5("sepa sepas sepa sepamos sepan"));
    check("caber", "present", P5("quepo cabes cabe cabemos caben"));
    check("caber", "preterite", P5("cupe cupiste cupo cupimos cupieron"));
    check("caber", "subjPresent", P5("quepa quepas quepa quepamos quepan"));
    check("andar", "preterite", P5("anduve anduviste anduvo anduvimos anduvieron"));
  });
});

describe("derived verbs (like)", () => {
  it("detener / convenir / componer / deshacer / prever / sonreír", () => {
    check({ inf: "detener", like: "tener" }, "present", P5("detengo detienes detiene detenemos detienen"));
    check({ inf: "detener", like: "tener" }, "preterite", P5("detuve detuviste detuvo detuvimos detuvieron"));
    check({ inf: "detener", like: "tener" }, "impAffirmative", [null, "detén", "detenga", "detengamos", "detengan"], "detené");
    check({ inf: "convenir", like: "venir" }, "impAffirmative", [null, "convén", "convenga", "convengamos", "convengan"]);
    assert.equal(run({ inf: "convenir", like: "venir" }).gerund, "conviniendo");
    check({ inf: "componer", like: "poner" }, "impAffirmative", [null, "compón", "componga", "compongamos", "compongan"]);
    check({ inf: "componer", like: "poner" }, "preterite", P5("compuse compusiste compuso compusimos compusieron"));
    assert.equal(run({ inf: "componer", like: "poner" }).participle, "compuesto");
    check({ inf: "deshacer", like: "hacer" }, "preterite", P5("deshice deshiciste deshizo deshicimos deshicieron"));
    check({ inf: "deshacer", like: "hacer" }, "impAffirmative", [null, "deshaz", "deshaga", "deshagamos", "deshagan"]);
    assert.equal(run({ inf: "deshacer", like: "hacer" }).participle, "deshecho");
    check({ inf: "prever", like: "ver" }, "present", P5("preveo prevés prevé prevemos prevén"));
    check({ inf: "prever", like: "ver" }, "preterite", P5("preví previste previó previmos previeron"));
    check({ inf: "prever", like: "ver" }, "imperfect", P5("preveía preveías preveía preveíamos preveían"));
    assert.equal(run({ inf: "prever", like: "ver" }).participle, "previsto");
    check({ inf: "sonreír", like: "reír" }, "present", P5("sonrío sonríes sonríe sonreímos sonríen"));
    check({ inf: "sonreír", like: "reír" }, "preterite", P5("sonreí sonreíste sonrió sonreímos sonrieron"));
    check({ inf: "atraer", like: "traer" }, "preterite", P5("atraje atrajiste atrajo atrajimos atrajeron"));
    check({ inf: "desoír", like: "oír" }, "preterite", P5("desoí desoíste desoyó desoímos desoyeron"));
  });

  it("monosyllables lose their written accent (RAE 2010)", () => {
    check({ inf: "freír", like: "reír" }, "preterite", P5("freí freíste frio freímos frieron"));
    check({ inf: "guiar", accent: "i" }, "preterite", P5("guie guiaste guio guiamos guiaron"));
    check({ inf: "huir" }, "present", P5("huyo huyes huye huimos huyen"), "huis");
    check({ inf: "huir" }, "preterite", P5("hui huiste huyó huimos huyeron"));
    check("huir", "impAffirmative", [null, "huye", "huya", "huyamos", "huyan"], "hui");
    check({ inf: "confiar", accent: "i" }, "preterite", P5("confié confiaste confió confiamos confiaron"));
    check("dar", "subjPresent", P5("dé des dé demos den"));
  });

  it("uses the common participle and keeps the other one accepted", () => {
    assert.equal(run("imprimir").participle, "impreso");
    assert.equal(run("imprimir").participleAlt, "imprimido");
    check("imprimir", "presentPerfect", ["he impreso", "has impreso", "ha impreso", "hemos impreso", "han impreso"]);
    assert.equal(run({ inf: "freír", like: "reír" }).participle, "frito");
    assert.equal(run({ inf: "freír", like: "reír" }).participleAlt, "freído");
    assert.equal(run({ inf: "sonreír", like: "reír" }).participle, "sonreído");
    assert.equal(run({ inf: "sonreír", like: "reír" }).participleAlt, undefined);
    assert.equal(run("reimprimir").participle, "reimpreso");
  });

  it("swaps in the other participle only at the end of a compound form", () => {
    assert.deepEqual(alsoAccepted(run("imprimir"), "había impreso"), ["había imprimido"]);
    assert.deepEqual(alsoAccepted(run("imprimir"), "Hubiera impreso"), ["Hubiera imprimido"]);
    assert.deepEqual(alsoAccepted(run("imprimir"), "imprimo"), []);
    assert.deepEqual(alsoAccepted(run("hablar"), "he hablado"), []);
  });

  it("rehacer marks the stressed i after h", () => {
    check("rehacer", "preterite", P5("rehíce rehiciste rehízo rehicimos rehicieron"));
    check("rehacer", "present", P5("rehago rehaces rehace rehacemos rehacen"));
    check("rehacer", "subjImperfect", P5("rehiciera rehicieras rehiciera rehiciéramos rehicieran"));
    check("rehacer", "future", P5("reharé reharás rehará reharemos reharán"));
    assert.equal(run("rehacer").participle, "rehecho");
  });

  it("participle suffixes", () => {
    assert.equal(run("escribir").participle, "escrito");
    assert.equal(run("describir").participle, "descrito");
    assert.equal(run("abrir").participle, "abierto");
    assert.equal(run("descubrir").participle, "descubierto");
    assert.equal(run("romper").participle, "roto");
  });
});

describe("reflexive verbs", () => {
  it("levantarse", () => {
    const v = "levantarse";
    assert.equal(run(v).infinitive, "levantarse");
    assert.equal(run(v).gerund, "levantándose");
    assert.equal(run(v).participle, "levantado");
    check(v, "present", ["me levanto", "te levantas", "se levanta", "nos levantamos", "se levantan"], "te levantás");
    check(v, "preterite", ["me levanté", "te levantaste", "se levantó", "nos levantamos", "se levantaron"]);
    check(v, "presentPerfect", ["me he levantado", "te has levantado", "se ha levantado", "nos hemos levantado", "se han levantado"]);
    check(v, "subjPresent", ["me levante", "te levantes", "se levante", "nos levantemos", "se levanten"]);
    check(v, "impAffirmative", [null, "levántate", "levántese", "levantémonos", "levántense"], "levantate");
    check(v, "impNegative", [null, "no te levantes", "no se levante", "no nos levantemos", "no se levanten"], "no te levantés");
  });

  it("irse / sentarse / dormirse / ponerse", () => {
    check({ inf: "irse", like: "ir" }, "impAffirmative", [null, "vete", "váyase", "vámonos", "váyanse"], "andate");
    check({ inf: "irse", like: "ir" }, "present", ["me voy", "te vas", "se va", "nos vamos", "se van"]);
    const sentarse: VerbInput = { inf: "sentarse", boot: "e>ie" };
    check(sentarse, "impAffirmative", [null, "siéntate", "siéntese", "sentémonos", "siéntense"], "sentate");
    const dormirse: VerbInput = { inf: "dormirse", boot: "o>ue" };
    check(dormirse, "impAffirmative", [null, "duérmete", "duérmase", "durmámonos", "duérmanse"], "dormite");
    check({ inf: "ponerse", like: "poner" }, "impAffirmative", [null, "ponte", "póngase", "pongámonos", "pónganse"], "ponete");
    assert.equal(run({ inf: "irse", like: "ir" }).infinitive, "irse");
    assert.equal(run({ inf: "ponerse", like: "poner" }).gerund, "poniéndose");
  });
});
