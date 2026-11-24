// ===== Nástenka siene slávy (učiteľ) – fáza 14 =====
// Prehľad všetkých rekordov na tlač v štýle učiteľovej excelovej tabuľky:
//   - 🏆 Najlepší zo školy (všetky lekcie a test rýchlosti)
//   - Najlepší z 1. stupňa (1.–4. ročník) a z 2. stupňa (5.–9. ročník)
//   - Najlepší z každého ročníka (jeho lekcie podľa ⚙️ Nastavení a test)
// Pri každej lekcii je jeden rekordér všetkých čias (zo siene slávy).
//
// Tlač je „modulárna“: všetky rozmery sú v milimetroch, takže riadok má
// na nástenke aj na samostatnej prelepke presne rovnakú veľkosť. Keď niekto
// prekoná rekord, vytlačí sa len nový riadok a prelepí sa ním starý.
// Čo je na nástenke vytlačené, si pamätá databáza (tabuľka nastenka_ucitela).

const FORMATY = {
  // page = rozmer papiera pre tlač (šírka × výška); A2 nemá v CSS vlastný názov, preto všade mm
  A4: { nazov: "A4 na výšku (2 listy)", page: "210mm 297mm", k: 1, vedla: false },
  A3: { nazov: "A3 na šírku (všetko na 1 liste)", page: "420mm 297mm", k: 1, vedla: true },
  A2: { nazov: "A2 na šírku (1 list, všetko 1,4× väčšie)", page: "594mm 420mm", k: Math.SQRT2, vedla: true },
};

// Farby blokov (ročníky podľa učiteľovej tabuľky)
const FARBY_NASTENKY = {
  skola: ["#f2b01e", "#222"], st1: ["#26a69a", "#fff"], st2: ["#1e3a8a", "#fff"],
  r1: ["#f8bbd0", "#222"], r2: ["#d1c4e9", "#222"], r3: ["#7b3fa0", "#fff"], r4: ["#e53935", "#fff"],
  r5: ["#ffc000", "#222"], r6: ["#ffeb3b", "#222"], r7: ["#92d050", "#222"], r8: ["#00a651", "#fff"],
  r9: ["#00b0f0", "#fff"],
};

const nastenka = {
  rekordyLekcii: [],  // všetky záznamy siene slávy lekcií
  rekordyTestu: [],   // všetky záznamy siene slávy testu
  ulozena: null,      // { format, vytlacene, obsah } posledná vytlačená nástenka
  bloky: [],          // vypočítané bloky s riadkami
  zmeny: new Set(),   // kľúče riadkov zmenených od poslednej tlače
  vybrane: new Set(), // kľúče riadkov na prelepky (zmeny + ručný výber)
};

// Ročník z názvu triedy v čase rekordu: "5.D" → 5, "Krúžok" → null
const rocnikTriedy = (trieda) => {
  const m = /^([1-9])\./.exec(trieda || "");
  return m ? Number(m[1]) : null;
};

// Lekcie ročníka podľa nastavení (dlzky-admin.js); pre viac ročníkov ich zjednotenie
function lekcieRocnikov(rocniky) {
  const lekcie = new Set();
  for (const r of rocniky) {
    if (lekcieOd[r - 1] >= 1) for (let l = lekcieOd[r - 1]; l <= lekcieDo[r - 1]; l++) lekcie.add(l);
  }
  return [...lekcie].sort((a, b) => a - b);
}

// ----- Načítanie -----
async function nacitajNastenku() {
  const [lek, tes, ulo] = await Promise.all([
    db.from("rekordy_lekcii").select("lekcia, meno, trieda, skolsky_rok, body, rychlost, presnost, datum"),
    db.from("rekordy_testu").select("meno, trieda, skolsky_rok, rychlost, presnost, datum"),
    db.from("nastenka_ucitela").select("format, vytlacene, obsah"),
  ]);
  const chyba = lek.error || tes.error || ulo.error;
  if (chyba) {
    $("stavNastenky").textContent = "";
    $("nahladNastenky").innerHTML = "";
    return ukazHlasku(["PGRST205", "42P01"].includes(chyba.code)
      ? "V databáze ešte chýba nástenka: spusti v Supabase súbor faza14.sql."
      : popisChyby(chyba), true);
  }
  nastenka.rekordyLekcii = lek.data;
  nastenka.rekordyTestu = tes.data;
  nastenka.ulozena = ulo.data[0] || null;
  if (nastenka.ulozena) $("formatNastenky").value = nastenka.ulozena.format;

  zostavBloky();
  najdiZmeny();
  vykresliNastenku();
}

