// ===== Rebríčky lekcií (učiteľ) =====
// Rating žiaka v lekcii počíta databáza (funkcia rating_lekcie vo faza11.sql):
// priemer najlepších bodov z každého cvičenia, body = rýchlosť × presnosť³.
// Učiteľ vidí žiakov svojich tried. Do rebríčka patria aktívni žiaci,
// ktorí majú lekciu v rozsahu „od–do“ svojho ročníka (⚙️ Nastavenia).

let ratingLekcie = [];   // [{ ziak_id, trieda_id, meno, body, rychlost, presnost, cviceni }]
let lekciaRebricka = Number(spomen("lekciaRebricka")) || 0; // admin.js; 0 = ešte nevybraná

// 31.1 → "31,1"
const formatujBody = (n) => Number(n).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Ročníky, ktoré majú lekciu v rozsahu: [5, 6] (dlzky-admin.js: lekcieOd, lekcieDo)
function rocnikyLekcie(lekcia) {
  const rocniky = [];
  for (let i = 0; i < 9; i++) if (lekcieOd[i] >= 1 && lekcia >= lekcieOd[i] && lekcia <= lekcieDo[i]) rocniky.push(i + 1);
  return rocniky;
}

// Výber lekcie: "9. O P (5.–6. roč.)"
function vyplnLekcie() {
  const vyber = $("lekciaRebricka");
  const predtym = vyber.value;
  vyber.innerHTML = "";
  for (const l of LEKCIE) { // lekcie-obsah.js
    const rocniky = rocnikyLekcie(l.cislo);
    const moznost = document.createElement("option");
    moznost.value = l.cislo;
    moznost.textContent = `${l.cislo}. ${l.nazov}` + (rocniky.length ? ` (${popisRocnikov(rocniky, "roč.")})` : " – žiadny ročník"); // texty-admin.js
    vyber.appendChild(moznost);
  }
  // Predvolene najnižšia lekcia, ktorú nejaký ročník robí
  if (!lekciaRebricka) lekciaRebricka = LEKCIE.find((l) => rocnikyLekcie(l.cislo).length > 0)?.cislo || 1;
  vyber.value = predtym || lekciaRebricka;
}

// Výber, koho rebríček: celá škola, ročník, alebo trieda
function vyplnRozsah() {
  const vyber = $("rozsahRebricka");
  const predtym = vyber.value || spomen("rozsahRebricka") || "skola";
  vyber.innerHTML = "";
  const pridaj = (hodnota, text) => {
    const m = document.createElement("option");
    m.value = hodnota;
    m.textContent = text;
    vyber.appendChild(m);
  };
  pridaj("skola", "Celá škola (všetky moje triedy)");
  const rocniky = [...new Set(triedy.map((t) => t.rocnik).filter((r) => r))].sort((a, b) => a - b); // admin.js
  for (const r of rocniky) pridaj("r" + r, `${r}. ročník`);
  for (const t of triedy) pridaj("t" + t.id, `Trieda ${t.nazov}`);
  vyber.value = [...vyber.options].some((o) => o.value === predtym) ? predtym : "skola";
}

// Načíta rating pre vybranú lekciu (volá sa pri otvorení časti Rebríčky a pri zmene lekcie)
async function nacitajRebricek() {
  vyplnLekcie();
  vyplnRozsah();
  lekciaRebricka = Number($("lekciaRebricka").value);
  const { data, error } = await db.rpc("rating_lekcie", { p_lekcia: lekciaRebricka });
  if (error) {
    ratingLekcie = [];
    vykresliRebricek();
    return ukazHlasku(error.code === "PGRST202"
      ? "V databáze ešte chýbajú rebríčky: spusti v Supabase súbor faza11.sql."
      : popisChyby(error), true);
  }
  ratingLekcie = data;
  vykresliRebricek();
}

