// ===== Test rýchlosti v Nastaveniach (učiteľ) =====
// Test = názov (napr. "2026/27"), jeden text a obdobie od–do.
// Žiaci ho vidia, kým beží; ak sa obdobia prekrývajú, beží novší.
// Pravidlá v databáze zaručujú, že učiteľ vidí a mení len svoje testy.

const MIN_SLOV_TESTU = 120;   // menej by najrýchlejší žiaci dopísali skôr ako za minútu
const ODPORUCANE_SLOV = 150;

let testy = [];               // testy učiteľa
let upravovanyTest = null;    // test vo formulári (null = nový)

// "2026-06-30" → "30. 6. 2026"
const formatujDen = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("sk-SK");

// Dátum ako text pre <input type="date">: "2026-11-23"
const denNaText = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Školský rok dnes: v novembri 2026 → "2026/27" a koniec 30. 6. 2027
function terajsiSkolskyRok() {
  const dnes = new Date();
  const zaciatok = dnes.getMonth() >= 8 ? dnes.getFullYear() : dnes.getFullYear() - 1; // september = mesiac 8
  return { nazov: `${zaciatok}/${String((zaciatok + 1) % 100).padStart(2, "0")}`, koniec: `${zaciatok + 1}-06-30` };
}

const dnesText = () => denNaText(new Date());
const bezi = (t) => t.od_dna <= dnesText() && dnesText() <= t.do_dna;

async function nacitajTesty() {
  const { data, error } = await db.from("testy_rychlosti")
    .select("id, nazov, text, od_dna, do_dna, vytvorene")
    .order("vytvorene", { ascending: false });
  if (error) {
    // Databáza ešte bez testov (nespustený faza12.sql): kartu necháme prázdnu
    testy = [];
    $("ziadneTesty").textContent = "V databáze ešte chýba test rýchlosti: spusti v Supabase súbor faza12.sql.";
  } else {
    testy = data.sort((a, b) => b.vytvorene.localeCompare(a.vytvorene)); // najnovší prvý
    $("ziadneTesty").textContent = "Zatiaľ nemáš žiadny test.";
  }
  vykresliTesty();
}

function vykresliTesty() {
  const zoznam = $("zoznamTestov");
  zoznam.innerHTML = "";
  $("ziadneTesty").classList.toggle("skryty", testy.length > 0);
  // Ktorý test práve beží: najnovší z tých, ktorých obdobie zahŕňa dnešok
  const beziaci = testy.find(bezi);

  for (const t of testy) {
    const li = document.createElement("li");
    if (upravovanyTest && upravovanyTest.id === t.id) li.classList.add("upravovany");
    const nahlad = document.createElement("span");
    nahlad.className = "nahlad";
    const nazov = document.createElement("span");
    nazov.className = "nazov-textu";
    nazov.textContent = t.nazov;
    nahlad.append(nazov, `${formatujDen(t.od_dna)} – ${formatujDen(t.do_dna)} · ${pocetSlov(t.text)} slov`); // pocetSlov: texty-admin.js
    const ukazka = document.createElement("div");
    ukazka.className = "zdroj-v-zozname";
    ukazka.textContent = t.text.slice(0, 90) + (t.text.length > 90 ? "…" : "");
    nahlad.appendChild(ukazka);

    const znacka = document.createElement("span");
    znacka.className = "znacka" + (beziaci && beziaci.id === t.id ? " vsetky" : "");
    znacka.textContent = beziaci && beziaci.id === t.id ? "práve beží"
      : t.do_dna < dnesText() ? "skončený" : t.od_dna > dnesText() ? "čaká na začiatok" : "prekrytý novším";

    li.append(nahlad, znacka,
      tlacidlo("Upraviť", "druhotne", () => otvorFormularTestu(t)), // tlacidlo je z admin.js
      tlacidlo("Zmazať", "nebezpecne", () => zmazTest(t)));
    zoznam.appendChild(li);
  }
}

// ----- Formulár -----
function otvorFormularTestu(t) {
  upravovanyTest = t;
  const rok = terajsiSkolskyRok();
  $("nazovTestu").value = t ? t.nazov : rok.nazov;
  $("odTestu").value = t ? t.od_dna : dnesText();
  $("doTestu").value = t ? t.do_dna : rok.koniec;
  $("textTestu").value = t ? t.text : "";
  $("nadpisFormularaTestu").textContent = t ? "Úprava testu" : "Nový test";
  $("formularTestu").classList.remove("skryty");
  $("novyTestTlacidlo").classList.add("skryty");
  aktualizujPocetSlovTestu();
  vykresliTesty();
  $("formularTestu").scrollIntoView({ behavior: "smooth", block: "start" });
}

