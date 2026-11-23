// ===== Rebríčky (učiteľ): lekcie a test rýchlosti =====
// Dva prepínače:
//   - čo:  ⌨️ Lekcie  alebo  ⏱️ Test rýchlosti
//   - ako: Aktuálny rebríček  alebo  🏆 Sieň slávy (najlepší výkon za každý školský rok)
// Body počíta databáza (faza11.sql, faza11b.sql, faza12.sql). Učiteľ vidí žiakov
// svojich tried; v rebríčku sú len aktívni žiaci.

const rebricek = {
  druh: spomen("druhRebricka") || "lekcie",   // "lekcie" alebo "test" (spomen je z admin.js)
  rezim: spomen("rezimRebricka") || "rok",    // "rok" = aktuálny, "slava" = sieň slávy
  lekcia: Number(spomen("lekciaRebricka")) || 0,
  testId: spomen("testRebricka") || null,
  riadky: [],  // načítané riadky (z databázy)
  testy: [],   // testy učiteľa (na výber)
};

// 31.1 → "31,1"
const formatujBody = (n) => Number(n).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Ročníky, ktoré majú lekciu v rozsahu: [5, 6] (dlzky-admin.js: lekcieOd, lekcieDo)
function rocnikyLekcie(lekcia) {
  const rocniky = [];
  for (let i = 0; i < 9; i++) if (lekcieOd[i] >= 1 && lekcia >= lekcieOd[i] && lekcia <= lekcieDo[i]) rocniky.push(i + 1);
  return rocniky;
}

// ----- Výbery: lekcia, test, kto -----
function vyplnLekcie() {
  const vyber = $("lekciaRebricka");
  vyber.innerHTML = "";
  for (const l of LEKCIE) { // lekcie-obsah.js
    const rocniky = rocnikyLekcie(l.cislo);
    const m = document.createElement("option");
    m.value = l.cislo;
    m.textContent = `${l.cislo}. ${l.nazov}` + (rocniky.length ? ` (${popisRocnikov(rocniky, "roč.")})` : " – žiadny ročník"); // texty-admin.js
    vyber.appendChild(m);
  }
  // Predvolene najnižšia lekcia, ktorú nejaký ročník robí
  if (!rebricek.lekcia) rebricek.lekcia = LEKCIE.find((l) => rocnikyLekcie(l.cislo).length > 0)?.cislo || 1;
  vyber.value = rebricek.lekcia;
}

async function vyplnTesty() {
  const { data, error } = await db.from("testy_rychlosti").select("id, nazov, od_dna, do_dna, vytvorene");
  // najnovší prvý; predvolený je test, ktorý práve beží (najnovší s obdobím cez dnešok)
  rebricek.testy = error ? [] : data.sort((a, b) => b.od_dna.localeCompare(a.od_dna) || b.vytvorene.localeCompare(a.vytvorene));
  const beziaci = [...rebricek.testy].sort((a, b) => b.vytvorene.localeCompare(a.vytvorene)).find(bezi); // testy-admin.js
  const vyber = $("testRebricka");
  vyber.innerHTML = "";
  for (const t of rebricek.testy) {
    const m = document.createElement("option");
    m.value = t.id;
    m.textContent = `${t.nazov} (${formatujDen(t.od_dna)} – ${formatujDen(t.do_dna)})`; // testy-admin.js
    vyber.appendChild(m);
  }
  if (!rebricek.testy.some((t) => t.id === rebricek.testId)) rebricek.testId = (beziaci || rebricek.testy[0])?.id || null;
  vyber.value = rebricek.testId || "";
}

function vyplnRozsah() {
  const vyber = $("rozsahRebricka");
  const predtym = vyber.value || spomen("rozsahRebricka") || "skola";
  vyber.innerHTML = "";
  const pridaj = (hodnota, text) => {
    const m = document.createElement("option");
    m.value = hodnota;
    m.textContent = text;
    vyber.appendChild(m);
  };
  pridaj("skola", "Celá škola (všetky moje triedy)");
  const rocniky = [...new Set(triedy.map((t) => t.rocnik).filter((r) => r))].sort((a, b) => a - b); // admin.js
  for (const r of rocniky) pridaj("r" + r, `${r}. ročník`);
  for (const t of triedy) pridaj("t" + t.id, `Trieda ${t.nazov}`);
  vyber.value = [...vyber.options].some((o) => o.value === predtym) ? predtym : "skola";
}

