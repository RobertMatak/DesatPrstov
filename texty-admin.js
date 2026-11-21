// ===== Náhodné texty (učiteľ) =====
// Text patrí vybraným ročníkom (stĺpec rocniky, napr. [3, 4] alebo [7, 8, 9]).
// Uvidia ho všetky triedy učiteľa v týchto ročníkoch.
// Pravidlá v databáze zaručujú, že učiteľ vidí a mení len svoje texty.

const MIN_DLZKA_TEXTU = 20;    // kratší text nemá na precvičovanie zmysel
const MAX_DLZKA_TEXTU = 20000; // celá rozprávka; žiaci ho dostávajú po úryvkoch

let vsetkyTexty = [];  // všetky náhodné texty učiteľa
let textyTriedy = [];  // tie, ktoré sa práve zobrazujú (pre ročník triedy alebo všetky)
let upravovanyText = null; // text načítaný vo formulári na úpravu (null = pridávame nový)

// Neviditeľné znaky, ktoré sa často skryjú v texte skopírovanom z Wordu, PDF alebo webu.
// Na obrazovke ich nevidno, ale žiak by ich nedokázal napísať.
const NEVIDITELNE_ZNAKY = {
  "\u00AD": "mäkký rozdeľovník",          // miesto, kde sa slovo smie rozdeliť na konci riadku
  "\u200B": "medzera s nulovou šírkou",
  "\u200C": "nespájač s nulovou šírkou",
  "\u200D": "spájač s nulovou šírkou",
  "\u200E": "značka smeru textu",
  "\u200F": "značka smeru textu",
  "\u2060": "neviditeľný spájač slov",
  "\uFEFF": "neviditeľná značka BOM",
};
const NEVIDITELNE_REGEX = new RegExp("[" + Object.keys(NEVIDITELNE_ZNAKY).join("") + "]", "g");

