// ===== Výsledky triedy pre učiteľa =====
// Načíta výsledky a štatistiku klávesov všetkých žiakov vybranej triedy.
// Graf (graf.js), mapu chýb (chyby.js) a zhrnutie (vysledky.js) používame
// rovnaké ako v aplikácii žiakov, len im podstrčíme dáta vybraného žiaka
// alebo celej triedy.

let vysledkyTriedy = [];  // všetky výsledky žiakov triedy, najstarší prvý (aj s druhom: nahodne / kniha)
let klavesyTriedy = [];   // riadky štatistiky klávesov: { ziak_id, znak, spolu, chyby }
let knihyTriedy = [];     // knihy, ktoré trieda vidí: { id, nazov, kapitoly: [{ id, nazov, slov }] }
let postupTriedy = [];    // postup žiakov v kapitolách: { ziak_id, kapitola_id, pozicia }
const POKUSOV_NA_ZASEKNUTIE = 3; // toľko neúspešných pokusov za sebou = „zasekol sa“
let vybranyZiak = null;   // null = celá trieda
let radenie = { stlpec: "meno", zostupne: false };

// 75 sekúnd → "1:15"
function formatujCas(sekundy) {
  const s = Math.floor(sekundy);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// Supabase vráti naraz najviac 1000 riadkov, preto čítame po stránkach.
// vytvorDotaz je funkcia, ktorá zakaždým vytvorí ten istý dotaz.
async function nacitajVsetko(vytvorDotaz) {
  const VELKOST = 1000;
  let vsetko = [];
  for (let od = 0; ; od += VELKOST) {
    const { data, error } = await vytvorDotaz().range(od, od + VELKOST - 1);
    if (error) throw error;
    vsetko = vsetko.concat(data);
    if (data.length < VELKOST) return vsetko;
  }
}

async function nacitajVysledkyTriedy() {
  const idZiakov = ziaci.map((z) => z.id); // ziaci sú z admin.js

  // Vybraný žiak: ten doterajší, alebo zapamätaný pred obnovením stránky (admin.js).
  // Ak je z inej triedy alebo bol zmazaný, zobrazíme celú triedu.
  const idZiaka = vybranyZiak ? vybranyZiak.id : spomen("ziak");
  vybranyZiak = ziaci.find((z) => z.id === idZiaka) || null;

  if (idZiakov.length === 0) {
    vysledkyTriedy = [];
    klavesyTriedy = [];
    postupTriedy = [];
  } else {
    try {
      const riadky = await nacitajVsetko(() => db
        .from("vysledky")
        .select("id, ziak_id, datum, text_zaciatok, rychlost, presnost, chyby, sekundy, druh, kapitola_id, lekcia, cvicenie")
        .in("ziak_id", idZiakov)
        .order("datum")
        .order("id"));
      // Názov "text" používajú spoločné funkcie (vysledky.js, graf.js)
      vysledkyTriedy = riadky.map((r) => ({ ...r, text: r.text_zaciatok }));

      klavesyTriedy = await nacitajVsetko(() => db
        .from("statistika_klavesov")
        .select("ziak_id, znak, spolu, chyby")
        .in("ziak_id", idZiakov)
        .order("ziak_id")
        .order("znak"));

      postupTriedy = await nacitajVsetko(() => db
        .from("postup_kapitol")
        .select("ziak_id, kapitola_id, pozicia")
        .in("ziak_id", idZiakov)
        .order("ziak_id")
        .order("kapitola_id"));
    } catch (chyba) {
      return ukazHlasku(popisChyby(chyba), true);
    }
  }

  // Všetky knihy učiteľa (sú pre všetky triedy) s kapitolami (bez konceptov) a ich počtom slov
  const { data: knihy, error } = await db
    .from("knihy")
    .select("id, nazov, vytvorene, kapitoly(id, poradie, nazov, text, koncept, vytvorene)")
    .order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);
  knihyTriedy = knihy
    .map((k) => ({
      id: k.id,
      nazov: k.nazov,
      kapitoly: k.kapitoly
        .filter((c) => !c.koncept)
        .sort((a, b) => a.poradie - b.poradie || a.vytvorene.localeCompare(b.vytvorene))
        .map((c) => ({ id: c.id, nazov: c.nazov, slov: c.text.split(/\s+/).filter((s) => s).length })),
    }))
    .filter((k) => k.kapitoly.length > 0);

  vykresliPrehlad();
  vykresliAnalyzu();
}


