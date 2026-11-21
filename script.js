// ===== Prvky zo stránky (podľa id v index.html) =====
const textEl = document.getElementById("text");
const vstup = document.getElementById("vstup");
const napovedaEl = document.getElementById("napoveda");
const klavesnicaEl = document.getElementById("klavesnica");
const vysledokEl = document.getElementById("vysledok");

// ===== Stav cvičenia =====
let ZNAKY = [];        // znaky aktuálneho textu
let aktualnyText = ""; // text (úryvok), ktorý práve píšeme; vyberá ho pribehy.js
let pozicia = 0;       // index znaku, ktorý treba práve napísať
let pocetUhozov = 0;   // koľko znakov používateľ napísal (aj chybných)
let pocetChyb = 0;     // koľko z nich bolo chybných
let zaciatok = null;   // čas prvého úhozu (null = ešte nezačal)
let koniecCas = null;  // čas dopísania
let hotovo = false;
let mrtvyKlavesStlaceny = false; // stlačil už ´ alebo ˇ a čaká sa na písmeno?


// Začne písať aktuálny text od začiatku
function zacniCvicenie() {
  ZNAKY = Array.from(aktualnyText);
  pozicia = 0;
  pocetUhozov = 0;
  pocetChyb = 0;
  zaciatok = null;
  koniecCas = null;
  hotovo = false;
  mrtvyKlavesStlaceny = false;
  zacniStatistikuKlavesov(); // chyby.js

  vysledokEl.classList.add("skryty");
  vykresliText();
  aktualizujStaty();
  ukazDalsiKlaves();
  vstup.focus();
}

// Vytvorí pre každý znak textu jeden <span>, aby sme ho vedeli zafarbiť
function vykresliText() {
  textEl.innerHTML = "";
  for (const znak of ZNAKY) {
    const span = document.createElement("span");
    span.textContent = znak;
    span.classList.add("znak");
    textEl.appendChild(span);
  }
  textEl.children[0].classList.add("aktualny");
}

// Zvýrazní na klávesnici, čo treba stlačiť ďalej, a vypíše nápovedu
function ukazDalsiKlaves() {
  if (hotovo) {
    zrusZvyraznenie();
    napovedaEl.textContent = "";
    return;
  }
  const kroky = krokyPreZnak(ZNAKY[pozicia]);
  // Pri znakoch ako ó či ď: po stlačení ´ alebo ˇ ukážeme už písmeno
  const krok = mrtvyKlavesStlaceny && kroky.length > 1 ? 1 : 0;
  zvyrazniKrok(kroky[krok]);
  napovedaEl.textContent = popisKrokov(kroky);
}

// Spracuje jeden napísaný znak
function spracujZnak(znak) {
  if (hotovo) return;
  if (zaciatok === null) zaciatok = Date.now();

  const span = textEl.children[pozicia];
  span.classList.remove("aktualny");
  pocetUhozov++;
  zapisUhoz(ZNAKY[pozicia], znak === ZNAKY[pozicia]); // chyby.js

  if (znak === ZNAKY[pozicia]) {
    span.classList.add("spravne");
  } else {
    span.classList.add("chybne");
    pocetChyb++;
  }

  pozicia++;
  if (pozicia === ZNAKY.length) {
    koniec();
  } else {
    textEl.children[pozicia].classList.add("aktualny");
  }
}

// Backspace: vráti sa o jeden znak späť
function vratSpat() {
  if (hotovo || pozicia === 0) return;
  textEl.children[pozicia].classList.remove("aktualny");
  pozicia--;
  const span = textEl.children[pozicia];
  span.classList.remove("spravne", "chybne");
  span.classList.add("aktualny");
  ukazDalsiKlaves();
}

// Text je dopísaný
function koniec() {
  hotovo = true;
  koniecCas = Date.now();
  aktualizujStaty();

  const staty = vypocitajStaty();
  document.getElementById("vysledokRychlost").textContent = staty.rychlost;
  document.getElementById("vysledokPresnost").textContent = staty.presnost;
  document.getElementById("vysledokChyby").textContent = pocetChyb;
  document.getElementById("vysledokCas").textContent = formatujCas(staty.sekundy);

  // Uloženie výsledku (len ak je rýchlosť číslo, nie "–")
  const rekordEl = document.getElementById("novyRekord");
  rekordEl.classList.add("skryty");
  document.getElementById("stavUlozenia").textContent = "";
  if (typeof staty.rychlost === "number") {
    const predtym = zhrnutie(nacitajVysledky());
    if (predtym !== null && staty.rychlost > predtym.rekord) {
      rekordEl.classList.remove("skryty");
    }
    const klavesy = ulozStatistikuKlavesov(); // chyby.js: štatistika z tohto textu
    ulozVysledok({                              // vysledky.js: do pamäte a na server
      datum: new Date().toISOString(),
      text: aktualnyText.split(" ").slice(0, 3).join(" ") + "…",
      rychlost: staty.rychlost,                 // slov za minútu
      presnost: staty.presnost,
      chyby: pocetChyb,
      sekundy: Math.round(staty.sekundy),
    }, klavesy);
    vykresliVysledky();
  }
  poDopisaniUryvku(); // kniznica.js: postup v kapitole a obnovenie textov od učiteľa

  vysledokEl.classList.remove("skryty");
}