// Upraví vložený text tak, aby sa dal písať na klávesnici:
// odstráni neviditeľné znaky, typografické úvodzovky a pomlčky z kníh
// a webu nahradí obyčajnými, nové riadky a viac medzier za sebou nahradí jednou medzerou.
function vycistiText(text) {
  return text
    .replace(NEVIDITELNE_REGEX, "") // napr. „ly­že“ s mäkkým rozdeľovníkom → „lyže“
    .normalize("NFC")
    .replace(/[„“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")  // \s = medzera, tabulátor, nový riadok…
    .trim();
}

// Vráti znaky, ktoré sa na slovenskej klávesnici nedajú napísať
function nepodporovaneZnaky(text) {
  const zle = Array.from(text).filter((znak) => krokyPreZnak(znak).length === 0); // klavesnica.js
  return [...new Set(zle)]; // Set odstráni duplikáty, ako set() v Pythone
}

// Hláška so zoznamom zlých znakov. Znak, ktorý nevidno (alebo ho
// ľahko prehliadneš), dostane aj popis a kód, napr. „U+2028“.
function hlaskaZlychZnakov(zle) {
  const popis = (znak) => {
    const kod = "U+" + znak.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    if (NEVIDITELNE_ZNAKY[znak]) return `${NEVIDITELNE_ZNAKY[znak]} (neviditeľný, ${kod})`;
    if (/[\p{C}\p{Z}]/u.test(znak)) return `neviditeľný znak (${kod})`; // riadiace znaky a zvláštne medzery
    return znak;
  };
  return "Tieto znaky sa nedajú napísať na slovenskej klávesnici, oprav ich: " + zle.map(popis).join(",  ");
}

// Počet slov v texte
const pocetSlov = (text) => text.split(" ").filter((s) => s.length > 0).length;

// ----- Ročníky -----
// [3, 4] → "3.–4.", [1, 3, 5, 6, 7] → "1., 3., 5.–7.", [1…9] → "všetky"
function popisRocnikov(rocniky, pripona = "ročník") {
  if (rocniky.length === 9) return "všetky ročníky";
  const casti = [];
  let od = rocniky[0];
  for (let i = 1; i <= rocniky.length; i++) {
    if (rocniky[i] !== rocniky[i - 1] + 1) { // koniec súvislého úseku
      const doR = rocniky[i - 1];
      casti.push(od === doR ? `${od}.` : `${od}.–${doR}.`);
      od = rocniky[i];
    }
  }
  return casti.join(", ") + " " + pripona;
}

function oznacRocniky(rocniky) {
  for (const box of document.querySelectorAll("input[name=rocnikText]")) {
    box.checked = rocniky.includes(Number(box.value));
  }
}

function vybraneRocniky() {
  return [...document.querySelectorAll("input[name=rocnikText]:checked")].map((b) => Number(b.value));
}

// Predvolene je zaškrtnutý ročník vybranej triedy
function predvoleneRocniky() {
  oznacRocniky(vybranaTrieda && vybranaTrieda.rocnik ? [vybranaTrieda.rocnik] : []);
}

// Rýchle tlačidlá 1.–4., 5.–9., všetky, žiadny
for (const b of document.querySelectorAll(".rychle-rocniky button")) {
  b.addEventListener("click", () => {
    oznacRocniky(b.dataset.rocniky ? b.dataset.rocniky.split(",").map(Number) : []);
  });
}

$("vsetkyMojeTexty").addEventListener("change", () => vykresliTexty());

async function nacitajTexty() {
  $("dlzkaPreTriedu").textContent = popisDlzkyTriedy(); // dlzky-admin.js

  const { data, error } = await db.from("texty").select("id, rocniky, nazov, autor, zdroj, text, vytvorene").order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);
  vsetkyTexty = data;

  // Upravovaný text medzitým zmizol → zrušíme úpravu; inak nastavíme ročník triedy
  if (upravovanyText && !vsetkyTexty.some((t) => t.id === upravovanyText.id)) zrusUpravuTextu();
  if (!upravovanyText) predvoleneRocniky();
  vykresliTexty();
}

function vykresliTexty() {
  // Texty pre ročník triedy, alebo všetky (prepínač, alebo trieda bez ročníka)
  const rocnik = vybranaTrieda.rocnik;
  const vsetky = $("vsetkyMojeTexty").checked || !rocnik;
  textyTriedy = vsetky ? vsetkyTexty : vsetkyTexty.filter((t) => t.rocniky.includes(rocnik));
  $("nadpisZoznamuTextov").firstChild.textContent =
    vsetky ? "Všetky moje náhodné texty " : `Náhodné texty pre ${rocnik}. ročník `;

  const zoznam = $("zoznamTextov");
  zoznam.innerHTML = "";
  $("ziadneTexty").classList.toggle("skryty", textyTriedy.length > 0);
  $("pocetTextov").textContent = textyTriedy.length > 0 ? `(${textyTriedy.length})` : "";

  for (const t of textyTriedy) {
    const li = document.createElement("li");
    if (upravovanyText && upravovanyText.id === t.id) li.classList.add("upravovany");

    const nahlad = document.createElement("span");
    nahlad.className = "nahlad";
    if (t.nazov) {
      const nazov = document.createElement("span");
      nazov.className = "nazov-textu";
      nazov.textContent = t.nazov;
      nahlad.appendChild(nazov);
    }
    const ukazka = t.text.length > 90 ? t.text.slice(0, 90) + "…" : t.text;
    nahlad.appendChild(document.createTextNode(`${ukazka} (${pocetSlov(t.text)} slov)`));
    nahlad.title = t.text.slice(0, 1000); // začiatok textu po prejdení myšou

    // Autor a zdroj pod textom (alebo upozornenie, že chýba)
    const zdroj = document.createElement("div");
    zdroj.className = "zdroj-v-zozname";
    const popis = [t.autor, t.zdroj].filter((x) => x).join(" – ");
    zdroj.textContent = popis ? "Zdroj: " + popis : "Zdroj nie je uvedený";
    if (!popis) zdroj.classList.add("chyba-zdroja");
    nahlad.appendChild(zdroj);

    const znacka = document.createElement("span");
    znacka.className = "znacka" + (t.rocniky.length === 9 ? " vsetky" : "");
    znacka.textContent = popisRocnikov(t.rocniky, "roč.");

    li.append(
      nahlad,
      znacka,
      tlacidlo("Upraviť", "druhotne", () => upravText(t)), // tlacidlo je z admin.js
      tlacidlo("Zmazať", "nebezpecne", () => zmazText(t)),
    );
    zoznam.appendChild(li);
  }
}

// Ten istý formulár slúži na pridanie nového textu aj na úpravu existujúceho
function upravText(t) {
  upravovanyText = t;
  $("novyText").value = t.text;
  $("autorTextu").value = t.autor || "";
  $("zdrojTextu").value = t.zdroj || "";
  oznacRocniky(t.rocniky);
  $("pridatText").textContent = "Uložiť zmeny";
  $("zrusitUpravuTextu").classList.remove("skryty");
  vykresliTexty(); // zvýrazní upravovaný text
  $("autorTextu").scrollIntoView({ behavior: "smooth", block: "center" });
  $("novyText").focus({ preventScroll: true });
}

function zrusUpravuTextu() {
  upravovanyText = null;
  for (const id of ["novyText", "autorTextu", "zdrojTextu"]) $(id).value = "";
  predvoleneRocniky();
  $("pridatText").textContent = "Pridať text";
  $("zrusitUpravuTextu").classList.add("skryty");
}

$("zrusitUpravuTextu").addEventListener("click", () => {
  zrusUpravuTextu();
  vykresliTexty();
});

$("pridatText").addEventListener("click", () => {
  sTlacidlom($("pridatText"), async () => {
    const text = vycistiText($("novyText").value);

    if (text.length < MIN_DLZKA_TEXTU) {
      return ukazHlasku(`Text je príliš krátky (aspoň ${MIN_DLZKA_TEXTU} znakov).`, true);
    }
    if (text.length > MAX_DLZKA_TEXTU) {
      return ukazHlasku(`Text je príliš dlhý: má ${text.length} znakov, najviac môže mať ${MAX_DLZKA_TEXTU}.`, true);
    }
    const zle = nepodporovaneZnaky(text);
    if (zle.length > 0) {
      return ukazHlasku(hlaskaZlychZnakov(zle), true);
    }
    if (vsetkyTexty.some((t) => t.text === text && (!upravovanyText || t.id !== upravovanyText.id))) {
      return ukazHlasku("Tento text už máš medzi náhodnými textami.", true);
    }
    const rocniky = vybraneRocniky();
    if (rocniky.length === 0) return ukazHlasku("Zaškrtni aspoň jeden ročník.", true);

    const jedenRiadok = (id) => $(id).value.trim().replace(/\s+/g, " ") || null; // prázdne → null
    const udaje = {
      text,
      autor: jedenRiadok("autorTextu"),
      zdroj: jedenRiadok("zdrojTextu"),
      rocniky,
      trieda_id: null, // o tom, kto text vidí, rozhodujú ročníky
    };

    if (upravovanyText) {
      const { error } = await db.from("texty").update(udaje).eq("id", upravovanyText.id);
      if (error) return ukazHlasku(popisChyby(error), true);
      ukazHlasku("Zmeny v texte sú uložené.");
    } else {
      const { error } = await db.from("texty").insert(udaje);
      if (error) return ukazHlasku(popisChyby(error), true);
      ukazHlasku(`Text bol pridaný pre ${popisRocnikov(rocniky)}.`);
    }

    zrusUpravuTextu();
    await nacitajTexty();
  });
});

async function zmazText(t) {
  const upozornenie = `Text zmizne pre ${popisRocnikov(t.rocniky)}, teda zo všetkých tvojich tried v ${t.rocniky.length === 1 ? "tomto ročníku" : "týchto ročníkoch"}.`;
  const popis = t.nazov || t.text.slice(0, 60) + "…";
  if (!confirm(`Zmazať text „${popis}“?\n${upozornenie}\nVýsledky žiakov ostanú.`)) return;

  const { error } = await db.from("texty").delete().eq("id", t.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  if (upravovanyText && upravovanyText.id === t.id) zrusUpravuTextu();
  ukazHlasku("Text bol zmazaný.");
  await nacitajTexty();
}