// ----- Bloky a riadky -----
function najlepsiaLekcia(lekcia, patri) {
  return nastenka.rekordyLekcii
    .filter((r) => r.lekcia === lekcia && patri(r))
    .sort((a, b) => Number(b.body) - Number(a.body) || a.datum.localeCompare(b.datum))[0] || null;
}

function najlepsiTest(patri) {
  return nastenka.rekordyTestu
    .filter(patri)
    .sort((a, b) => b.rychlost - a.rychlost || b.presnost - a.presnost || a.datum.localeCompare(b.datum))[0] || null;
}

function zostavBloky() {
  const vRocnikoch = (rocniky) => (r) => rocniky.includes(rocnikTriedy(r.trieda));
  const definicie = [
    { id: "skola", nazov: "🏆 Najlepší zo školy", lekcie: LEKCIE.map((l) => l.cislo), patri: () => true }, // lekcie-obsah.js
    { id: "st1", nazov: "Najlepší z 1. stupňa", lekcie: lekcieRocnikov([1, 2, 3, 4]), patri: vRocnikoch([1, 2, 3, 4]) },
    { id: "st2", nazov: "Najlepší z 2. stupňa", lekcie: lekcieRocnikov([5, 6, 7, 8, 9]), patri: vRocnikoch([5, 6, 7, 8, 9]) },
  ];
  for (let r = 1; r <= 9; r++) {
    definicie.push({ id: "r" + r, nazov: `${r}. ročník`, lekcie: lekcieRocnikov([r]), patri: vRocnikoch([r]) });
  }

  nastenka.bloky = definicie.map((d) => ({
    ...d,
    riadky: [
      ...d.lekcie.map((l) => ({ kluc: `${d.id}|L${l}`, lekcia: l, rekord: najlepsiaLekcia(l, d.patri) })),
      { kluc: `${d.id}|T`, lekcia: null, rekord: najlepsiTest(d.patri) },
    ],
  }));
}

// Čo je v riadku (na porovnanie s tým, čo je vytlačené na nástenke)
function podpisRiadku(riadok) {
  const r = riadok.rekord;
  if (!r) return null;
  return { meno: r.meno, rok: r.skolsky_rok, trieda: r.trieda, body: r.body ?? null, rychlost: r.rychlost, presnost: r.presnost };
}

function najdiZmeny() {
  nastenka.zmeny = new Set();
  const obsah = nastenka.ulozena?.vytlacene ? nastenka.ulozena.obsah : null;
  if (obsah) {
    for (const blok of nastenka.bloky) {
      for (const riadok of blok.riadky) {
        if (JSON.stringify(podpisRiadku(riadok)) !== JSON.stringify(obsah[riadok.kluc] ?? null)) nastenka.zmeny.add(riadok.kluc);
      }
    }
  }
  nastenka.vybrane = new Set(nastenka.zmeny);
}

// ----- Vykreslenie (náhľad aj tlač používajú to isté) -----
const formatujBodyN = (n) => Number(n).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function bunka(znacka, trieda, ...obsah) {
  const el = document.createElement(znacka);
  if (trieda) el.className = trieda;
  el.append(...obsah);
  return el;
}

function maly(text) {
  return bunka("small", "", text);
}

// Jeden riadok tabuľky (aj na prelepku)
function riadokNastenky(riadok) {
  const tr = document.createElement("tr");
  tr.dataset.kluc = riadok.kluc;
  const r = riadok.rekord;
  const test = riadok.lekcia === null;
  if (test) tr.className = "test";

  tr.appendChild(test
    ? bunka("td", "l", bunka("b", "", "⏱️"), maly("Test"))
    : bunka("td", "l", bunka("b", "", "L" + riadok.lekcia), maly(LEKCIE[riadok.lekcia - 1].nazov)));
  if (!r) {
    tr.append(bunka("td", "", ""), bunka("td", "m prazdne", "zatiaľ nikto"), bunka("td", "", ""), bunka("td", "b", ""));
    return tr;
  }
  tr.append(bunka("td", "", r.skolsky_rok), bunka("td", "m", r.meno), bunka("td", "", r.trieda));
  tr.appendChild(test
    ? bunka("td", "b", bunka("b", "", `${r.rychlost} SzM`), maly(`presnosť ${r.presnost} %`))
    : bunka("td", "b", bunka("b", "", formatujBodyN(r.body)), maly(`${r.rychlost} SzM · ${r.presnost} %`)));
  return tr;
}