// ===== Postup v knihách =====
// Koľko slov kapitoly má žiak započítaných (najviac celú kapitolu)
function napisaneZiakom(idZiaka, kap) {
  const p = postupTriedy.find((r) => r.ziak_id === idZiaka && r.kapitola_id === kap.id);
  return Math.min(p ? p.pozicia : 0, kap.slov);
}

const percentaZ = (cast, celok) => (celok === 0 ? 0 : Math.round((cast / celok) * 100));

function percentaKapitolyZiaka(idZiaka, kap) {
  return percentaZ(napisaneZiakom(idZiaka, kap), kap.slov);
}

function percentaKnihyZiaka(idZiaka, kniha) {
  const napisane = kniha.kapitoly.reduce((s, k) => s + napisaneZiakom(idZiaka, k), 0);
  const spolu = kniha.kapitoly.reduce((s, k) => s + k.slov, 0);
  return percentaZ(napisane, spolu);
}

// Pokusy žiaka v kapitole (výsledky s touto kapitolou), najstarší prvý
function pokusyVKapitole(idZiaka, kap) {
  return vysledkyTriedy.filter((r) => r.ziak_id === idZiaka && r.kapitola_id === kap.id);
}

// Zasekol sa = kapitola nie je dopísaná a posledné 3 pokusy v nej mali malú presnosť
function zasekolSa(idZiaka, kap) {
  if (percentaKapitolyZiaka(idZiaka, kap) === 100) return false;
  const posledne = pokusyVKapitole(idZiaka, kap).slice(-POKUSOV_NA_ZASEKNUTIE);
  return posledne.length === POKUSOV_NA_ZASEKNUTIE &&
    posledne.every((r) => r.presnost < potrebnaPresnostTriedy()); // dlzky-admin.js
}

function zasekolSaNiekde(idZiaka) {
  return knihyTriedy.some((kniha) => kniha.kapitoly.some((kap) => zasekolSa(idZiaka, kap)));
}

// Celkové % zo všetkých kníh triedy (null, ak trieda nemá knihy)
function percentaVsetkychKnih(idZiaka) {
  const kapitoly = knihyTriedy.flatMap((k) => k.kapitoly);
  if (kapitoly.length === 0) return null;
  const napisane = kapitoly.reduce((s, k) => s + napisaneZiakom(idZiaka, k), 0);
  return percentaZ(napisane, kapitoly.reduce((s, k) => s + k.slov, 0));
}

// "Kniha: Soľ nad zlato, 2. kapitola" podľa id kapitoly
function popisKapitoly(idKapitoly) {
  for (const kniha of knihyTriedy) {
    const i = kniha.kapitoly.findIndex((k) => k.id === idKapitoly);
    if (i >= 0) return `${kniha.nazov}, ${i + 1}. kap.`;
  }
  return "kniha";
}


// ===== Prehľad triedy (tabuľka žiakov) =====
function prehladZiaka(ziak) {
  const v = vysledkyTriedy.filter((r) => r.ziak_id === ziak.id);
  const z = zhrnutie(v); // vysledky.js; null, ak žiak ešte necvičil
  return {
    ziak,
    meno: ziak.meno,
    pocet: v.length,
    priemer: z ? z.priemer : null,
    presnost: z ? z.priemernaPresnost : null,
    knihy: percentaVsetkychKnih(ziak.id),
    zaseknuty: zasekolSaNiekde(ziak.id),
    rekord: z ? z.rekord : null,
    naposledy: v.length > 0 ? v[v.length - 1].datum : null,
  };
}

