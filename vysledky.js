// ===== Ukladanie výsledkov =====
// Výsledky ukladáme do localStorage. Je to malé úložisko v prehliadači,
// ktoré si pamätá dáta aj po zatvorení stránky alebo vypnutí počítača.
// Vie ukladať len text, preto zoznam výsledkov prevádzame na JSON
// (JSON.stringify / JSON.parse robia to isté ako json.dumps / json.loads v Pythone).

const KLUC = "desatPrstov.vysledky"; // pod týmto menom sú výsledky uložené
const POCET_V_TABULKE = 10;

// Načíta všetky uložené výsledky (najstarší je prvý)
function nacitajVysledky() {
  let vysledky;
  try {
    const ulozene = localStorage.getItem(KLUC);
    vysledky = ulozene ? JSON.parse(ulozene) : [];
  } catch (chyba) {
    return []; // keby prehliadač ukladanie nepovolil, aplikácia funguje ďalej
  }

  // Staršie výsledky boli uložené v úhozoch za minútu.
  // Prepočítame ich na slová za minútu (1 slovo = 5 úhozov).
  for (const v of vysledky) {
    if (v.jednotka !== "slova") {
      v.rychlost = Math.round(v.rychlost / 5);
      v.jednotka = "slova";
    }
  }
  return vysledky;
}

// Pridá jeden výsledok na koniec zoznamu a uloží
function ulozVysledok(vysledok) {
  const vsetky = nacitajVysledky();
  vsetky.push(vysledok);
  try {
    localStorage.setItem(KLUC, JSON.stringify(vsetky));
  } catch (chyba) {
    // ukladanie nie je dostupné, výsledok sa len neuloží
  }
}

function vymazVysledky() {
  try {
    localStorage.removeItem(KLUC);
  } catch (chyba) {}
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
  document.getElementById("vymazat").classList.toggle("skryty", !maVysledky);
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

document.getElementById("vymazat").addEventListener("click", () => {
  if (confirm("Naozaj vymazať všetky uložené výsledky?")) {
    vymazVysledky();
    vymazStatistikuKlavesov(); // chyby.js
    vykresliVysledky();
  }
});
