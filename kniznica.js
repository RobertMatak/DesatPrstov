// ===== Menu, knižnica a kapitoly (aplikácia žiaka) =====
// Obrazovky: písanie, knižnica (všetky knihy), kniha (kapitoly), moje výsledky.
// Knihu žiak píše kapitolu po kapitole. Ďalšia kapitola sa odomkne,
// až keď dopíše predchádzajúcu. Postup sa ukladá na server.

const ZAMYKAT_KAPITOLY = true; // false = žiak môže začať ktorúkoľvek kapitolu
const FARBY_OBALOK = ["#f6c1cc", "#fbd9a8", "#fdf0a6", "#c3e6b8", "#b9dcf2", "#d8c8f0", "#f3c9b0", "#c7e3dc"];

let knihyZiaka = [];         // [{ id, nazov, autor, zdroj, kapitoly: [{ id, nazov, slov }] }]
let postupKapitol = {};      // id kapitoly → od ktorého slova pokračovať
const textyKapitol = {};     // id kapitoly → text (načítané až pri otvorení)
let aktualnaKniha = null;    // kniha, ktorú žiak práve píše alebo prezerá
let aktualnaKapitola = null; // { id, nazov, slov, index } práve písaná kapitola, inak null

const podlaId = (id) => document.getElementById(id);

// Po načítaní zo servera (volá pribehy.js). postup = null → ponechať doterajší.
// Knihy bez kapitol (učiteľ ich ešte pripravuje) žiakom neukazujeme.
function nastavKnihy(knihy, postup) {
  knihyZiaka = knihy.filter((k) => k.kapitoly.length > 0);
  if (postup) postupKapitol = postup;
  // Učiteľ mohol medzitým knihu upraviť: nájdeme ju znova podľa id
  if (aktualnaKniha) aktualnaKniha = knihyZiaka.find((k) => k.id === aktualnaKniha.id) || aktualnaKniha;
}

// ----- Postup -----
function pocetSlovKapitoly(kap) {
  // Ak už máme text, rátame z neho (presne ako pri písaní), inak počet zo servera
  return kap.id in textyKapitol ? slovaTextu(textyKapitol[kap.id]).length : kap.slov;
}

function napisaneSlova(kap) {
  return Math.min(postupKapitol[kap.id] || 0, pocetSlovKapitoly(kap));
}

const jeDopisana = (kap) => napisaneSlova(kap) >= pocetSlovKapitoly(kap);
const percenta = (cast, celok) => (celok === 0 ? 0 : Math.round((cast / celok) * 100));

function percentaKapitoly(kap) {
  return percenta(napisaneSlova(kap), pocetSlovKapitoly(kap));
}

function percentaKnihy(kniha) {
  const napisane = kniha.kapitoly.reduce((s, k) => s + napisaneSlova(k), 0);
  const spolu = kniha.kapitoly.reduce((s, k) => s + pocetSlovKapitoly(k), 0);
  return percenta(napisane, spolu);
}

// Kapitola je odomknutá, ak je prvá, ak je predchádzajúca dopísaná, alebo ak ju už žiak začal
function jeOdomknuta(kniha, index) {
  if (!ZAMYKAT_KAPITOLY || index === 0) return true;
  const kap = kniha.kapitoly[index];
  return jeDopisana(kniha.kapitoly[index - 1]) || (postupKapitol[kap.id] || 0) > 0;
}

function nazovKapitoly(kap, index) {
  return `${index + 1}. ${kap.nazov || "Kapitola " + (index + 1)}`;
}

// Farba obálky podľa id knihy (rovnaká kniha má vždy rovnakú farbu)
function farbaObalky(kniha) {
  let sucet = 0;
  for (const znak of kniha.id) sucet = (sucet * 31 + znak.charCodeAt(0)) % 1000;
  return FARBY_OBALOK[sucet % FARBY_OBALOK.length];
}

function vytvorObalku(kniha, prvok) {
  prvok.innerHTML = "";
  prvok.style.background = farbaObalky(kniha);
  const titul = document.createElement("div");
  titul.className = "titul";
  titul.textContent = kniha.nazov;
  prvok.appendChild(titul);
  if (kniha.autor) {
    const autor = document.createElement("div");
    autor.className = "autor";
    autor.textContent = kniha.autor;
    prvok.appendChild(autor);
  }
}

function vytvorPruh(percent) {
  const pruh = document.createElement("div");
  pruh.className = "pruh";
  const vypln = document.createElement("div");
  vypln.style.width = percent + "%";
  pruh.appendChild(vypln);
  return pruh;
}


