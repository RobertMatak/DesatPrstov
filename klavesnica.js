// ===== Slovenská klávesnica (QWERTZ) =====
// Každý kláves je zoznam: [kód klávesu, znak, znak so Shiftom, prst, šírka, popis]
// - kód klávesu je fyzické miesto na klávesnici (to, čo vráti event.code)
// - prst: l/p = ľavá/pravá ruka, m = malíček, p = prstenník, s = prostredník,
//   u = ukazovák, "pa" = palec
// - šírka je voliteľná (1 = bežný kláves), popis je text pre špeciálne klávesy
// Kód null znamená prázdne miesto (len kvôli rozloženiu).

const NAZVY_PRSTOV = {
  lm: "ľavý malíček", lp: "ľavý prstenník", ls: "ľavý prostredník", lu: "ľavý ukazovák",
  pu: "pravý ukazovák", ps: "pravý prostredník", pp: "pravý prstenník", pm: "pravý malíček",
  pa: "palec",
};

const RADY = [
  [
    ["Backquote", ";", "°", "lm"],
    ["Digit1", "+", "1", "lm"],
    ["Digit2", "ľ", "2", "lp"],
    ["Digit3", "š", "3", "ls"],
    ["Digit4", "č", "4", "lu"],
    ["Digit5", "ť", "5", "lu"],
    ["Digit6", "ž", "6", "pu"],
    ["Digit7", "ý", "7", "pu"],
    ["Digit8", "á", "8", "ps"],
    ["Digit9", "í", "9", "pp"],
    ["Digit0", "é", "0", "pm"],
    ["Minus", "=", "%", "pm"],
    ["Equal", "´", "ˇ", "pm"],
    ["Backspace", "", "", "pm", 2, "⌫"],
  ],
  [
    ["Tab", "", "", "lm", 1.5, "Tab"],
    ["KeyQ", "q", "Q", "lm"],
    ["KeyW", "w", "W", "lp"],
    ["KeyE", "e", "E", "ls"],
    ["KeyR", "r", "R", "lu"],
    ["KeyT", "t", "T", "lu"],
    ["KeyY", "z", "Z", "pu"],
    ["KeyU", "u", "U", "pu"],
    ["KeyI", "i", "I", "ps"],
    ["KeyO", "o", "O", "pp"],
    ["KeyP", "p", "P", "pm"],
    ["BracketLeft", "ú", "/", "pm"],
    ["BracketRight", "ä", "(", "pm"],
    ["Enter", "", "", "pm", 1.5, "Enter"],
  ],
  [
    ["CapsLock", "", "", "lm", 1.75, "Caps"],
    ["KeyA", "a", "A", "lm"],
    ["KeyS", "s", "S", "lp"],
    ["KeyD", "d", "D", "ls"],
    ["KeyF", "f", "F", "lu"],
    ["KeyG", "g", "G", "lu"],
    ["KeyH", "h", "H", "pu"],
    ["KeyJ", "j", "J", "pu"],
    ["KeyK", "k", "K", "ps"],
    ["KeyL", "l", "L", "pp"],
    ["Semicolon", "ô", "\"", "pm"],
    ["Quote", "§", "!", "pm"],
    ["Backslash", "ň", ")", "pm"],
    ["Enter", "", "", "pm", 1.25, ""],
  ],
  [
    ["ShiftLeft", "", "", "lm", 1.25, "Shift"],
    ["IntlBackslash", "&", "*", "lm"],
    ["KeyZ", "y", "Y", "lm"],
    ["KeyX", "x", "X", "lp"],
    ["KeyC", "c", "C", "ls"],
    ["KeyV", "v", "V", "lu"],
    ["KeyB", "b", "B", "lu"],
    ["KeyN", "n", "N", "pu"],
    ["KeyM", "m", "M", "pu"],
    ["Comma", ",", "?", "ps"],
    ["Period", ".", ":", "pp"],
    ["Slash", "-", "_", "pm"],
    ["ShiftRight", "", "", "pm", 2.75, "Shift"],
  ],
  [
    [null, "", "", "", 4.5],
    ["Space", "", "", "pa", 6, ""],
    [null, "", "", "", 4.5],
  ],
];

// ===== Ktorý kláves napíše ktorý znak =====
// Napríklad ZNAK_NA_KLAVES["A"] = { kod: "KeyA", shift: true, prst: "lm" }
// (podobne ako slovník v Pythone)
const ZNAK_NA_KLAVES = {};
const ZNAKY_KLAVESOV = {}; // kód klávesu → znak bez Shiftu (na popis v nápovede)

for (const rad of RADY) {
  for (const [kod, znak, shiftZnak, prst] of rad) {
    if (!kod) continue;
    ZNAKY_KLAVESOV[kod] = znak;
    if (kod === "Equal") continue; // ´ a ˇ sú mŕtve klávesy, riešime ich nižšie
    if (znak) ZNAK_NA_KLAVES[znak] = { kod, shift: false, prst };
    if (shiftZnak) ZNAK_NA_KLAVES[shiftZnak] = { kod, shift: true, prst };
  }
}
ZNAK_NA_KLAVES[" "] = { kod: "Space", shift: false, prst: "pa" };

