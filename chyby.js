// ===== Štatistika chybných klávesov =====
// Pre každý znak si pamätáme, koľkokrát ho bolo treba napísať (spolu)
// a koľkokrát sa pri ňom urobila chyba (chyby). Napríklad:
//   { "a": { spolu: 120, chyby: 3 }, "ď": { spolu: 15, chyby: 4 } }
// Počas písania sa počíta do aktualnaStatistika, po dopísaní textu sa
// pripočíta k uloženej štatistike v localStorage (rovnako ako výsledky).

const KLUC_KLAVESY = "desatPrstov.klavesy";
const MIN_POKUSOV = 5;     // znaky napísané menej ako 5-krát ešte nehodnotíme
const PLNA_CERVENA = 0.15; // pri 15 % chýb a viac je kláves úplne červený

let aktualnaStatistika = {};

// Začiatok nového textu: počítame odznova
function zacniStatistikuKlavesov() {
  aktualnaStatistika = {};
}

// Zavolá sa pri každom úhoze: ktorý znak sa mal napísať a či bol správne
function zapisUhoz(ocakavanyZnak, spravne) {
  if (!aktualnaStatistika[ocakavanyZnak]) {
    aktualnaStatistika[ocakavanyZnak] = { spolu: 0, chyby: 0 };
  }
  aktualnaStatistika[ocakavanyZnak].spolu++;
  if (!spravne) aktualnaStatistika[ocakavanyZnak].chyby++;
}

function nacitajStatistikuKlavesov() {
  try {
    const ulozene = localStorage.getItem(KLUC_KLAVESY);
    return ulozene ? JSON.parse(ulozene) : {};
  } catch (chyba) {
    return {};
  }
}

// Po dopísaní textu: pripočíta aktuálny text k uloženej štatistike
function ulozStatistikuKlavesov() {
  const ulozena = nacitajStatistikuKlavesov();
  for (const [znak, udaje] of Object.entries(aktualnaStatistika)) {
    if (!ulozena[znak]) ulozena[znak] = { spolu: 0, chyby: 0 };
    ulozena[znak].spolu += udaje.spolu;
    ulozena[znak].chyby += udaje.chyby;
  }
  try {
    localStorage.setItem(KLUC_KLAVESY, JSON.stringify(ulozena));
  } catch (chyba) {}
  aktualnaStatistika = {};
}

function vymazStatistikuKlavesov() {
  try {
    localStorage.removeItem(KLUC_KLAVESY);
  } catch (chyba) {}
}

// Prevedie štatistiku znakov na štatistiku fyzických klávesov.
// Napríklad "ď" sa píše ako ˇ + D, takže jeho čísla sa pripočítajú
// klávesu ´ˇ aj klávesu D. Veľké "A" sa pripočíta klávesu A.
function statistikaPodlaKlavesov(statistika) {
  const klavesy = {};
  for (const [znak, udaje] of Object.entries(statistika)) {
    for (const krok of krokyPreZnak(znak)) { // krokyPreZnak je v klavesnica.js
      if (!klavesy[krok.kod]) klavesy[krok.kod] = { spolu: 0, chyby: 0 };
      klavesy[krok.kod].spolu += udaje.spolu;
      klavesy[krok.kod].chyby += udaje.chyby;
    }
  }
  return klavesy;
}

function nazovZnaku(znak) {
  return znak === " " ? "medzera" : znak;
}

// Vykreslí malú klávesnicu zafarbenú podľa chybovosti + zoznam najhorších znakov
function vykresliMapuChyb() {
  const statistika = nacitajStatistikuKlavesov();
  const maData = Object.keys(statistika).length > 0;
  document.getElementById("chybyKontajner").classList.toggle("skryty", !maData);
  if (!maData) return;

  // 1) Klávesnica
  const mapa = document.getElementById("mapaChyb");
  vykresliKlavesnicu(mapa); // tá istá funkcia ako pre hlavnú klávesnicu
  const klavesy = statistikaPodlaKlavesov(statistika);

  for (const klavesEl of mapa.querySelectorAll(".klaves[data-kod]")) {
    const udaje = klavesy[klavesEl.dataset.kod];

    if (!udaje || udaje.spolu < MIN_POKUSOV) {
      klavesEl.style.background = "#f1efe9"; // málo dát: sivý
      klavesEl.title = "Zatiaľ málo dát";
      continue;
    }

    const pomer = udaje.chyby / udaje.spolu;   // 0 až 1
    const sila = Math.min(1, pomer / PLNA_CERVENA);
    // Biela pri 0 % chýb, postupne červenšia až po plnú červenú
    klavesEl.style.background = sila === 0
      ? "#ffffff"
      : `rgba(217, 68, 59, ${0.15 + sila * 0.85})`;
    if (sila > 0.6) klavesEl.style.color = "white";
    klavesEl.title = `${udaje.chyby} chýb z ${udaje.spolu} (${Math.round(pomer * 100)} %)`;
  }

  // 2) Zoznam 5 najproblémovejších znakov
  const najhorsie = Object.entries(statistika)
    .filter(([, u]) => u.spolu >= MIN_POKUSOV && u.chyby > 0)
    .map(([znak, u]) => ({ znak, ...u, pomer: u.chyby / u.spolu }))
    .sort((a, b) => b.pomer - a.pomer)   // od najhoršieho
    .slice(0, 5);

  const zoznamEl = document.getElementById("problemoveZnaky");
  if (najhorsie.length === 0) {
    zoznamEl.textContent = "Zatiaľ žiadne problémové znaky. Výborne!";
  } else {
    zoznamEl.textContent = "Najviac chýb: " + najhorsie
      .map((z) => `${nazovZnaku(z.znak)} (${Math.round(z.pomer * 100)} %)`)
      .join(", ");
  }
}
