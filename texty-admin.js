// ===== Náhodné texty (učiteľ) =====
// Text patrí vybraným ročníkom (stĺpec rocniky, napr. [3, 4] alebo [7, 8, 9]).
// Uvidia ho všetky triedy učiteľa v týchto ročníkoch.
// Na stránke má vlastnú časť „Náhodné texty“ s filtrom podľa ročníkov.
// Pravidlá v databáze zaručujú, že učiteľ vidí a mení len svoje texty.

const MIN_DLZKA_TEXTU = 20;    // kratší text nemá na precvičovanie zmysel
const MAX_DLZKA_TEXTU = 20000; // celá rozprávka; žiaci ho dostávajú po úryvkoch

let vsetkyTexty = [];  // všetky náhodné texty učiteľa
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
  aktualizujTlacidloTextu();
}

function vybraneRocniky() {
  return [...document.querySelectorAll("input[name=rocnikText]:checked")].map((b) => Number(b.value));
}

// Kým nie je zaškrtnutý ani jeden ročník, text sa nedá uložiť:
// tlačidlo je vypnuté a vedľa neho svieti upozornenie.
function aktualizujTlacidloTextu() {
  const ziadny = vybraneRocniky().length === 0;
  $("pridatText").disabled = ziadny;
  $("chybaRocnika").classList.toggle("skryty", !ziadny);
}

for (const box of document.querySelectorAll("input[name=rocnikText]")) {
  box.addEventListener("change", aktualizujTlacidloTextu);
}
aktualizujTlacidloTextu(); // na začiatku nie je zaškrtnuté nič

// Rýchle tlačidlá 1.–4., 5.–9., všetky, žiadny
for (const b of document.querySelectorAll(".rychle-rocniky button")) {
  b.addEventListener("click", () => {
    oznacRocniky(b.dataset.rocniky ? b.dataset.rocniky.split(",").map(Number) : []);
  });
}

async function nacitajTexty() {
  const { data, error } = await db.from("texty").select("id, rocniky, nazov, autor, zdroj, text, vytvorene").order("vytvorene");
  if (error) return ukazHlasku(popisChyby(error), true);
  vsetkyTexty = data;

  // Upravovaný text medzitým zmizol → zavrieme formulár
  if (upravovanyText && !vsetkyTexty.some((t) => t.id === upravovanyText.id)) zatvorFormularTextu();
  vykresliTexty();
}


// ===== Filter podľa ročníkov: Všetky | 1. (3) | 2. (0) | … =====
// "vsetky" alebo číslo ročníka 1–9; zapamätá sa aj po obnovení stránky (admin.js)
let filterTextov = Number(spomen("filterTextov")) || "vsetky";

function vykresliFilter() {
  const filter = $("filterRocnikov");
  filter.innerHTML = "";
  const moznosti = ["vsetky", 1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const m of moznosti) {
    const pocet = m === "vsetky" ? vsetkyTexty.length : vsetkyTexty.filter((t) => t.rocniky.includes(m)).length;
    const b = document.createElement("button");
    b.textContent = m === "vsetky" ? "Všetky" : `${m}.`;
    const cislo = document.createElement("span");
    cislo.className = "pocet";
    cislo.textContent = pocet;
    b.appendChild(cislo);
    b.title = m === "vsetky" ? "Všetky tvoje náhodné texty" : `Texty, ktoré píše ${m}. ročník`;
    if (m === filterTextov) b.classList.add("aktivny");
    if (pocet === 0 && m !== "vsetky") b.classList.add("prazdny");
    b.addEventListener("click", () => {
      filterTextov = m;
      zapamataj("filterTextov", m === "vsetky" ? null : String(m)); // admin.js
      vykresliTexty();
    });
    filter.appendChild(b);
  }
}

function vykresliTexty() {
  vykresliFilter();
  const rocnik = filterTextov === "vsetky" ? null : filterTextov;
  const zobrazene = rocnik ? vsetkyTexty.filter((t) => t.rocniky.includes(rocnik)) : vsetkyTexty;

  $("pocetTextov").textContent = vsetkyTexty.length > 0 ? `(${vsetkyTexty.length})` : "";
  $("popisFiltra").textContent = rocnik ? popisRocnika(rocnik) : ""; // dlzky-admin.js
  $("ziadneTexty").textContent = rocnik
    ? `Pre ${rocnik}. ročník zatiaľ nemáš žiadny text. Žiaci tohto ročníka píšu len vstavané texty.`
    : "Zatiaľ žiadne. Žiaci píšu len vstavané texty. Prvý pridáš tlačidlom + Nový text.";
  $("ziadneTexty").classList.toggle("skryty", zobrazene.length > 0);

  const zoznam = $("zoznamTextov");
  zoznam.innerHTML = "";

  for (const t of zobrazene) {
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


// ===== Formulár: nový text alebo úprava existujúceho =====
// t = text na úpravu, alebo null pre nový text (vtedy nie je zaškrtnutý žiadny ročník)
function otvorFormularTextu(t) {
  upravovanyText = t;
  $("novyText").value = t ? t.text : "";
  $("autorTextu").value = t ? t.autor || "" : "";
  $("zdrojTextu").value = t ? t.zdroj || "" : "";
  oznacRocniky(t ? t.rocniky : []);
  $("nadpisFormularaTextu").textContent = t ? "Úprava textu" : "Nový text";
  $("pridatText").textContent = t ? "Uložiť zmeny" : "Pridať text";
  $("formularTextu").classList.remove("skryty");
  $("novyTextTlacidlo").classList.add("skryty");
  vykresliTexty(); // zvýrazní upravovaný text
  $("formularTextu").scrollIntoView({ behavior: "smooth", block: "start" });
  (t ? $("novyText") : $("autorTextu")).focus({ preventScroll: true });
}

function zatvorFormularTextu() {
  upravovanyText = null;
  for (const id of ["novyText", "autorTextu", "zdrojTextu"]) $(id).value = "";
  oznacRocniky([]);
  $("formularTextu").classList.add("skryty");
  $("novyTextTlacidlo").classList.remove("skryty");
}

const upravText = (t) => otvorFormularTextu(t);

$("novyTextTlacidlo").addEventListener("click", () => otvorFormularTextu(null));

$("zrusitUpravuTextu").addEventListener("click", () => {
  zatvorFormularTextu();
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
    // Ak by sa uložený text pri zvolenom filtri nezobrazil, prepneme filter na jeho ročník
    if (filterTextov !== "vsetky" && !rocniky.includes(filterTextov)) {
      filterTextov = rocniky[0];
      zapamataj("filterTextov", String(filterTextov));
    }

    zatvorFormularTextu();
    await nacitajTexty();
  }).then(aktualizujTlacidloTextu); // sTlacidlom na konci tlačidlo zapne; znova skontrolujeme ročníky
});

async function zmazText(t) {
  const upozornenie = `Text zmizne pre ${popisRocnikov(t.rocniky)}, teda zo všetkých tvojich tried v ${t.rocniky.length === 1 ? "tomto ročníku" : "týchto ročníkoch"}.`;
  const popis = t.nazov || t.text.slice(0, 60) + "…";
  if (!confirm(`Zmazať text „${popis}“?\n${upozornenie}\nVýsledky žiakov ostanú.`)) return;

  const { error } = await db.from("texty").delete().eq("id", t.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  if (upravovanyText && upravovanyText.id === t.id) zatvorFormularTextu();
  ukazHlasku("Text bol zmazaný.");
  await nacitajTexty();
}
