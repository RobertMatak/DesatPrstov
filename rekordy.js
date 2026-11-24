// ===== Rekordy (aplikácia žiaka) =====
// Všetko pokope na jednej obrazovke:
//   1. Tento rok: lekcie a test rýchlosti – môj výsledok, miesto v triede a v škole, rekord školy
//   2. Sieň slávy: rekord každej lekcie a testu všetkých čias (👑 = drží ho žiak sám)
//   3. Moje osobné rekordy
// Údaje posiela databáza (funkcia rekordy_ziaka vo faza13.sql). Mená ostatných
// žiakov žiak nevidí, len mená rekordérov.

let udajeRekordov = null;

async function ukazRekordy() {
  aktualnaKapitola = null; // kniznica.js
  aktualneCvicenie = null; // lekcie.js
  aktualnyTest = null;     // test.js
  ukazObrazovku("rekordy"); // kniznica.js
  podlaId("popisRekordov").textContent = "Načítavam rekordy…";
  for (const id of ["rekordyTentoRok", "sienSlavy", "osobneRekordy"]) podlaId(id).innerHTML = "";

  const { data, error } = await db.rpc("rekordy_ziaka", { p_kod: kodZiaka }); // kodZiaka je v ziak.js
  if (error || !data) {
    podlaId("popisRekordov").textContent = "Rekordy sa nepodarilo načítať. Skontroluj internet a skús to znova.";
    return;
  }
  udajeRekordov = data;
  podlaId("popisRekordov").textContent = "Tvoje výsledky, miesta v rebríčkoch a rekordy školy pokope.";
  vykresliTentoRok(data);
  vykresliSienSlavy(data);
  vykresliOsobneRekordy(data.osobne);
}

