// ===== Rebríčky lekcií (učiteľ) =====
// Rating žiaka v lekcii počíta databáza (funkcia rating_lekcie vo faza11.sql):
// priemer najlepších bodov z každého cvičenia, body = rýchlosť × presnosť³.
// Učiteľ vidí žiakov svojich tried. Do rebríčka patria aktívni žiaci,
// ktorí majú lekciu v rozsahu „od–do“ svojho ročníka (⚙️ Nastavenia).

let ratingLekcie = [];   // [{ ziak_id, trieda_id, meno, body, rychlost, presnost, cviceni }]
let rekordyLekcie = [];  // sieň slávy: [{ id, meno, trieda, skolsky_rok, body, rychlost, presnost }]
let rezimRebricka = spomen("rezimRebricka") || "rok"; // "rok" = aktuálny rebríček, "slava" = sieň slávy
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

// Načíta rebríček pre vybranú lekciu (volá sa pri otvorení časti Rebríčky a pri zmene lekcie)
async function nacitajRebricek() {
  vyplnLekcie();
  vyplnRozsah();
  nastavRezim(rezimRebricka);
  lekciaRebricka = Number($("lekciaRebricka").value);

  if (rezimRebricka === "slava") {
    // Sieň slávy: učiteľovi pravidlá v databáze ukážu rekordy žiakov jeho tried
    const { data, error } = await db.from("rekordy_lekcii")
      .select("id, meno, trieda, skolsky_rok, body, rychlost, presnost, datum")
      .eq("lekcia", lekciaRebricka)
      .order("body", { ascending: false })
      .order("datum");
    rekordyLekcie = error ? [] : data;
    if (error) ukazHlasku(error.code === "42P01" || error.code === "PGRST205"
      ? "V databáze ešte chýba sieň slávy: spusti v Supabase súbor faza11b.sql."
      : popisChyby(error), true);
    return vykresliSienSlavy();
  }

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

// Prepínač Aktuálny rebríček / Sieň slávy
function nastavRezim(rezim) {
  rezimRebricka = rezim;
  for (const b of document.querySelectorAll("#rezimRebricka button")) {
    b.classList.toggle("aktivny", b.dataset.rezim === rezim);
  }
  const slava = rezim === "slava";
  $("popisSlavy").classList.toggle("skryty", !slava);
  $("rozsahRebrickaObal").classList.toggle("skryty", slava); // v sieni slávy sú triedy z minulých rokov
  $("tabulkaRebricka").classList.add("skryty");
  $("tabulkaSlavy").classList.add("skryty");
}

for (const b of document.querySelectorAll("#rezimRebricka button")) {
  b.addEventListener("click", () => {
    zapamataj("rezimRebricka", b.dataset.rezim);
    rezimRebricka = b.dataset.rezim;
    nacitajRebricek();
  });
}

// Sieň slávy: všetky záznamy lekcie, prvý je rekord
function vykresliSienSlavy() {
  const pocet = Number($("pocetRebricka").value);
  const riadky = rekordyLekcie.map((r) => ({ ...r, body: Number(r.body) }));
  riadky.forEach((r, i) => {
    r.miesto = i > 0 && riadky[i - 1].body === r.body ? riadky[i - 1].miesto : i + 1;
  });
  const zobrazene = pocet > 0 ? riadky.filter((r) => r.miesto <= pocet) : riadky;

  const telo = $("slavaRiadky");
  telo.innerHTML = "";
  for (const r of zobrazene) {
    const tr = document.createElement("tr");
    if (r.miesto <= 3) tr.classList.add("miesto-" + r.miesto);
    for (const obsah of [
      r.miesto + ".", r.meno, r.trieda, r.skolsky_rok, formatujBody(r.body),
      r.rychlost ?? "–", r.presnost === null ? "–" : r.presnost + " %",
    ]) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    const akcie = document.createElement("td");
    akcie.className = "akcie netlacit";
    akcie.appendChild(tlacidlo("Zmazať", "nebezpecne", () => zmazRekord(r))); // tlacidlo je z admin.js
    tr.appendChild(akcie);
    telo.appendChild(tr);
  }
  $("ziadnyRebricek").textContent = "V sieni slávy tejto lekcie zatiaľ nikto nie je.";
  $("ziadnyRebricek").classList.toggle("skryty", zobrazene.length > 0);
  $("tabulkaSlavy").classList.toggle("skryty", zobrazene.length === 0);
}

async function zmazRekord(r) {
  if (!confirm(`Zmazať záznam ${r.meno} (${r.trieda}, ${r.skolsky_rok}, rating ${formatujBody(r.body)}) zo siene slávy?
` +
               "Hodí sa, ak niekto písal za spolužiaka. Výsledky žiaka ostanú, toto sa nedá vrátiť.")) return;
  const { error } = await db.from("rekordy_lekcii").delete().eq("id", r.id);
  if (error) return ukazHlasku(popisChyby(error), true);
  ukazHlasku("Záznam bol zo siene slávy zmazaný.");
  await nacitajRebricek();
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
  if (rezimRebricka === "slava") return `Lekcia ${l.cislo}: ${l.nazov} – Sieň slávy`;
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
$("pocetRebricka").addEventListener("change", () => {
  if (rezimRebricka === "slava") vykresliSienSlavy();
  else vykresliRebricek();
});

// ----- Tlač: len nadpis a tabuľka (kartičky žiakov sa pri tom vyprázdnia) -----
$("tlacitRebricek").addEventListener("click", () => {
  const tabulka = rezimRebricka === "slava" ? $("tabulkaSlavy") : $("tabulkaRebricka");
  if (tabulka.classList.contains("skryty")) return ukazHlasku("Rebríček je prázdny, nie je čo tlačiť.", true);
  const tlac = $("tlacRebricka");
  tlac.innerHTML = "";
  $("karticky").innerHTML = "";

  const nadpis = document.createElement("h1");
  nadpis.textContent = "Rebríček – " + nadpisRebricka();
  const popis = document.createElement("p");
  popis.textContent = `Desať Prstov · ${new Date().toLocaleDateString("sk-SK")} · ` +
    "rating = priemer najlepších bodov z cvičení, body = rýchlosť × presnosť³";
  const kopia = tabulka.cloneNode(true);
  kopia.classList.remove("skryty");
  kopia.querySelectorAll(".netlacit").forEach((el) => el.remove()); // bez tlačidiel Zmazať
  tlac.append(nadpis, popis, kopia);
  window.print();
});