function porovnaj(a, b) {
  const x = a[radenie.stlpec];
  const y = b[radenie.stlpec];
  if (x === null && y === null) return 0;
  if (x === null) return 1;  // žiaci bez výsledkov vždy na koniec
  if (y === null) return -1;
  const vysledok = typeof x === "string" ? podlaAbecedy(x, y) : x - y;
  return radenie.zostupne ? -vysledok : vysledok;
}

function vykresliPrehlad() {
  const riadky = ziaci.map(prehladZiaka).sort(porovnaj);
  const telo = $("prehladTriedy");
  telo.innerHTML = "";

  for (const r of riadky) {
    const tr = document.createElement("tr");
    tr.className = "klikatelny";
    if (vybranyZiak && vybranyZiak.id === r.ziak.id) tr.classList.add("vybrany");
    if (!r.ziak.aktivny) tr.classList.add("vypnuty");

    const bunky = [
      r.meno,
      r.pocet,
      r.priemer ?? "–",                       // ?? = ak je vľavo null, použi "–"
      r.presnost === null ? "–" : r.presnost + " %",
      r.knihy === null ? "–" : r.knihy + " %" + (r.zaseknuty ? " ⚠" : ""),
      r.rekord ?? "–",
      r.naposledy ? formatujDatum(r.naposledy) : "nikdy",
    ];
    for (const obsah of bunky) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    tr.addEventListener("click", () => {
      vybranyZiak = r.ziak;
      zapamataj("ziak", r.ziak.id);
      vykresliPrehlad();
      vykresliAnalyzu();
    });
    telo.appendChild(tr);
  }

  // Šípka pri stĺpci, podľa ktorého sa radí
  for (const th of document.querySelectorAll(".prehlad-triedy th")) {
    if (!th.dataset.popis) th.dataset.popis = th.textContent;
    const sipka = th.dataset.stlpec === radenie.stlpec ? (radenie.zostupne ? " ▼" : " ▲") : "";
    th.textContent = th.dataset.popis + sipka;
  }
}

// Kliknutie na nadpis stĺpca: radenie podľa neho (druhé kliknutie otočí poradie)
for (const th of document.querySelectorAll(".prehlad-triedy th")) {
  th.addEventListener("click", () => {
    const stlpec = th.dataset.stlpec;
    if (radenie.stlpec === stlpec) {
      radenie.zostupne = !radenie.zostupne;
    } else {
      // čísla a dátum najprv od najväčšieho, mená od A
      radenie = { stlpec, zostupne: stlpec !== "meno" };
    }
    vykresliPrehlad();
  });
}


// ===== Analýza: vybraný žiak alebo celá trieda =====
function vykresliAnalyzu() {
  const jeZiak = vybranyZiak !== null;
  $("celaTrieda").classList.toggle("skryty", !jeZiak);
  $("vysledkyZiakaKontajner").classList.toggle("skryty", !jeZiak);

  let vysledky;
  const statistika = {}; // znak → { spolu, chyby }

  if (jeZiak) {
    $("nadpisAnalyzy").textContent = vybranyZiak.meno;
    $("popisMapy").textContent =
      "Čím červenejší kláves, tým častejšie sa na ňom žiak mýli. Prejdi myšou nad kláves pre podrobnosti.";
    vysledky = vysledkyTriedy.filter((r) => r.ziak_id === vybranyZiak.id);
    for (const k of klavesyTriedy.filter((k) => k.ziak_id === vybranyZiak.id)) {
      statistika[k.znak] = { spolu: k.spolu, chyby: k.chyby };
    }
  } else {
    $("nadpisAnalyzy").textContent = "Celá trieda " + vybranaTrieda.nazov;
    $("popisMapy").textContent =
      "Súčet chýb všetkých žiakov triedy: ukazuje, ktoré klávesy robia problém najviac.";
    vysledky = []; // graf pre celú triedu nekreslíme
    for (const k of klavesyTriedy) {
      if (!statistika[k.znak]) statistika[k.znak] = { spolu: 0, chyby: 0 };
      statistika[k.znak].spolu += k.spolu;
      statistika[k.znak].chyby += k.chyby;
    }
  }

  vykresliSuhrnDruhov(jeZiak ? vysledky : null);
  vykresliPostupVKnihach();

  nastavVysledky(vysledky);           // vysledky.js (graf.js si ich berie pri prepnutí)
  vykresliGraf(vysledky);             // graf.js: kreslí až od 2 výsledkov
  nastavStatistikuKlavesov(statistika);
  vykresliMapuChyb();                 // chyby.js

  const ziadneData = jeZiak ? vysledky.length === 0 : vysledkyTriedy.length === 0;
  $("ziadneData").classList.toggle("skryty", !ziadneData);

  if (jeZiak) vykresliVysledkyZiaka(vysledky);
}

