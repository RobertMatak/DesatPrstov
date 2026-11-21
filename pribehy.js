// ===== Úryvky, náhodné texty a príbehy na pokračovanie =====
// Žiak si vyberie režim:
//   - Náhodné texty: náhodný úryvok z textov od učiteľa aj zo vstavaných (texty.js)
//   - Príbeh: vybraný text od učiteľa píše postupne, úryvok za úryvkom
// Dĺžka úryvku (počet slov) závisí od ročníka triedy a nastavuje ju učiteľ.
// Úryvok končí, ak sa dá, na konci vety, inak aspoň za čiarkou.

const KLUC_REZIM = "desatPrstov.rezim";
const KLUC_PRIBEH = "desatPrstov.pribeh";

let textyOdUcitela = [];  // [{ id, nazov, text }] pre triedu žiaka (zo servera)
let slovNaUryvok = 20;    // dĺžka úryvku pre ročník žiaka (zo servera)
let postupPribehov = {};  // id príbehu → od ktorého slova pokračovať
let rezim = "nahodne";    // "nahodne" alebo "pribeh"
let idPribehu = null;     // vybraný príbeh
let aktualnyUryvok = null; // pri príbehu: { textId, od, koniec, pocet }

// ----- Delenie textu na úryvky -----
const KONIEC_VETY = /[.!?]["')]*$/;   // slovo končí bodkou, otáznikom alebo výkričníkom
const KONIEC_CASTI = /[,;:]["')]*$/;  // slovo končí čiarkou, bodkočiarkou alebo dvojbodkou

function slovaTextu(text) {
  return text.split(" ").filter((s) => s.length > 0);
}

// Nájde, kde má skončiť úryvok, ktorý začína slovom "od" a má mať asi "ciel" slov.
// Hľadá koniec vety čo najbližšie k cieľu (v rozmedzí 70 % až 150 % cieľa),
// potom čiarku, a ak nič z toho nenájde, skončí presne po "ciel" slovách.
function koniecUryvku(slova, od, ciel) {
  const zostava = slova.length - od;
  if (zostava <= Math.round(ciel * 1.5)) return slova.length; // zvyšok sa napíše naraz

  const min = od + Math.max(1, Math.round(ciel * 0.7));
  const max = od + Math.round(ciel * 1.5);
  const idealny = od + ciel;

  function najblizsi(vzor) {
    let najlepsi = -1;
    for (let k = min; k <= max; k++) {
      if (vzor.test(slova[k - 1]) &&
          (najlepsi < 0 || Math.abs(k - idealny) < Math.abs(najlepsi - idealny))) {
        najlepsi = k;
      }
    }
    return najlepsi;
  }

  let koniec = najblizsi(KONIEC_VETY);
  if (koniec < 0) koniec = najblizsi(KONIEC_CASTI);
  if (koniec < 0) koniec = idealny;

  // Ak by po úryvku ostal len kúsok, pridáme ho rovno k tomuto úryvku
  if (slova.length - koniec < ciel * 0.4) return slova.length;
  return koniec;
}

// Indexy slov, ktorými začína veta (prvé slovo a slová po bodke, ? alebo !)
function zaciatkyViet(slova) {
  const zaciatky = [0];
  for (let i = 1; i < slova.length; i++) {
    if (KONIEC_VETY.test(slova[i - 1])) zaciatky.push(i);
  }
  return zaciatky;
}

// ----- Údaje zo servera -----
// ajPostup = true len pri prihlásení; neskôr obnovujeme iba texty a dĺžku,
// aby sme neprepísali postup, ktorý sa práve ukladá.
async function nacitajUdajeZiaka(ajPostup) {
  const { data, error } = await db.rpc("udaje_pre_ziaka", { p_kod: kodZiaka }); // kodZiaka je v ziak.js
  if (!error && data) {
    textyOdUcitela = data.texty;
    slovNaUryvok = data.slov;
    if (ajPostup) postupPribehov = data.postup;
  } else if (error) {
    // Databáza ešte bez úpravy z fázy 6: aspoň texty po starom, bez príbehov
    const stare = await db.rpc("texty_pre_ziaka", { p_kod: kodZiaka });
    if (!stare.error && Array.isArray(stare.data)) {
      textyOdUcitela = stare.data.map((text) => ({ id: null, nazov: null, text }));
    }
  }
  vykresliVolbyRezimu();
}

async function ulozPostup(textId, pozicia) {
  // Keď sa nepodarí (napr. bez internetu), postup sa uloží pri ďalšom úryvku
  await db.rpc("uloz_postup", { p_kod: kodZiaka, p_text_id: textId, p_pozicia: pozicia });
}

// ----- Príbehy a ich popis -----
function pribehy() {
  return textyOdUcitela.filter((t) => t.id); // len texty z databázy s id
}

function nazovPribehu(t) {
  return t.nazov || slovaTextu(t.text).slice(0, 4).join(" ") + "…";
}

function percentaPribehu(t) {
  const pocet = slovaTextu(t.text).length;
  return Math.min(100, Math.round(((postupPribehov[t.id] || 0) / pocet) * 100));
}

// ----- Výber režimu a príbehu -----
function nacitajVolbyRezimu() {
  try {
    rezim = localStorage.getItem(KLUC_REZIM) || "nahodne";
    idPribehu = localStorage.getItem(KLUC_PRIBEH);
  } catch (chyba) {}
}

function ulozVolbyRezimu() {
  try {
    localStorage.setItem(KLUC_REZIM, rezim);
    if (idPribehu) localStorage.setItem(KLUC_PRIBEH, idPribehu);
  } catch (chyba) {}
}

function vykresliVolbyRezimu() {
  for (const b of document.querySelectorAll("#prepinacRezimu button")) {
    b.classList.toggle("aktivny", b.dataset.rezim === rezim);
  }

  const zoznam = pribehy();
  if (!zoznam.some((p) => p.id === idPribehu)) idPribehu = zoznam.length > 0 ? zoznam[0].id : null;

  const vyber = document.getElementById("vyberPribehu");
  const info = document.getElementById("infoPribehu");
  vyber.classList.toggle("skryty", rezim !== "pribeh" || zoznam.length === 0);
  vyber.innerHTML = "";
  for (const p of zoznam) {
    const moznost = document.createElement("option");
    moznost.value = p.id;
    moznost.textContent = `${nazovPribehu(p)} (${percentaPribehu(p)} %)`;
    vyber.appendChild(moznost);
  }
  if (idPribehu) vyber.value = idPribehu;

  if (rezim === "pribeh" && zoznam.length === 0) {
    info.textContent = "Zatiaľ tu nie sú žiadne príbehy, píšeš náhodné texty.";
  } else {
    info.textContent = `Úryvky po približne ${slovNaUryvok} slovách`;
  }
}

for (const b of document.querySelectorAll("#prepinacRezimu button")) {
  b.addEventListener("click", () => {
    rezim = b.dataset.rezim;
    ulozVolbyRezimu();
    vykresliVolbyRezimu();
    dalsiText();
  });
}

document.getElementById("vyberPribehu").addEventListener("change", (udalost) => {
  idPribehu = udalost.target.value;
  ulozVolbyRezimu();
  dalsiText();
});

// ----- Výber ďalšieho textu (tlačidlo „Ďalší text“, Enter, zmena režimu) -----
function dalsiText() {
  const pribeh = rezim === "pribeh" ? pribehy().find((p) => p.id === idPribehu) : null;

  if (pribeh) {
    // Príbeh: pokračujeme tam, kde žiak skončil
    const slova = slovaTextu(pribeh.text);
    let od = postupPribehov[pribeh.id] || 0;
    if (od >= slova.length) {
      od = 0; // dopísaný príbeh sa začne odznova
      postupPribehov[pribeh.id] = 0;
    }
    const koniec = koniecUryvku(slova, od, slovNaUryvok);
    aktualnyUryvok = { textId: pribeh.id, od, koniec, pocet: slova.length };
    aktualnyText = slova.slice(od, koniec).join(" "); // script.js
  } else {
    // Náhodné texty: náhodný začiatok vety v náhodnom texte
    // (dlhší text má viac viet, a tak aj väčšiu šancu)
    const texty = textyOdUcitela.map((t) => t.text).concat(TEXTY);
    const moznosti = [];
    texty.forEach((text, i) => {
      const slova = slovaTextu(text);
      for (const z of zaciatkyViet(slova)) {
        if (z === 0 || slova.length - z >= slovNaUryvok * 0.7) moznosti.push([i, z]);
      }
    });

    let novy = aktualnyText;
    for (let pokus = 0; pokus < 10 && novy === aktualnyText; pokus++) {
      const [i, od] = moznosti[Math.floor(Math.random() * moznosti.length)];
      const slova = slovaTextu(texty[i]);
      novy = slova.slice(od, koniecUryvku(slova, od, slovNaUryvok)).join(" ");
    }
    aktualnyUryvok = null;
    aktualnyText = novy;
  }
  zacniCvicenie(); // script.js
}

// ----- Po dopísaní úryvku (volá script.js) -----
function poDopisaniUryvku() {
  const sprava = document.getElementById("spravaPribehu");
  sprava.textContent = "";

  if (aktualnyUryvok) {
    const u = aktualnyUryvok;
    const pribeh = pribehy().find((p) => p.id === u.textId);
    if (u.koniec > (postupPribehov[u.textId] || 0)) { // pri „Zopakovať“ sa postup nemení
      postupPribehov[u.textId] = u.koniec;
      ulozPostup(u.textId, u.koniec);
    }
    if (pribeh) {
      sprava.textContent = u.koniec >= u.pocet
        ? `🎉 Príbeh „${nazovPribehu(pribeh)}“ je celý dopísaný! Ďalší text ho začne odznova, alebo si vyber iný.`
        : `Príbeh „${nazovPribehu(pribeh)}“: dopísané ${percentaPribehu(pribeh)} %.`;
    }
  }
  vykresliVolbyRezimu();
  nacitajUdajeZiaka(false); // ak učiteľ medzitým pridal text alebo zmenil dĺžku
}
