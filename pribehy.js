// ===== Úryvky a náhodné texty =====
// Dĺžka úryvku (počet slov) závisí od ročníka triedy a nastavuje ju učiteľ.
// Úryvok končí, ak sa dá, na konci vety, inak aspoň za čiarkou.
// Náhodné texty = texty od učiteľa (záložka Náhodné texty) + vstavané (texty.js).
// Knihy sa sem nedostanú, tie sú len v časti Príbehy (kniznica.js).

let textyOdUcitela = [];  // [{ id, nazov, text, autor, zdroj }] pre triedu žiaka (zo servera)
let slovNaUryvok = 20;    // dĺžka úryvku pre ročník žiaka (zo servera)
let potrebnaPresnost = 90; // % presnosti potrebné na postup v knihe (zo servera)
let aktualnyUryvok = null; // pri kapitole: { textId, od, koniec, pocet }

// ----- Delenie textu na úryvky -----
const KONIEC_VETY = /[.!?]["')]*$/;   // slovo končí bodkou, otáznikom alebo výkričníkom
const KONIEC_CASTI = /[,;:]["')]*$/;  // slovo končí čiarkou, bodkočiarkou alebo dvojbodkou

function slovaTextu(text) {
  return text.split(/\s+/).filter((s) => s.length > 0);
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

// "Zdroj: Pavol Dobšinský – Soľ nad zlato (Prostonárodné slovenské povesti)"
function popisZdroja(t) {
  if (t.vstavany) return "Zdroj: texty aplikácie Desať Prstov";
  const dielo = [t.autor, t.nazov].filter((x) => x).join(" – ");
  if (dielo && t.zdroj) return `Zdroj: ${dielo} (${t.zdroj})`;
  if (dielo || t.zdroj) return "Zdroj: " + (dielo || t.zdroj);
  return ""; // učiteľ zdroj neuviedol
}

// ----- Údaje zo servera -----
// ajPostup = true len pri prihlásení; neskôr obnovujeme iba texty, knihy a dĺžku,
// aby sme neprepísali postup, ktorý sa práve ukladá.
async function nacitajUdajeZiaka(ajPostup) {
  const { data, error } = await db.rpc("udaje_pre_ziaka", { p_kod: kodZiaka }); // kodZiaka je v ziak.js
  if (!error && data) {
    textyOdUcitela = data.texty;
    slovNaUryvok = data.slov;
    if (data.presnost) potrebnaPresnost = data.presnost;
    nastavKnihy(data.knihy || [], ajPostup ? data.postup : null); // kniznica.js
  } else if (error) {
    // Databáza ešte bez novších úprav: aspoň náhodné texty po starom
    const stare = await db.rpc("texty_pre_ziaka", { p_kod: kodZiaka });
    if (!stare.error && Array.isArray(stare.data)) {
      textyOdUcitela = stare.data.map((text) => ({ id: null, nazov: null, text }));
    }
  }
}

// ----- Ďalší text (tlačidlo „Ďalší text“, Enter) -----
function dalsiText() {
  document.getElementById("spravaKapitoly").textContent = "";
  document.getElementById("dalsi").textContent = "Ďalší text (Enter)";
  document.getElementById("obrazovka-pisanie").classList.toggle("rezim-kniha", aktualnaKapitola !== null);
  // Pri knihách ukážeme vedľa presnosti aj to, koľko treba
  document.getElementById("cielPresnosti").textContent = aktualnaKapitola ? ` (potrebné ${potrebnaPresnost} %)` : "";

  if (aktualnaKapitola) return dalsiUryvokKapitoly(); // kniznica.js

  // Náhodné texty: náhodný začiatok vety v náhodnom texte
  // (dlhší text má viac viet, a tak aj väčšiu šancu)
  const texty = textyOdUcitela.concat(TEXTY.map((text) => ({ text, vstavany: true })));
  const moznosti = [];
  texty.forEach((t, i) => {
    const slova = slovaTextu(t.text);
    for (const z of zaciatkyViet(slova)) {
      if (z === 0 || slova.length - z >= slovNaUryvok * 0.7) moznosti.push([i, z]);
    }
  });

  let novy = aktualnyText;
  let zdrojovyText = null;
  for (let pokus = 0; pokus < 10 && novy === aktualnyText; pokus++) {
    const [i, od] = moznosti[Math.floor(Math.random() * moznosti.length)];
    zdrojovyText = texty[i];
    const slova = slovaTextu(zdrojovyText.text);
    novy = slova.slice(od, koniecUryvku(slova, od, slovNaUryvok)).join(" ");
  }
  aktualnyUryvok = null;
  aktualnyText = novy; // script.js

  nastavHlavickuPisania(
    "Náhodné texty",
    `Úryvky po približne ${slovNaUryvok} slovách. Klikni na text a začni písať, chybu opravíš klávesom Backspace.`,
    false
  ); // kniznica.js
  document.getElementById("zdrojTextu").textContent = zdrojovyText ? popisZdroja(zdrojovyText) : "";
  zacniCvicenie(); // script.js
}