// Hlavička bloku: farebný pruh s názvom, Rating a druhý riadok so stĺpcami
function hlavickaBloku(blok) {
  const [farba, text] = FARBY_NASTENKY[blok.id];
  const thead = document.createElement("thead");
  const h1 = document.createElement("tr");
  h1.className = "h1";
  const roh = bunka("th", "roh", "");
  roh.rowSpan = 2;
  const nazov = bunka("th", "nazov", blok.nazov);
  nazov.colSpan = 3;
  const rating = bunka("th", "rt", "Rating");
  for (const th of [nazov, rating]) {
    th.style.background = farba;
    th.style.color = text;
  }
  h1.append(roh, nazov, rating);
  const h2 = document.createElement("tr");
  h2.className = "h2";
  h2.append(bunka("th", "", "Šk. rok"), bunka("th", "", "Meno"), bunka("th", "", "Trieda"), bunka("th", "", "rýchlosť × presnosť³"));
  thead.append(h1, h2);
  return thead;
}

// Pevné šírky stĺpcov (v mm): rovnaké na nástenke aj na prelepke
function stlpceTabulky() {
  const colgroup = document.createElement("colgroup");
  for (const trieda of ["c-l", "c-rok", "c-meno", "c-trieda", "c-rating"]) {
    colgroup.appendChild(bunka("col", trieda));
  }
  return colgroup;
}

function tabulkaBloku(blok) {
  const tabulka = bunka("table", "nb");
  tabulka.appendChild(stlpceTabulky());
  const tbody = document.createElement("tbody");
  for (const riadok of blok.riadky) tbody.appendChild(riadokNastenky(riadok));
  tabulka.append(hlavickaBloku(blok), tbody);
  return tabulka;
}

// Celá nástenka: list 1 (škola + stupne), list 2 (ročníky)
function zostavNastenku(format) {
  const f = FORMATY[format];
  const obal = bunka("div", `nastenka ${f.vedla ? "vedla" : ""}`);
  obal.style.setProperty("--mm", `${f.k}mm`);
  const blok = (id) => nastenka.bloky.find((b) => b.id === id);
  const datum = new Date().toLocaleDateString("sk-SK");

  const list1 = bunka("section", "list");
  list1.append(
    bunka("h1", "", "Sieň slávy – Desať Prstov"),
    bunka("p", "popis", `Najlepší výkon všetkých čias · stav k ${datum} · Rating = priemer najlepších bodov z cvičení lekcie, ` +
      "body = rýchlosť × presnosť³ · SzM = slová za minútu · ⏱️ = test rýchlosti (1 minúta)"),
  );
  const stlpce = bunka("div", "stlpce");
  stlpce.append(bunka("div", "stlpec", tabulkaBloku(blok("skola"))),
    bunka("div", "stlpec", tabulkaBloku(blok("st1")), tabulkaBloku(blok("st2"))));
  list1.appendChild(stlpce);

  const list2 = bunka("section", "list");
  list2.append(bunka("h1", "", "Najlepší z ročníka"),
    bunka("p", "popis", "Najlepší výkon všetkých čias v každom ročníku (ročník podľa triedy v čase rekordu)"));
  // Ročníky rozdelíme do dvoch stĺpcov po poradí (napr. 1.–5. vľavo, 6.–9. vpravo)
  // a hranicu vyberieme tak, aby boli stĺpce čo najrovnakejšie vysoké.
  const rocniky = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => blok("r" + r));
  const vyska = (b) => b.riadky.length + 1.9; // v riadkoch: telo + hlavička a medzera
  let najlepsie = 1;
  let najmensia = Infinity;
  for (let k = 1; k < 9; k++) {
    const vlavo = rocniky.slice(0, k).reduce((v, b) => v + vyska(b), 0);
    const vpravo = rocniky.slice(k).reduce((v, b) => v + vyska(b), 0);
    if (Math.max(vlavo, vpravo) < najmensia) { najmensia = Math.max(vlavo, vpravo); najlepsie = k; }
  }
  const s1 = bunka("div", "stlpec", ...rocniky.slice(0, najlepsie).map(tabulkaBloku));
  const s2 = bunka("div", "stlpec", ...rocniky.slice(najlepsie).map(tabulkaBloku));
  list2.appendChild(bunka("div", "stlpce", s1, s2));

  obal.append(list1, list2);
  return obal;
}