// Súhrn pre žiaka: náhodné texty a knihy zvlášť
function vykresliSuhrnDruhov(vysledky) {
  $("suhrnDruhovKontajner").classList.toggle("skryty", !vysledky || vysledky.length === 0);
  if (!vysledky) return;

  const telo = $("suhrnDruhov");
  telo.innerHTML = "";
  const potrebna = potrebnaPresnostTriedy(); // dlzky-admin.js
  const druhy = [
    { nazov: "Náhodné texty", druh: "nahodne" },
    { nazov: "Knihy", druh: "kniha" },
    // neskôr: { nazov: "Lekcie", druh: "lekcia" },
  ];
  for (const d of druhy) {
    const v = vysledky.filter((r) => (r.druh || "nahodne") === d.druh);
    const z = zhrnutie(v); // vysledky.js
    const uspesne = d.druh === "kniha"
      ? `${v.filter((r) => r.presnost >= potrebna).length} z ${v.length} (aspoň ${potrebna} %)`
      : "–";
    const tr = document.createElement("tr");
    for (const obsah of [d.nazov, v.length, z ? z.priemer : "–", z ? z.priemernaPresnost + " %" : "–", uspesne]) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    telo.appendChild(tr);
  }
}

// Postup v knihách: pre žiaka jeho kapitoly, pre celú triedu koľko žiakov kapitolu dopísalo
function vykresliPostupVKnihach() {
  $("postupVKnihachKontajner").classList.toggle("skryty", knihyTriedy.length === 0);
  const obal = $("postupVKnihach");
  obal.innerHTML = "";
  if (knihyTriedy.length === 0) return;

  const potrebna = potrebnaPresnostTriedy();
  $("popisPostupuKnih").textContent = vybranyZiak
    ? `Na postup potrebuje presnosť aspoň ${potrebna} %. ⚠ = posledné ${POKUSOV_NA_ZASEKNUTIE} pokusy v kapitole boli pod touto hranicou.`
    : `Koľko žiakov kapitolu dopísalo. ⚠ = počet žiakov, ktorí sa v kapitole zasekli (${POKUSOV_NA_ZASEKNUTIE} neúspešné pokusy za sebou).`;

  for (const kniha of knihyTriedy) {
    const blok = document.createElement("div");
    blok.className = "postup-kniha";
    const nadpis = document.createElement("div");
    nadpis.className = "postup-kniha-nazov";
    nadpis.textContent = vybranyZiak
      ? `${kniha.nazov} · ${percentaKnihyZiaka(vybranyZiak.id, kniha)} %`
      : kniha.nazov;
    blok.appendChild(nadpis);

    kniha.kapitoly.forEach((kap, i) => {
      const riadok = document.createElement("div");
      riadok.className = "postup-kapitola";
      const nazov = document.createElement("span");
      nazov.textContent = `${i + 1}. ${kap.nazov || "Kapitola " + (i + 1)}`;

      let percent;
      let popis;
      if (vybranyZiak) {
        percent = percentaKapitolyZiaka(vybranyZiak.id, kap);
        const pokusy = pokusyVKapitole(vybranyZiak.id, kap);
        const posledne = pokusy.slice(-3).map((r) => r.presnost + " %").join(", ");
        popis = `${percent} %` + (pokusy.length > 0 ? ` · ${pokusy.length} pokusov · posledné: ${posledne}` : "");
        if (zasekolSa(vybranyZiak.id, kap)) {
          popis += " · ⚠ zasekol sa";
          riadok.classList.add("zaseknuty");
        }
      } else {
        const dopisali = ziaci.filter((z) => percentaKapitolyZiaka(z.id, kap) === 100).length;
        const zasekli = ziaci.filter((z) => zasekolSa(z.id, kap)).length;
        percent = percentaZ(dopisali, ziaci.length);
        popis = `dopísalo ${dopisali} z ${ziaci.length}` + (zasekli > 0 ? ` · ⚠ zasekli sa: ${zasekli}` : "");
        if (zasekli > 0) riadok.classList.add("zaseknuty");
      }

      const pruh = document.createElement("div");
      pruh.className = "pruh";
      const vypln = document.createElement("div");
      vypln.style.width = percent + "%";
      pruh.appendChild(vypln);
      const info = document.createElement("span");
      info.className = "sivy";
      info.textContent = popis;

      riadok.append(nazov, pruh, info);
      blok.appendChild(riadok);
    });
    obal.appendChild(blok);
  }
}