// Pomôcka: tabuľka s hlavičkou a riadkami; bunka môže byť text alebo prvok
function vytvorTabulku(trieda, hlavicka, riadky) {
  const tabulka = document.createElement("table");
  tabulka.className = trieda;
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const nadpis of hlavicka) {
    const th = document.createElement("th");
    th.textContent = nadpis;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  const tbody = document.createElement("tbody");
  for (const { bunky, trieda: triedaRiadku } of riadky) {
    const tr = document.createElement("tr");
    if (triedaRiadku) tr.className = triedaRiadku;
    for (const obsah of bunky) {
      const td = document.createElement("td");
      td.append(obsah ?? "–");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabulka.append(thead, tbody);
  return tabulka;
}

const miestoText = (miesto, pocet) => (miesto ? `${miesto}. z ${pocet}` + (miesto === 1 ? " 🥇" : "") : "–");

// ===== 1. Tento rok =====
function vykresliTentoRok(d) {
  const obal = podlaId("rekordyTentoRok");
  const riadky = [];

  for (const l of d.lekcie) {
    const rekord = d.slava_lekcii[l.lekcia - 1];
    const moj = l.body !== null ? document.createElement("span") : null;
    if (moj) {
      moj.textContent = formatujBody(l.body); // lekcie.js
      if (l.cviceni < l.pocet_cviceni) {
        const pozn = document.createElement("small");
        pozn.textContent = ` (${l.cviceni} z ${l.pocet_cviceni} cv.)`;
        moj.appendChild(pozn);
      }
    }
    riadky.push({
      bunky: [
        `${l.lekcia}. ${LEKCIE[l.lekcia - 1].nazov}`, // lekcie-obsah.js
        moj,
        miestoText(l.miesto_trieda, l.pocet_trieda),
        miestoText(l.miesto_skola, l.pocet_skola),
        rekord.meno ? `${formatujBody(rekord.body)} · ${rekord.meno}${rekord.moj ? " 👑" : ""}` : "nikto",
        rekord.moj ? "👑 tvoj rekord" : rekord.meno && l.body !== null ? formatujBody(Math.round((rekord.body - l.body) * 10) / 10) : "–",
      ],
      trieda: rekord.moj ? "moj" : "",
    });
  }

  if (d.test) {
    const rekord = d.rekord_testu;
    riadky.push({
      bunky: [
        `⏱️ Test rýchlosti ${d.test.nazov}`,
        d.test.rychlost !== null ? `${d.test.rychlost} slov/min` : null,
        miestoText(d.test.miesto_trieda, d.test.pocet_trieda),
        miestoText(d.test.miesto_skola, d.test.pocet_skola),
        rekord ? `${rekord.rychlost} slov/min · ${rekord.meno}${rekord.moj ? " 👑" : ""}` : "nikto",
        rekord && rekord.moj ? "👑 tvoj rekord" : rekord && d.test.rychlost !== null ? `${rekord.rychlost - d.test.rychlost} slov/min` : "–",
      ],
      trieda: (rekord && rekord.moj ? "moj " : "") + "test",
    });
  }

  if (riadky.length === 0) {
    obal.textContent = "Tento rok zatiaľ nemáš lekcie a neprebieha test rýchlosti.";
    obal.className = "navod";
    return;
  }
  obal.className = "posuvne";
  obal.appendChild(vytvorTabulku("tabulka-rekordov",
    ["", "Môj výsledok", "V triede " + d.trieda, "V škole", "Rekord školy", "Do rekordu chýba"], riadky));
}

// ===== 2. Sieň slávy =====
function vykresliSienSlavy(d) {
  const riadky = d.slava_lekcii.map((r) => ({
    bunky: [
      `${r.lekcia}. ${LEKCIE[r.lekcia - 1].nazov}`,
      r.meno ? r.meno + (r.moj ? " 👑" : "") : "zatiaľ nikto",
      r.trieda, r.rok,
      r.meno ? formatujBody(r.body) : null,
    ],
    trieda: r.moj ? "moj" : r.meno ? "" : "prazdny",
  }));
  const t = d.rekord_testu;
  riadky.push({
    bunky: ["⏱️ Test rýchlosti", t ? t.meno + (t.moj ? " 👑" : "") : "zatiaľ nikto", t?.trieda, t?.rok,
      t ? `${t.rychlost} slov/min` : null],
    trieda: (t && t.moj ? "moj " : t ? "" : "prazdny ") + "test",
  });
  podlaId("sienSlavy").appendChild(vytvorTabulku("tabulka-rekordov", ["", "Rekordér", "Trieda", "Školský rok", "Rekord"], riadky));
}

// ===== 3. Moje osobné rekordy =====
// Hviezdy a splnené lekcie počítame z postupu v lekciách (lekcie.js), zvyšok poslala databáza
function vykresliOsobneRekordy(o) {
  let hviezd = 0;
  let splnenych = 0;
  for (const l of LEKCIE) {
    for (let c = 1; c <= cviceniaLekcie(l.cislo).length; c++) hviezd += hviezdyCvicenia(l.cislo, c);
    if (jeLekciaHotova(l.cislo)) splnenych++;
  }
  const hodiny = Math.floor(o.sekund / 3600);
  const minuty = Math.round((o.sekund % 3600) / 60);
  const cas = hodiny > 0 ? `${hodiny} h ${minuty} min` : `${minuty} min`;

  const dlazdice = [
    [o.najrychlejsi_text ?? "–", "najrýchlejší text (slov/min)"],
    [o.najlepsi_test ?? "–", "najlepší test rýchlosti (slov/min)"],
    [String(hviezd).replace(".", ",") + " ★", "hviezd v lekciách"],
    [splnenych, "splnených lekcií"],
    [o.bez_chyby, "textov bez jedinej chyby"],
    [o.textov, "napísaných textov spolu"],
    [cas, "čas písania spolu"],
  ];
  const obal = podlaId("osobneRekordy");
  for (const [cislo, popis] of dlazdice) {
    const div = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = cislo;
    const span = document.createElement("span");
    span.textContent = popis;
    div.append(strong, span);
    obal.appendChild(div);
  }
}