const DLZEN = { kod: "Equal", shift: false, prst: "pm" };  // ´
const MAKCEN = { kod: "Equal", shift: true, prst: "pm" };  // ˇ

// Vráti zoznam stlačení potrebných pre znak.
// "a" → [a], "ó" → [´, o], "Ď" → [ˇ, Shift + D]
function krokyPreZnak(znak) {
  if (ZNAK_NA_KLAVES[znak]) return [ZNAK_NA_KLAVES[znak]];

  // Rozloží znak na písmeno a diakritiku: "ó" → "o" + dĺžeň
  const rozlozeny = znak.normalize("NFD");
  const zaklad = ZNAK_NA_KLAVES[rozlozeny[0]];
  const znamienko = rozlozeny[1];

  if (zaklad && znamienko === "́") return [DLZEN, zaklad];
  if (zaklad && znamienko === "̌") return [MAKCEN, zaklad];
  return []; // znak, ktorý na klávesnici nevieme ukázať
}

// ===== Vykreslenie klávesnice =====
function vykresliKlavesnicu(kontajner) {
  kontajner.innerHTML = "";
  for (const rad of RADY) {
    const radEl = document.createElement("div");
    radEl.className = "rad";

    for (const [kod, znak, shiftZnak, prst, sirka = 1, popis] of rad) {
      const klaves = document.createElement("div");
      klaves.style.flexGrow = sirka;

      if (!kod) {
        klaves.className = "klaves prazdny";
        radEl.appendChild(klaves);
        continue;
      }

      // Farba podľa prsta: prst-m = malíček, prst-p = prstenník, ...
      klaves.className = "klaves prst-" + prst.slice(1);
      klaves.dataset.kod = kod;
      if (kod === "KeyF" || kod === "KeyJ") klaves.classList.add("domovsky");

      if (popis !== undefined) {
        klaves.textContent = popis;
      } else if (shiftZnak === znak.toUpperCase()) {
        klaves.textContent = shiftZnak; // písmená: len veľké písmeno
      } else {
        const hore = document.createElement("small");
        hore.textContent = shiftZnak;
        klaves.appendChild(hore);
        klaves.appendChild(document.createTextNode(znak));
      }
      radEl.appendChild(klaves);
    }
    kontajner.appendChild(radEl);
  }
}

// ===== Zvýrazňovanie klávesov =====
function klavesyPodlaKodu(kod) {
  return document.querySelectorAll(`.klaves[data-kod="${kod}"]`);
}

function zrusZvyraznenie() {
  document.querySelectorAll(".klaves.ciel").forEach((k) => k.classList.remove("ciel"));
}

// Zvýrazní kláves, ktorý treba stlačiť (a Shift na druhej ruke, ak treba)
function zvyrazniKrok(krok) {
  zrusZvyraznenie();
  if (!krok) return;
  klavesyPodlaKodu(krok.kod).forEach((k) => k.classList.add("ciel"));
  if (krok.shift) {
    const shift = krok.prst.startsWith("l") ? "ShiftRight" : "ShiftLeft";
    klavesyPodlaKodu(shift).forEach((k) => k.classList.add("ciel"));
  }
}

// Krátke „stlačenie“ klávesu na obrazovke, keď ho stlačíš na skutočnej klávesnici
function stlacKlaves(kod) {
  klavesyPodlaKodu(kod).forEach((k) => k.classList.add("stlaceny"));
}
function pustiKlaves(kod) {
  klavesyPodlaKodu(kod).forEach((k) => k.classList.remove("stlaceny"));
}
function pustiVsetkyKlavesy() {
  document.querySelectorAll(".klaves.stlaceny").forEach((k) => k.classList.remove("stlaceny"));
}

// ===== Nápoveda textom =====
function popisKroku(krok) {
  let nazov;
  if (krok.kod === "Space") {
    nazov = "medzerník";
  } else if (krok.kod === "Equal") {
    const mrtvy = krok.shift ? "Shift + ´ = mäkčeň ˇ" : "´ = dĺžeň";
    return mrtvy + " (" + NAZVY_PRSTOV[krok.prst] + ")";
  } else {
    const znak = ZNAKY_KLAVESOV[krok.kod];
    nazov = /^[a-z]$/.test(znak) ? znak.toUpperCase() : znak;
  }
  return (krok.shift ? "Shift + " : "") + nazov + " (" + NAZVY_PRSTOV[krok.prst] + ")";
}

function popisKrokov(kroky) {
  if (kroky.length === 0) return "";
  return "Stlač: " + kroky.map(popisKroku).join(", potom ");
}