// Prepínače a čo sa ukazuje
function nastavPrepinace() {
  for (const b of document.querySelectorAll("#druhRebricka button")) b.classList.toggle("aktivny", b.dataset.druh === rebricek.druh);
  for (const b of document.querySelectorAll("#rezimRebricka button")) b.classList.toggle("aktivny", b.dataset.rezim === rebricek.rezim);
  const test = rebricek.druh === "test";
  const slava = rebricek.rezim === "slava";
  $("lekciaRebrickaObal").classList.toggle("skryty", test);
  $("testRebrickaObal").classList.toggle("skryty", !test || slava); // sieň slávy testu je spoločná pre všetky roky
  $("rozsahRebrickaObal").classList.toggle("skryty", slava);         // v sieni slávy sú triedy z minulých rokov

  $("popisRebricka").textContent =
    !test && !slava ? "Rating žiaka v lekcii = priemer najlepších bodov z každého cvičenia (nenapísané cvičenie má 0). " +
      "Body = rýchlosť × presnosť³, takže presnosť rozhoduje viac ako rýchlosť. V rebríčku sú aktívni žiaci, " +
      "ktorí majú lekciu v rozsahu svojho ročníka (⚙️ Nastavenia)."
    : !test && slava ? "Najlepší rating každého žiaka v lekcii za každý školský rok, keď ju mal v rozsahu svojho ročníka. " +
      "Ostáva aj po odchode žiaka zo školy. Žiaci pri lekcii vidia len rekord (1. miesto) z celej školy. Ak niekto písal " +
      "za spolužiaka, zmaž jeho podvodné výsledky (Triedy → žiak → Všetky výsledky) a záznam sa tu sám prepočíta."
    : test && !slava ? "Najlepší pokus každého žiaka v teste: čistá rýchlosť (len správne napísané znaky, 5 znakov = 1 slovo). " +
      "Rátajú sa len pokusy s presnosťou aspoň 80 %."
    : "Najrýchlejší pokus každého žiaka v teste rýchlosti za každý školský rok. Žiaci vidia len rekord (1. miesto) " +
      "z celej školy. Pri podvode zmaž podvodné pokusy v Triedy → žiak → Všetky výsledky, záznam sa prepočíta sám.";
}

// ----- Načítanie (pri otvorení časti Rebríčky a pri každej zmene) -----
async function nacitajRebricek() {
  vyplnLekcie();
  vyplnRozsah();
  await vyplnTesty();
  nastavPrepinace();
  const { druh, rezim } = rebricek;
  let odpoved;

  if (druh === "lekcie" && rezim === "rok") {
    odpoved = await db.rpc("rating_lekcie", { p_lekcia: rebricek.lekcia });
  } else if (druh === "lekcie") {
    odpoved = await db.from("rekordy_lekcii")
      .select("id, meno, trieda, skolsky_rok, body, rychlost, presnost, datum")
      .eq("lekcia", rebricek.lekcia).order("body", { ascending: false }).order("datum");
  } else if (rezim === "rok") {
    odpoved = rebricek.testId
      ? await db.rpc("rating_testu", { p_test_id: rebricek.testId })
      : { data: [], error: null };
  } else {
    odpoved = await db.from("rekordy_testu")
      .select("id, meno, trieda, skolsky_rok, rychlost, presnost, datum")
      .order("rychlost", { ascending: false }).order("presnost", { ascending: false }).order("datum");
  }

  if (odpoved.error) {
    rebricek.riadky = [];
    const chyba = odpoved.error;
    ukazHlasku(["PGRST202", "PGRST205", "42P01", "42883"].includes(chyba.code)
      ? "V databáze ešte chýba časť rebríčkov: spusti v Supabase súbory faza11.sql, faza11b.sql a faza12.sql."
      : popisChyby(chyba), true);
  } else {
    rebricek.riadky = odpoved.data;
  }
  vykresliRebricek();
}