// ===== Obrazovky a menu =====
function ukazObrazovku(nazov) {
  for (const o of ["pisanie", "kniznica", "kniha", "vysledky"]) {
    podlaId("obrazovka-" + o).classList.toggle("skryty", o !== nazov);
  }
  // Ktorá položka menu svieti: písanie kapitoly a kniha patria k Príbehom
  const menu = nazov === "vysledky" ? "vysledky"
    : nazov === "pisanie" && !aktualnaKapitola ? "nahodne" : "pribehy";
  for (const b of document.querySelectorAll(".menu-polozky button")) {
    b.classList.toggle("aktivny", b.dataset.menu === menu);
  }

  const vstup = podlaId("vstup");
  if (nazov === "pisanie") vstup.focus();
  else vstup.blur(); // aby písanie mimo obrazovky písania nič nerobilo

  if (nazov === "vysledky") vykresliVysledky(); // vysledky.js (graf až keď je viditeľný)
  window.scrollTo(0, 0);
}

for (const b of document.querySelectorAll(".menu-polozky button")) {
  b.addEventListener("click", () => {
    if (b.dataset.menu === "nahodne") {
      aktualnaKapitola = null;
      ukazObrazovku("pisanie");
      dalsiText(); // pribehy.js
    } else if (b.dataset.menu === "pribehy") {
      ukazKniznicu();
    } else {
      ukazObrazovku("vysledky");
    }
  });
}

// Nadpis nad textom pri písaní (volá aj pribehy.js)
function nastavHlavickuPisania(nadpis, podnadpis, sipkaSpat) {
  podlaId("nadpisPisania").textContent = nadpis;
  podlaId("podnadpisPisania").textContent = podnadpis;
  podlaId("spatNaKapitoly").classList.toggle("skryty", !sipkaSpat);
}


// ===== Knižnica =====
function ukazKniznicu() {
  const polica = podlaId("policaKnih");
  polica.innerHTML = "";
  podlaId("ziadneKnihy").classList.toggle("skryty", knihyZiaka.length > 0);

  for (const kniha of knihyZiaka) {
    const karta = document.createElement("button");
    karta.className = "karta-knihy";

    const obalka = document.createElement("div");
    obalka.className = "obalka";
    vytvorObalku(kniha, obalka);

    const info = document.createElement("div");
    info.className = "info";
    const p = percentaKnihy(kniha);
    const pocet = kniha.kapitoly.length;
    info.textContent = p === 100 && pocet > 0 ? "✓ Dopísané"
      : `${pocet} ${pocet === 1 ? "kapitola" : pocet >= 2 && pocet <= 4 ? "kapitoly" : "kapitol"} · ${p} %`;
    info.appendChild(vytvorPruh(p));

    karta.append(obalka, info);
    karta.addEventListener("click", () => ukazKnihu(kniha));
    polica.appendChild(karta);
  }
  ukazObrazovku("kniznica");
}

podlaId("spatNaKnihy").addEventListener("click", ukazKniznicu);


// ===== Jedna kniha: kapitoly =====
function ukazKnihu(kniha) {
  aktualnaKniha = kniha;
  aktualnaKapitola = null;
  podlaId("chybaKapitoly").textContent = "";

  vytvorObalku(kniha, podlaId("obalkaKnihy"));
  podlaId("nazovKnihy").textContent = kniha.nazov;
  podlaId("autorKnihy").textContent = [kniha.autor, kniha.zdroj].filter((x) => x).join(" · ");
  const p = percentaKnihy(kniha);
  podlaId("pruhKnihy").style.width = p + "%";
  podlaId("postupKnihy").textContent = p === 100 ? "🏆 Celá kniha je dopísaná!" : `Dopísané ${p} % knihy`;

  const zoznam = podlaId("zoznamKapitol");
  zoznam.innerHTML = "";
  if (kniha.kapitoly.length === 0) {
    podlaId("chybaKapitoly").textContent = "Táto kniha zatiaľ nemá kapitoly.";
  }

  kniha.kapitoly.forEach((kap, i) => {
    const li = document.createElement("li");
    const odomknuta = jeOdomknuta(kniha, i);
    if (!odomknuta) li.classList.add("zamknuta");

    const info = document.createElement("div");
    info.className = "kapitola-info";
    const nazov = document.createElement("div");
    nazov.className = "kapitola-nazov";
    nazov.textContent = nazovKapitoly(kap, i);
    const stav = document.createElement("div");
    stav.className = "kapitola-stav";
    const pk = percentaKapitoly(kap);
    stav.textContent = !odomknuta ? "🔒 Najprv dopíš predchádzajúcu kapitolu"
      : pk === 100 ? "✓ Dopísaná" : pk > 0 ? `Rozpísaná · ${pk} %` : `Nezačatá · ${pocetSlovKapitoly(kap)} slov`;
    info.append(nazov, stav, vytvorPruh(pk));
    li.appendChild(info);

    if (odomknuta) {
      const tlacidlo = document.createElement("button");
      tlacidlo.textContent = pk === 100 ? "Písať znova" : pk > 0 ? "Pokračovať" : "Začať";
      if (pk === 100) tlacidlo.className = "druhotne";
      tlacidlo.addEventListener("click", () => otvorKapitolu(kniha, i));
      li.appendChild(tlacidlo);
    }
    zoznam.appendChild(li);
  });

  ukazObrazovku("kniha");
}