$("celaTrieda").addEventListener("click", () => {
  vybranyZiak = null;
  zapamataj("ziak", null);
  vykresliPrehlad();
  vykresliAnalyzu();
});


// ===== Zoznam výsledkov žiaka a mazanie =====
function vykresliVysledkyZiaka(vysledky) {
  const telo = $("vysledkyZiakaRiadky");
  telo.innerHTML = "";
  $("zmazatVsetkyVysledky").classList.toggle("skryty", vysledky.length === 0 && Object.keys(nacitajStatistikuKlavesov()).length === 0);

  for (const v of [...vysledky].reverse()) { // najnovší hore
    const tr = document.createElement("tr");
    const druh = v.druh === "kniha" ? "📚 " + popisKapitoly(v.kapitola_id)
      : v.druh === "lekcia" ? `⌨️ Lekcia ${v.lekcia}, cv. ${v.cvicenie}` : "náhodný";
    for (const obsah of [
      formatujDatum(v.datum), druh, v.text, v.rychlost, v.presnost + " %", v.chyby, formatujCas(v.sekundy),
    ]) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    const akcie = document.createElement("td");
    akcie.className = "akcie";
    akcie.appendChild(tlacidlo("Zmazať", "nebezpecne", () => zmazVysledok(v))); // tlacidlo je z admin.js
    tr.appendChild(akcie);
    telo.appendChild(tr);
  }
}

async function zmazVysledok(v) {
  if (!confirm(`Zmazať výsledok z ${formatujDatum(v.datum)} (${v.rychlost} slov/min)?\n` +
               "Štatistika klávesov žiaka ostane bez zmeny.")) return;

  const { error } = await db.from("vysledky").delete().eq("id", v.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Výsledok bol zmazaný.");
  await nacitajVysledkyTriedy();
}

$("zmazatVsetkyVysledky").addEventListener("click", () => {
  const ziak = vybranyZiak;
  if (!confirm(`Zmazať VŠETKY výsledky a štatistiku klávesov žiaka ${ziak.meno}?\n` +
               "Žiak aj jeho kód ostanú. Toto sa nedá vrátiť.")) return;

  sTlacidlom($("zmazatVsetkyVysledky"), async () => {
    const { error: chyba1 } = await db.from("vysledky").delete().eq("ziak_id", ziak.id);
    const { error: chyba2 } = await db.from("statistika_klavesov").delete().eq("ziak_id", ziak.id);
    if (chyba1 || chyba2) return ukazHlasku(popisChyby(chyba1 || chyba2), true);
    ukazHlasku(`Výsledky žiaka ${ziak.meno} boli zmazané.`);
    await nacitajVysledkyTriedy();
  });
});