// ----- Stĺpce tabuľky podľa toho, čo sa zobrazuje -----
// Každý stĺpec: [nadpis, funkcia, ktorá z riadku spraví text]
function stlpceRebricka() {
  const trieda = (r) => r.trieda ?? (triedy.find((t) => t.id === r.trieda_id)?.nazov || "");
  const presnost = (r) => (r.presnost === null || r.presnost === undefined ? "–" : Math.round(r.presnost) + " %");
  const miesto = ["Miesto", (r) => r.miesto + "."];
  const meno = ["Meno", (r) => r.meno];
  const triedaS = ["Trieda", trieda];
  const rok = ["Školský rok", (r) => r.skolsky_rok];
  const slov = ["Slov/min", (r) => (r.rychlost === null ? "–" : Math.round(r.rychlost))];
  const presnostS = ["Presnosť", presnost];

  if (rebricek.druh === "lekcie" && rebricek.rezim === "rok") {
    const pocet = cviceniaLekcie(rebricek.lekcia).length; // lekcie-obsah.js
    return [miesto, meno, triedaS, ["Rating", (r) => formatujBody(r.body)], slov, presnostS, ["Cvičení", (r) => `${r.cviceni} z ${pocet}`]];
  }
  if (rebricek.druh === "lekcie") return [miesto, meno, triedaS, rok, ["Rating", (r) => formatujBody(r.body)], slov, presnostS];
  if (rebricek.rezim === "rok") return [miesto, meno, triedaS, slov, presnostS, ["Pokusov", (r) => r.pokusov]];
  return [miesto, meno, triedaS, rok, slov, presnostS];
}

// Hodnota, podľa ktorej sa radí: rating pri lekciách, slová za minútu pri teste
const hodnota = (r) => (rebricek.druh === "lekcie" ? Number(r.body) : Number(r.rychlost));

// Riadky podľa „Kto“ (len aktuálny rebríček), zoradené, s miestom (rovnaká hodnota = rovnaké miesto)
function riadkyRebricka() {
  let riadky = rebricek.riadky.map((r) => ({ ...r }));
  if (rebricek.rezim === "rok") {
    const rozsah = $("rozsahRebricka").value;
    const triedaRiadku = (r) => triedy.find((t) => t.id === r.trieda_id);
    if (rozsah.startsWith("r")) riadky = riadky.filter((r) => triedaRiadku(r)?.rocnik === Number(rozsah.slice(1)));
    if (rozsah.startsWith("t")) riadky = riadky.filter((r) => r.trieda_id === rozsah.slice(1));
  }
  riadky.sort((a, b) => hodnota(b) - hodnota(a) || (b.presnost ?? 0) - (a.presnost ?? 0) || podlaAbecedy(a.meno, b.meno));
  riadky.forEach((r, i) => {
    r.miesto = i > 0 && hodnota(riadky[i - 1]) === hodnota(r) ? riadky[i - 1].miesto : i + 1;
  });
  const pocet = Number($("pocetRebricka").value);
  return pocet > 0 ? riadky.filter((r) => r.miesto <= pocet) : riadky;
}

function vykresliRebricek() {
  const stlpce = stlpceRebricka();
  const slava = rebricek.rezim === "slava";

  const hlavicka = $("hlavickaRebricka");
  hlavicka.innerHTML = "";
  const trh = document.createElement("tr");
  for (const [nadpis] of stlpce) {
    const th = document.createElement("th");
    th.textContent = nadpis;
    trh.appendChild(th);
  }
  if (slava) {
    const th = document.createElement("th");
    th.className = "netlacit";
    trh.appendChild(th);
  }
  hlavicka.appendChild(trh);

  const riadky = riadkyRebricka();
  const telo = $("rebricekRiadky");
  telo.innerHTML = "";
  for (const r of riadky) {
    const tr = document.createElement("tr");
    if (r.miesto <= 3) tr.classList.add("miesto-" + r.miesto);
    for (const [, text] of stlpce) {
      const td = document.createElement("td");
      td.textContent = text(r);
      tr.appendChild(td);
    }
    if (slava) {
      const akcie = document.createElement("td");
      akcie.className = "akcie netlacit";
      akcie.appendChild(tlacidlo("Zmazať", "nebezpecne", () => zmazRekord(r))); // tlacidlo je z admin.js
      tr.appendChild(akcie);
    }
    telo.appendChild(tr);
  }

  let prazdne;
  if (rebricek.druh === "test" && !slava && rebricek.testy.length === 0) {
    prazdne = "Zatiaľ nemáš žiadny test rýchlosti. Vytvoríš ho v ⚙️ Nastaveniach.";
  } else if (rebricek.druh === "lekcie" && !slava && rocnikyLekcie(rebricek.lekcia).length === 0) {
    prazdne = "Túto lekciu nemá v rozsahu žiadny ročník (⚙️ Nastavenia → Lekcie od–do), preto nemá rebríček.";
  } else {
    prazdne = slava ? "V sieni slávy zatiaľ nikto nie je." : "Zatiaľ tu nikto nemá výsledok.";
  }
  $("ziadnyRebricek").textContent = prazdne;
  $("ziadnyRebricek").classList.toggle("skryty", riadky.length > 0);
  $("tabulkaRebricka").classList.toggle("skryty", riadky.length === 0);
}