function vykresliNastenku() {
  const format = $("formatNastenky").value;
  const nahlad = $("nahladNastenky");
  nahlad.innerHTML = "";
  const n = zostavNastenku(format);
  nahlad.appendChild(n);

  // Náhľad zmenšíme tak, aby sa zmestil na šírku stránky (rozmery sú v mm)
  nahlad.style.zoom = "";
  const zoom = Math.min(1, (nahlad.clientWidth - 4) / n.scrollWidth);
  nahlad.style.zoom = zoom;

  // Zmenené a vybrané riadky; kliknutím sa pridajú alebo odoberú z prelepiek
  for (const tr of nahlad.querySelectorAll("tr[data-kluc]")) {
    const kluc = tr.dataset.kluc;
    tr.classList.toggle("zmena", nastenka.zmeny.has(kluc));
    tr.classList.toggle("vybrany", nastenka.vybrane.has(kluc));
    tr.title = "Klikni: pridať alebo odobrať z prelepiek";
    tr.addEventListener("click", () => {
      if (nastenka.vybrane.has(kluc)) nastenka.vybrane.delete(kluc);
      else nastenka.vybrane.add(kluc);
      tr.classList.toggle("vybrany", nastenka.vybrane.has(kluc));
      aktualizujStavNastenky();
    });
  }
  aktualizujStavNastenky();
}

function aktualizujStavNastenky() {
  const u = nastenka.ulozena;
  const pocet = nastenka.vybrane.size;
  $("tlacitPrelepky").textContent = `✂️ Vytlačiť prelepky (${pocet})`;
  $("tlacitPrelepky").disabled = pocet === 0;

  if (!u || !u.vytlacene) {
    $("stavNastenky").textContent = "Nástenku si ešte netlačil. Najprv vytlač celú nástenku; potom ti tu " +
      "ponúknem prelepky pre riadky, ktoré sa zmenia. Kliknutím na riadok ho môžeš pridať do prelepiek aj ručne.";
    return;
  }
  const kedy = new Date(u.vytlacene).toLocaleDateString("sk-SK");
  $("stavNastenky").textContent =
    `Nástenku si naposledy tlačil ${kedy} vo formáte ${u.format}. ` +
    (nastenka.zmeny.size === 0 ? "Odvtedy sa nič nezmenilo. "
      : nastenka.zmeny.size === 1 ? "Odvtedy sa zmenil 1 riadok (žltý). "
      : nastenka.zmeny.size <= 4 ? `Odvtedy sa zmenili ${nastenka.zmeny.size} riadky (žlté). `
      : `Odvtedy sa zmenilo ${nastenka.zmeny.size} riadkov (žlté). `) +
    "Vybrané na prelepky sú orámované; kliknutím na riadok ho pridáš alebo odoberieš.";
}


// ===== Tlač =====
// Veľkosť papiera nastavíme cez @page (prehliadač ju použije aj pri uložení do PDF)
function nastavPapier(page) {
  let styl = document.getElementById("stylPapiera");
  if (!styl) {
    styl = document.createElement("style");
    styl.id = "stylPapiera";
    document.head.appendChild(styl);
  }
  styl.textContent = `@page { size: ${page}; margin: 8mm; }`;
}