function zatvorFormularTestu() {
  upravovanyTest = null;
  $("formularTestu").classList.add("skryty");
  $("novyTestTlacidlo").classList.remove("skryty");
  vykresliTesty();
}

// Počet slov pod textom, kým učiteľ píše
function aktualizujPocetSlovTestu() {
  const slov = pocetSlov(vycistiText($("textTestu").value)); // texty-admin.js
  $("pocetSlovTestu").textContent = `${slov} slov` +
    (slov < MIN_SLOV_TESTU ? ` – potrebných je aspoň ${MIN_SLOV_TESTU}`
      : slov < ODPORUCANE_SLOV ? ` – odporúčam aspoň ${ODPORUCANE_SLOV}` : " ✓");
}

$("textTestu").addEventListener("input", aktualizujPocetSlovTestu);
$("novyTestTlacidlo").addEventListener("click", () => otvorFormularTestu(null));
$("zrusitTest").addEventListener("click", zatvorFormularTestu);

$("ulozitTest").addEventListener("click", () => {
  sTlacidlom($("ulozitTest"), async () => {
    const nazov = $("nazovTestu").value.trim().replace(/\s+/g, " ");
    const od = $("odTestu").value;
    const po = $("doTestu").value;
    const text = vycistiText($("textTestu").value); // texty-admin.js: neviditeľné znaky, úvodzovky…

    if (!nazov) return ukazHlasku("Napíš názov testu, napríklad 2026/27.", true);
    if (!od || !po) return ukazHlasku("Vyber dátum od a do.", true);
    if (od > po) return ukazHlasku("Dátum „od“ musí byť pred dátumom „do“.", true);
    if (pocetSlov(text) < MIN_SLOV_TESTU) {
      return ukazHlasku(`Text má len ${pocetSlov(text)} slov, potrebných je aspoň ${MIN_SLOV_TESTU}, ` +
        "aby ho ani najrýchlejší žiaci nedopísali skôr ako za minútu.", true);
    }
    if (text.length > MAX_DLZKA_TEXTU) { // texty-admin.js
      return ukazHlasku(`Text je príliš dlhý: má ${text.length} znakov, najviac môže mať ${MAX_DLZKA_TEXTU}.`, true);
    }
    const zle = nepodporovaneZnaky(text); // texty-admin.js
    if (zle.length > 0) return ukazHlasku(hlaskaZlychZnakov(zle), true);

    // Prekrýva sa s iným testom? Žiaci budú písať novší, preto sa radšej opýtame.
    const prekryty = testy.find((t) => (!upravovanyTest || t.id !== upravovanyTest.id) && t.od_dna <= po && od <= t.do_dna);
    if (prekryty && !confirm(`Obdobie sa prekrýva s testom „${prekryty.nazov}“ ` +
        `(${formatujDen(prekryty.od_dna)} – ${formatujDen(prekryty.do_dna)}). Žiaci budú v tom čase písať novší test. Pokračovať?`)) return;

    const udaje = { nazov, text, od_dna: od, do_dna: po };
    const { error } = upravovanyTest
      ? await db.from("testy_rychlosti").update(udaje).eq("id", upravovanyTest.id)
      : await db.from("testy_rychlosti").insert(udaje);
    if (error) return ukazHlasku(popisChyby(error), true);

    ukazHlasku(upravovanyTest ? "Test je upravený." : `Test „${nazov}“ je vytvorený. Žiaci ho uvidia od ${formatujDen(od)}.`);
    zatvorFormularTestu();
    await nacitajTesty();
  });
});

async function zmazTest(t) {
  if (!confirm(`Zmazať test „${t.nazov}“?\n\nPokusy žiakov ostanú v ich výsledkoch a sieň slávy testu ostane, ` +
               "ale rebríček tohto testu zmizne. Toto sa nedá vrátiť.")) return;
  const { error } = await db.from("testy_rychlosti").delete().eq("id", t.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  if (upravovanyTest && upravovanyTest.id === t.id) zatvorFormularTestu();
  ukazHlasku("Test bol zmazaný.");
  await nacitajTesty();
}