async function zmazRekord(r) {
  const vykon = rebricek.druh === "lekcie" ? `rating ${formatujBody(r.body)}` : `${r.rychlost} slov/min`;
  if (!confirm(`Zmazať záznam ${r.meno} (${r.trieda}, ${r.skolsky_rok}, ${vykon}) zo siene slávy?\n\n` +
               "Výsledky žiaka ostanú. Ak žiak ešte niečo napíše, záznam sa vytvorí znova zo všetkých jeho " +
               "výsledkov tohto školského roka. Pri podvode preto radšej zmaž podvodné výsledky " +
               "v Triedy → žiak → Všetky výsledky, záznam sa potom prepočíta sám.")) return;
  const tabulka = rebricek.druh === "lekcie" ? "rekordy_lekcii" : "rekordy_testu";
  const { error } = await db.from(tabulka).delete().eq("id", r.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Záznam bol zo siene slávy zmazaný.");
  await nacitajRebricek();
}

// ----- Ovládanie -----
for (const b of document.querySelectorAll("#druhRebricka button")) {
  b.addEventListener("click", () => {
    rebricek.druh = b.dataset.druh;
    zapamataj("druhRebricka", rebricek.druh);
    nacitajRebricek();
  });
}
for (const b of document.querySelectorAll("#rezimRebricka button")) {
  b.addEventListener("click", () => {
    rebricek.rezim = b.dataset.rezim;
    zapamataj("rezimRebricka", rebricek.rezim);
    nacitajRebricek();
  });
}
$("lekciaRebricka").addEventListener("change", () => {
  rebricek.lekcia = Number($("lekciaRebricka").value);
  zapamataj("lekciaRebricka", String(rebricek.lekcia));
  nacitajRebricek();
});
$("testRebricka").addEventListener("change", () => {
  rebricek.testId = $("testRebricka").value;
  zapamataj("testRebricka", rebricek.testId);
  nacitajRebricek();
});
$("rozsahRebricka").addEventListener("change", () => {
  zapamataj("rozsahRebricka", $("rozsahRebricka").value);
  vykresliRebricek();
});
$("pocetRebricka").addEventListener("change", vykresliRebricek);

// ----- Tlač: len nadpis a tabuľka (kartičky žiakov sa pri tom vyprázdnia) -----
function nadpisRebricka() {
  const slava = rebricek.rezim === "slava";
  const rozsah = $("rozsahRebricka");
  const kto = slava ? "Sieň slávy" : rozsah.options[rozsah.selectedIndex].text;
  if (rebricek.druh === "lekcie") {
    const l = LEKCIE[rebricek.lekcia - 1];
    return `Lekcia ${l.cislo}: ${l.nazov} – ${kto}`;
  }
  const test = rebricek.testy.find((t) => t.id === rebricek.testId);
  return `Test rýchlosti${!slava && test ? " " + test.nazov : ""} – ${kto}`;
}

$("tlacitRebricek").addEventListener("click", () => {
  if ($("tabulkaRebricka").classList.contains("skryty")) return ukazHlasku("Rebríček je prázdny, nie je čo tlačiť.", true);
  const tlac = $("tlacRebricka");
  tlac.innerHTML = "";
  $("karticky").innerHTML = "";

  const nadpis = document.createElement("h1");
  nadpis.textContent = "Rebríček – " + nadpisRebricka();
  const popis = document.createElement("p");
  popis.textContent = `Desať Prstov · ${new Date().toLocaleDateString("sk-SK")} · ` +
    (rebricek.druh === "lekcie"
      ? "rating = priemer najlepších bodov z cvičení, body = rýchlosť × presnosť³"
      : "čistá rýchlosť za 1 minútu (len správne znaky), presnosť aspoň 80 %");
  const kopia = $("tabulkaRebricka").cloneNode(true);
  kopia.removeAttribute("id");
  kopia.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  kopia.querySelectorAll(".netlacit").forEach((el) => el.remove()); // bez tlačidiel Zmazať
  tlac.append(nadpis, popis, kopia);
  window.print();
});