// ===== Štatistiky =====
function vypocitajStaty() {
  const teraz = hotovo ? koniecCas : Date.now();
  const sekundy = zaciatok === null ? 0 : (teraz - zaciatok) / 1000;
  const spravne = textEl.querySelectorAll(".spravne").length;
  // Slová za minútu: podľa medzinárodného zvyku sa 1 slovo počíta ako 5 znakov
  // (vrátane medzier), aby sa dali porovnať texty s krátkymi aj dlhými slovami.
  // Prvé 2 sekundy je rýchlosť nespoľahlivá, preto ju ešte neukazujeme.
  const rychlost = sekundy < 2 ? "–" : Math.round(spravne / 5 / (sekundy / 60));
  const presnost = pocetUhozov === 0
    ? 100
    : Math.round(((pocetUhozov - pocetChyb) / pocetUhozov) * 100);
  return { sekundy, rychlost, presnost };
}

// 75 sekúnd → "1:15"
function formatujCas(sekundy) {
  const s = Math.floor(sekundy);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function aktualizujStaty() {
  const staty = vypocitajStaty();
  document.getElementById("zivaRychlost").textContent = staty.rychlost;
  document.getElementById("zivaPresnost").textContent = staty.presnost;
  document.getElementById("zivaChyby").textContent = pocetChyb;
  document.getElementById("zivyCas").textContent = formatujCas(staty.sekundy);
}

// Štatistiky sa obnovujú aj vtedy, keď nepíšeš (čas beží ďalej)
setInterval(() => {
  if (zaciatok !== null && !hotovo) aktualizujStaty();
}, 500);

// ===== Písanie z klávesnice =====
// Písmená čítame zo skrytého políčka, nie priamo z klávesov. Vďaka tomu
// fungujú aj mŕtve klávesy (´ a ˇ): políčko nám dá až hotové "ó" alebo "ď".
function spracujVstup() {
  const napisane = vstup.value.normalize("NFC");
  vstup.value = "";
  for (const znak of napisane) {
    spracujZnak(znak);
  }
  mrtvyKlavesStlaceny = false;
  aktualizujStaty();
  ukazDalsiKlaves();
}

vstup.addEventListener("input", (udalost) => {
  if (udalost.isComposing) return; // mŕtvy kláves ešte čaká na písmeno
  spracujVstup();
});
vstup.addEventListener("compositionend", spracujVstup);

vstup.addEventListener("keydown", (udalost) => {
  stlacKlaves(udalost.code);

  if (udalost.key === "Dead") {
    mrtvyKlavesStlaceny = true;
    ukazDalsiKlaves();
  } else if (udalost.key === "Backspace") {
    udalost.preventDefault();
    vratSpat();
    aktualizujStaty();
  } else if (udalost.key === "Enter" && hotovo) {
    dalsiText();
  }
});
vstup.addEventListener("keyup", (udalost) => pustiKlaves(udalost.code));

// ===== Focus: kliknutie kamkoľvek vráti písanie do políčka =====
// (okrem kliknutia do políčok a na tlačidlá, napr. pri prihlasovaní)
document.addEventListener("click", (udalost) => {
  if (udalost.target.closest("input, textarea, button, label, select")) return;
  if (document.getElementById("aplikacia").classList.contains("skryty")) return;
  if (document.getElementById("obrazovka-pisanie").classList.contains("skryty")) return; // knižnica, výsledky
  vstup.focus();
});
vstup.addEventListener("blur", () => {
  document.body.classList.add("neaktivny");
  pustiVsetkyKlavesy();
});
vstup.addEventListener("focus", () => document.body.classList.remove("neaktivny"));

// ===== Tlačidlá =====
document.getElementById("dalsi").addEventListener("click", () => dalsiText()); // dalsiText je v pribehy.js
document.getElementById("zopakovat").addEventListener("click", zacniCvicenie);

// ===== Štart =====
// Aplikácia sa spustí až po prihlásení žiaka (volá ju ziak.js)
function spustiAplikaciu() {
  vykresliKlavesnicu(klavesnicaEl);
  ukazObrazovku("pisanie"); // kniznica.js: začíname náhodnými textami
  dalsiText();              // pribehy.js
}
