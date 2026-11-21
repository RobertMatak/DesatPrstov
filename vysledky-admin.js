// ===== Výsledky triedy pre učiteľa =====
// Načíta výsledky a štatistiku klávesov všetkých žiakov vybranej triedy.
// Graf (graf.js), mapu chýb (chyby.js) a zhrnutie (vysledky.js) používame
// rovnaké ako v aplikácii žiakov, len im podstrčíme dáta vybraného žiaka
// alebo celej triedy.

let vysledkyTriedy = [];  // všetky výsledky žiakov triedy, najstarší prvý
let klavesyTriedy = [];   // riadky štatistiky klávesov: { ziak_id, znak, spolu, chyby }
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

  // Vybraný žiak z inej triedy (alebo zmazaný) → zobrazíme celú triedu
  if (vybranyZiak) vybranyZiak = ziaci.find((z) => z.id === vybranyZiak.id) || null;

  if (idZiakov.length === 0) {
    vysledkyTriedy = [];
    klavesyTriedy = [];
  } else {
    try {
      const riadky = await nacitajVsetko(() => db
        .from("vysledky")
        .select("id, ziak_id, datum, text_zaciatok, rychlost, presnost, chyby, sekundy")
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
    } catch (chyba) {
      return ukazHlasku(popisChyby(chyba), true);
    }
  }
  vykresliPrehlad();
  vykresliAnalyzu();
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

  nastavVysledky(vysledky);           // vysledky.js (graf.js si ich berie pri prepnutí)
  vykresliGraf(vysledky);             // graf.js: kreslí až od 2 výsledkov
  nastavStatistikuKlavesov(statistika);
  vykresliMapuChyb();                 // chyby.js

  const ziadneData = jeZiak ? vysledky.length === 0 : vysledkyTriedy.length === 0;
  $("ziadneData").classList.toggle("skryty", !ziadneData);

  if (jeZiak) vykresliVysledkyZiaka(vysledky);
}

$("celaTrieda").addEventListener("click", () => {
  vybranyZiak = null;
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
    for (const obsah of [
      formatujDatum(v.datum), v.text, v.rychlost, v.presnost + " %", v.chyby, formatujCas(v.sekundy),
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
