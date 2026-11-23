// ===== Výsledky žiaka =====
// Výsledky sa ukladajú do databázy (Supabase) cez funkciu uloz_vysledok,
// ktorá si overí kód žiaka. Po prihlásení sa všetky výsledky načítajú
// do pamäte (premenná vysledkyZiaka), z nej kreslíme tabuľku a graf.
//
// Keď sa výsledok nepodarí odoslať (napr. vypadne internet), odložíme ho
// v prehliadači a pošleme ho znova pri ďalšom uložení alebo prihlásení.

const POCET_V_TABULKE = 10;
const KLUC_NEODOSLANE = "desatPrstov.neodoslane";

let vysledkyZiaka = []; // výsledky prihláseného žiaka, najstarší prvý

// Vráti výsledky z pamäte (používa graf.js aj script.js)
function nacitajVysledky() {
  return vysledkyZiaka;
}

// Po prihlásení: nastaví výsledky načítané zo servera (volá ziak.js)
function nastavVysledky(vysledky) {
  vysledkyZiaka = vysledky;
}

// ----- Odloženie neodoslaných výsledkov v prehliadači -----
function nacitajNeodoslane() {
  try {
    return JSON.parse(localStorage.getItem(KLUC_NEODOSLANE)) || [];
  } catch (chyba) {
    return [];
  }
}

function ulozNeodoslane(zoznam) {
  try {
    if (zoznam.length === 0) localStorage.removeItem(KLUC_NEODOSLANE);
    else localStorage.setItem(KLUC_NEODOSLANE, JSON.stringify(zoznam));
  } catch (chyba) {}
}

// Pošle jeden výsledok na server. Vráti true, ak sa podarilo.
async function odosliNaServer(polozka) {
  const v = polozka.vysledok;
  const { error } = await db.rpc("uloz_vysledok", {
    p_kod: polozka.kod,
    p_text_zaciatok: v.text,
    p_rychlost: v.rychlost,
    p_presnost: v.presnost,
    p_chyby: v.chyby,
    p_sekundy: v.sekundy,
    p_klavesy: polozka.klavesy,
    p_druh: v.druh || "nahodne",        // náhodný text, kniha alebo lekcia
    p_kapitola_id: v.kapitola_id || null,
    p_lekcia: v.lekcia || null,
    p_cvicenie: v.cvicenie || null,
    p_test_id: v.test_id || null,       // pri teste rýchlosti
  });
  return !error;
}

// Skúsi znova poslať všetko, čo sa predtým nepodarilo
async function odosliNeodoslane() {
  const zoznam = nacitajNeodoslane();
  const zostava = [];
  for (const polozka of zoznam) {
    if (!(await odosliNaServer(polozka))) zostava.push(polozka);
  }
  ulozNeodoslane(zostava);
}

// Uloží výsledok: hneď do pamäte (aby sa prekreslil graf) a potom na server.
// klavesy = štatistika klávesov z tohto textu (z chyby.js)
async function ulozVysledok(vysledok, klavesy) {
  vysledkyZiaka.push(vysledok);

  const stav = document.getElementById("stavUlozenia");
  stav.textContent = "Ukladám výsledok…";
  stav.className = "stav-ulozenia";

  const polozka = { kod: kodZiaka, vysledok, klavesy }; // kodZiaka je v ziak.js
  if (await odosliNaServer(polozka)) {
    stav.textContent = "✓ Výsledok je uložený.";
    stav.classList.add("ok");
    await odosliNeodoslane(); // keď internet znova ide, pošleme aj staršie
  } else {
    ulozNeodoslane([...nacitajNeodoslane(), polozka]);
    stav.textContent = "Výsledok sa nepodarilo uložiť (skontroluj internet). Pošle sa neskôr sám.";
    stav.classList.add("chyba");
  }
}

// Spočíta rekord a priemery. Ak ešte nie sú výsledky, vráti null.
function zhrnutie(vysledky) {
  if (vysledky.length === 0) return null;
  const posledne = vysledky.slice(-POCET_V_TABULKE); // ako vysledky[-10:] v Pythone
  const sucet = (zoznam, pole) => zoznam.reduce((s, v) => s + v[pole], 0);

  return {
    pocet: vysledky.length,
    rekord: Math.max(...vysledky.map((v) => v.rychlost)),
    priemer: Math.round(sucet(posledne, "rychlost") / posledne.length),
    priemernaPresnost: Math.round(sucet(posledne, "presnost") / posledne.length),
  };
}

// "18. 11. 19:46"
function formatujDatum(iso) {
  return new Date(iso).toLocaleString("sk-SK", {
    day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Vykreslí sekciu „Moje výsledky“
function vykresliVysledky() {
  const vysledky = nacitajVysledky();
  const z = zhrnutie(vysledky);
  const maVysledky = z !== null;

  vykresliGraf(vysledky); // graf.js
  vykresliMapuChyb();      // chyby.js

  document.getElementById("ziadneVysledky").classList.toggle("skryty", maVysledky);
  document.getElementById("prehlad").classList.toggle("skryty", !maVysledky);
  document.getElementById("tabulka").classList.toggle("skryty", !maVysledky);
  if (!maVysledky) return;

  document.getElementById("rekord").textContent = z.rekord;
  document.getElementById("priemer").textContent = z.priemer;
  document.getElementById("priemernaPresnost").textContent = z.priemernaPresnost;
  document.getElementById("pocet").textContent = z.pocet;

  // Tabuľka: posledných 10, najnovší hore
  const riadky = document.getElementById("riadky");
  riadky.innerHTML = "";
  for (const v of vysledky.slice(-POCET_V_TABULKE).reverse()) {
    const tr = document.createElement("tr");
    if (v.rychlost === z.rekord) tr.classList.add("rekord-riadok");
    const bunky = [
      formatujDatum(v.datum),
      v.text,
      v.rychlost,
      v.presnost + " %",
      v.chyby,
      formatujCas(v.sekundy),
    ];
    for (const obsah of bunky) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    riadky.appendChild(tr);
  }
}