// Uloží, čo je teraz na nástenke (všetko, alebo len vytlačené prelepky)
async function zapamatajNastenku(kluce, format) {
  const obsah = { ...(nastenka.ulozena?.obsah || {}) };
  for (const blok of nastenka.bloky) {
    for (const riadok of blok.riadky) {
      if (kluce === null || kluce.has(riadok.kluc)) obsah[riadok.kluc] = podpisRiadku(riadok);
    }
  }
  const { data: prihlasenie } = await db.auth.getSession();
  const zaznam = {
    ucitel_id: prihlasenie.session.user.id,
    format,
    vytlacene: kluce === null ? new Date().toISOString() : nastenka.ulozena?.vytlacene || new Date().toISOString(),
    obsah,
  };
  const { error } = await db.from("nastenka_ucitela").upsert(zaznam);
  if (error) return ukazHlasku(popisChyby(error), true);
  nastenka.ulozena = zaznam;
  najdiZmeny();
  vykresliNastenku();
}

const PRIPOMIENKA_MIERKY = "V okne tlače nastav MIERKU 100 % (nie „Prispôsobiť stránke“), " +
  "inak prelepky nebudú sedieť na nástenku.";

$("tlacitNastenku").addEventListener("click", async () => {
  const format = $("formatNastenky").value;
  if (!confirm(`Tlač nástenky: ${FORMATY[format].nazov}.\n\n${PRIPOMIENKA_MIERKY}` +
      (format === "A2" ? "\n\nA2: v okne tlače zvoľ „Uložiť ako PDF“ a PDF zanes do kopírovacieho centra." : ""))) return;
  const tlac = $("tlacRebricka");
  $("karticky").innerHTML = "";
  tlac.innerHTML = "";
  tlac.appendChild(zostavNastenku(format));
  nastavPapier(FORMATY[format].page);
  window.print();
  nastavPapier("auto"); // ostatná tlač (kartičky, rebríčky) zase na bežný papier
  if (confirm("Podarilo sa nástenku vytlačiť (alebo uložiť do PDF)?\n\nOK = zapamätám si, čo je na nástenke, " +
      "a nabudúce ti ponúknem len zmenené riadky na prelepky.")) {
    await zapamatajNastenku(null, format);
    ukazHlasku("Zapamätal som si, čo je na nástenke.");
  }
});

$("tlacitPrelepky").addEventListener("click", async () => {
  const format = $("formatNastenky").value;
  const kluce = new Set(nastenka.vybrane);
  if (kluce.size === 0) return;
  if (!confirm(`Prelepky (${kluce.size}) vo veľkosti pre nástenku ${format}, vytlačia sa na A4.\n\n${PRIPOMIENKA_MIERKY}`)) return;

  const obal = bunka("div", "nastenka prelepky");
  obal.style.setProperty("--mm", `${FORMATY[format].k}mm`);
  obal.appendChild(bunka("p", "popis",
    `Prelepky na nástenku siene slávy (${format}) · vystrihni po vonkajšom okraji riadku a nalep na riadok podľa popisu nad ním.`));
  const zoznam = bunka("div", "zoznam-prelepiek");
  for (const blok of nastenka.bloky) {
    for (const riadok of blok.riadky) {
      if (!kluce.has(riadok.kluc)) continue;
      const kam = `${blok.nazov.replace("🏆 ", "")} · ${riadok.lekcia ? "L" + riadok.lekcia + " " + LEKCIE[riadok.lekcia - 1].nazov : "Test rýchlosti"}`;
      const tabulka = bunka("table", "nb");
      tabulka.append(stlpceTabulky(), bunka("tbody", "", riadokNastenky(riadok)));
      zoznam.appendChild(bunka("div", "prelepka", bunka("div", "kam", "Nalepiť: " + kam), tabulka));
    }
  }
  obal.appendChild(zoznam);

  const tlac = $("tlacRebricka");
  $("karticky").innerHTML = "";
  tlac.innerHTML = "";
  tlac.appendChild(obal);
  nastavPapier("210mm 297mm"); // prelepky vždy na A4
  window.print();
  nastavPapier("auto");
  if (confirm("Podarilo sa prelepky vytlačiť?\n\nOK = zapamätám si, že tieto riadky sú na nástenke prelepené.")) {
    await zapamatajNastenku(kluce, nastenka.ulozena?.format || format);
    ukazHlasku("Zapamätal som si prelepené riadky.");
  }
});

$("formatNastenky").addEventListener("change", vykresliNastenku);
window.addEventListener("resize", () => {
  if (!$("nastenkaObal").classList.contains("skryty")) vykresliNastenku();
});