podlaId("spatNaKapitoly").addEventListener("click", () => ukazKnihu(aktualnaKniha));


// ===== Písanie kapitoly =====
async function otvorKapitolu(kniha, index) {
  const kap = kniha.kapitoly[index];

  // Text kapitoly načítame zo servera len raz, potom je v pamäti
  if (!(kap.id in textyKapitol)) {
    const { data, error } = await db.rpc("kapitola_pre_ziaka", { p_kod: kodZiaka, p_kapitola_id: kap.id });
    if (error || data === null) {
      ukazKnihu(kniha);
      podlaId("chybaKapitoly").textContent = "Kapitolu sa nepodarilo načítať. Skontroluj internet a skús znova.";
      return;
    }
    textyKapitol[kap.id] = data;
  }

  if (jeDopisana(kap)) postupKapitol[kap.id] = 0; // dopísaná kapitola sa píše znova od začiatku

  aktualnaKniha = kniha;
  aktualnaKapitola = { ...kap, index };
  ukazObrazovku("pisanie");
  dalsiText(); // pribehy.js → dalsiUryvokKapitoly()
}

function dalsiUryvokKapitoly() {
  const kap = aktualnaKapitola;
  const slova = slovaTextu(textyKapitol[kap.id]); // pribehy.js
  const od = postupKapitol[kap.id] || 0;

  // Kapitola je dopísaná: ďalšia kapitola, alebo späť na knihu
  if (od >= slova.length) {
    const dalsia = aktualnaKniha.kapitoly[kap.index + 1];
    if (dalsia) return otvorKapitolu(aktualnaKniha, kap.index + 1);
    return ukazKnihu(aktualnaKniha);
  }

  const koniec = koniecUryvku(slova, od, slovNaUryvok); // pribehy.js
  aktualnyUryvok = { textId: kap.id, od, koniec, pocet: slova.length };
  aktualnyText = slova.slice(od, koniec).join(" "); // script.js

  aktualizujHlavickuKapitoly();
  podlaId("zdrojTextu").textContent = popisZdroja(aktualnaKniha); // pribehy.js
  zacniCvicenie(); // script.js
}

function aktualizujHlavickuKapitoly() {
  const kap = aktualnaKapitola;
  nastavHlavickuPisania(
    aktualnaKniha.nazov,
    `${nazovKapitoly(kap, kap.index)} · dopísané ${percentaKapitoly(kap)} %`,
    true
  );
}

async function ulozPostupKapitoly(idKapitoly, pozicia) {
  // Keď sa nepodarí (napr. bez internetu), postup sa uloží pri ďalšom úryvku
  await db.rpc("uloz_postup_kapitoly", { p_kod: kodZiaka, p_kapitola_id: idKapitoly, p_pozicia: pozicia });
}

// ----- Po dopísaní úryvku (volá script.js) -----
function poDopisaniUryvku() {
  const sprava = podlaId("spravaKapitoly");
  const dalsi = podlaId("dalsi");
  sprava.textContent = "";
  dalsi.textContent = "Ďalší text (Enter)";

  if (aktualnaKapitola && aktualnyUryvok) {
    const u = aktualnyUryvok;
    if (u.koniec > (postupKapitol[u.textId] || 0)) { // pri „Zopakovať“ sa postup nemení
      postupKapitol[u.textId] = u.koniec;
      ulozPostupKapitoly(u.textId, u.koniec);
    }

    if (u.koniec >= u.pocet) {
      const dalsia = aktualnaKniha.kapitoly[aktualnaKapitola.index + 1];
      if (dalsia) {
        sprava.textContent = `🎉 Kapitola je dopísaná! Ďalej: ${nazovKapitoly(dalsia, aktualnaKapitola.index + 1)}`;
        dalsi.textContent = "Ďalšia kapitola (Enter)";
      } else {
        sprava.textContent = `🏆 Celá kniha „${aktualnaKniha.nazov}“ je dopísaná!`;
        dalsi.textContent = "Späť na knihu (Enter)";
      }
    } else {
      dalsi.textContent = "Pokračovať (Enter)";
    }
    aktualizujHlavickuKapitoly();
  }
  nacitajUdajeZiaka(false); // pribehy.js: nové texty a knihy od učiteľa
}
