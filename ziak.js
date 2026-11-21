// ===== Prihlásenie žiaka kódom =====
// Kód si prehliadač zapamätá (localStorage), takže žiak ho na svojom
// počítači zadá len raz. Pri každom otvorení stránky sa kód overí
// na serveri: ak ho učiteľ medzitým zmenil alebo žiaka vypol,
// žiak sa musí prihlásiť znova.

const KLUC_KOD = "desatPrstov.kod";
let kodZiaka = null; // kód prihláseného žiaka (používa vysledky.js)

const prihlasenieEl = document.getElementById("prihlasenieZiaka");
const aplikaciaEl = document.getElementById("aplikacia");
const poleKodu = document.getElementById("kodZiaka");
const chybaEl = document.getElementById("prihlasenieChyba");

function ukazPrihlasenie(sprava = "") {
  aplikaciaEl.classList.add("skryty");
  prihlasenieEl.classList.remove("skryty");
  chybaEl.textContent = sprava;
  poleKodu.focus();
}

// Overí kód na serveri, načíta výsledky a spustí aplikáciu.
// Vráti chybovú správu, alebo null, ak všetko prebehlo v poriadku.
async function prihlas(kod) {
  const { data: ziak, error } = await db.rpc("prihlas_ziaka", { p_kod: kod });
  if (error) return "Nepodarilo sa spojiť so serverom. Skontroluj internet a skús znova.";
  if (ziak === null) return "Tento kód nepoznám. Skontroluj ho na kartičke.";

  kodZiaka = kod;
  try {
    localStorage.setItem(KLUC_KOD, kod);
    // Výsledky zo starej verzie (uložené v prehliadači) už nepoužívame
    localStorage.removeItem("desatPrstov.vysledky");
    localStorage.removeItem("desatPrstov.klavesy");
  } catch (chyba) {}

  // Najprv pošleme výsledky, ktoré sa minule nepodarilo uložiť, potom načítame všetky
  await odosliNeodoslane(); // vysledky.js
  const { data: udaje, error: chybaUdajov } = await db.rpc("moje_vysledky", { p_kod: kod });
  if (chybaUdajov || udaje === null) return "Nepodarilo sa načítať tvoje výsledky. Skús to znova.";

  await obnovTextyOdUcitela();
  nastavVysledky(udaje.vysledky);          // vysledky.js
  nastavStatistikuKlavesov(udaje.klavesy); // chyby.js

  document.getElementById("menoZiaka").textContent = ziak.meno;
  document.getElementById("triedaZiaka").textContent = "trieda " + ziak.trieda;
  prihlasenieEl.classList.add("skryty");
  aplikaciaEl.classList.remove("skryty");
  spustiAplikaciu(); // script.js
  return null;
}

// Načíta texty od učiteľa pre triedu žiaka.
// Keď sa to nepodarí (napr. bez internetu), ostanú doterajšie a vstavané texty.
async function obnovTextyOdUcitela() {
  const { data, error } = await db.rpc("texty_pre_ziaka", { p_kod: kodZiaka });
  if (!error && Array.isArray(data)) textyOdUcitela = data; // script.js
}

document.getElementById("prihlasenieForm").addEventListener("submit", async (udalost) => {
  udalost.preventDefault();
  const tlacidlo = udalost.submitter;
  tlacidlo.disabled = true;
  chybaEl.textContent = "";

  const chyba = await prihlas(poleKodu.value.trim().toUpperCase());
  if (chyba) chybaEl.textContent = chyba;
  tlacidlo.disabled = false;
});

document.getElementById("odhlasitZiaka").addEventListener("click", () => {
  try {
    localStorage.removeItem(KLUC_KOD);
  } catch (chyba) {}
  location.reload(); // načíta stránku odznova, bez prihlásenia
});

// ===== Štart: je kód zapamätaný? =====
(async () => {
  let ulozenyKod = null;
  try {
    ulozenyKod = localStorage.getItem(KLUC_KOD);
  } catch (chyba) {}

  if (!ulozenyKod) return ukazPrihlasenie();

  const chyba = await prihlas(ulozenyKod);
  if (chyba) {
    // Kód už neplatí (zmenený alebo vypnutý) alebo nejde internet
    if (chyba.startsWith("Tento kód")) {
      try { localStorage.removeItem(KLUC_KOD); } catch (e) {}
      ukazPrihlasenie("Tvoj kód už neplatí. Opýtaj sa učiteľa na nový.");
    } else {
      poleKodu.value = ulozenyKod;
      ukazPrihlasenie(chyba);
    }
  }
})();