// Žiaci podľa vybraného rozsahu, zoradení, s miestom (rovnaký rating = rovnaké miesto)
function riadkyRebricka() {
  const rozsah = $("rozsahRebricka").value;
  const trieda = (id) => triedy.find((t) => t.id === id);
  let riadky = ratingLekcie.map((r) => ({ ...r, body: Number(r.body), trieda: trieda(r.trieda_id) }));
  if (rozsah.startsWith("r")) riadky = riadky.filter((r) => r.trieda && r.trieda.rocnik === Number(rozsah.slice(1)));
  if (rozsah.startsWith("t")) riadky = riadky.filter((r) => r.trieda_id === rozsah.slice(1));

  riadky.sort((a, b) => b.body - a.body || podlaAbecedy(a.meno, b.meno)); // admin.js
  riadky.forEach((r, i) => {
    r.miesto = i > 0 && riadky[i - 1].body === r.body ? riadky[i - 1].miesto : i + 1;
  });
  const pocet = Number($("pocetRebricka").value);
  return pocet > 0 ? riadky.filter((r) => r.miesto <= pocet) : riadky;
}

function vykresliRebricek() {
  const riadky = riadkyRebricka();
  const telo = $("rebricekRiadky");
  telo.innerHTML = "";
  const pocetCviceni = cviceniaLekcie(lekciaRebricka).length; // lekcie-obsah.js

  for (const r of riadky) {
    const tr = document.createElement("tr");
    if (r.miesto <= 3) tr.classList.add("miesto-" + r.miesto);
    for (const obsah of [
      r.miesto + ".",
      r.meno,
      r.trieda ? r.trieda.nazov : "",
      formatujBody(r.body),
      Math.round(r.rychlost),
      Math.round(r.presnost) + " %",
      `${r.cviceni} z ${pocetCviceni}`,
    ]) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    telo.appendChild(tr);
  }

  const rocniky = rocnikyLekcie(lekciaRebricka);
  $("ziadnyRebricek").textContent = rocniky.length === 0
    ? "Túto lekciu nemá v rozsahu žiadny ročník (⚙️ Nastavenia → Lekcie od–do), preto nemá rebríček."
    : "V tejto lekcii zatiaľ nikto nemá body.";
  $("ziadnyRebricek").classList.toggle("skryty", riadky.length > 0);
  $("tabulkaRebricka").classList.toggle("skryty", riadky.length === 0);
}

// Nadpis rebríčka, napr. „Lekcia 9: O P – 5. ročník“
function nadpisRebricka() {
  const l = LEKCIE[lekciaRebricka - 1];
  const rozsah = $("rozsahRebricka");
  return `Lekcia ${l.cislo}: ${l.nazov} – ${rozsah.options[rozsah.selectedIndex].text}`;
}

$("lekciaRebricka").addEventListener("change", () => {
  lekciaRebricka = Number($("lekciaRebricka").value);
  zapamataj("lekciaRebricka", String(lekciaRebricka));
  nacitajRebricek();
});
$("rozsahRebricka").addEventListener("change", () => {
  zapamataj("rozsahRebricka", $("rozsahRebricka").value);
  vykresliRebricek();
});
$("pocetRebricka").addEventListener("change", vykresliRebricek);

// ----- Tlač: len nadpis a tabuľka (kartičky žiakov sa pri tom vyprázdnia) -----
$("tlacitRebricek").addEventListener("click", () => {
  if (riadkyRebricka().length === 0) return ukazHlasku("Rebríček je prázdny, nie je čo tlačiť.", true);
  const tlac = $("tlacRebricka");
  tlac.innerHTML = "";
  $("karticky").innerHTML = "";

  const nadpis = document.createElement("h1");
  nadpis.textContent = "Rebríček – " + nadpisRebricka();
  const popis = document.createElement("p");
  popis.textContent = `Desať Prstov · ${new Date().toLocaleDateString("sk-SK")} · ` +
    "rating = priemer najlepších bodov z cvičení, body = rýchlosť × presnosť³";
  tlac.append(nadpis, popis, $("tabulkaRebricka").cloneNode(true));
  window.print();
});
