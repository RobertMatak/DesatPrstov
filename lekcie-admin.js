// ===== Lekcie v prehľade triedy (učiteľ) =====
// Z výsledkov s druhom "lekcia" (vysledky-admin.js → vysledkyTriedy) zistí,
// koľko hviezd má žiak v každom cvičení a lekcii, a či sa niekde zasekol.
// Počet cvičení a hviezdy berie z lekcie-obsah.js (rovnako ako aplikácia žiaka),
// rozsah lekcií a potrebnú presnosť z nastavení ročníkov (dlzky-admin.js).

// Lekcie na tento rok pre vybranú triedu: { od, do }; do = 0 → trieda lekcie nemá
function rozsahLekciiTriedy() {
  const r = vybranaTrieda && vybranaTrieda.rocnik; // admin.js
  if (!r) return { od: 1, do: POCET_LEKCII };       // trieda bez ročníka (krúžok): všetky
  return { od: lekcieOd[r - 1], do: lekcieDo[r - 1] }; // dlzky-admin.js
}

const pocetCviceni = (lekcia) => cviceniaLekcie(lekcia).length; // lekcie-obsah.js

// Pokusy žiaka v cvičení, najstarší prvý
function pokusyVCviceni(idZiaka, lekcia, cvicenie) {
  return vysledkyTriedy.filter((r) => r.ziak_id === idZiaka && r.druh === "lekcia" &&
    r.lekcia === lekcia && r.cvicenie === cvicenie);
}

function najlepsiaPresnost(idZiaka, lekcia, cvicenie) {
  const pokusy = pokusyVCviceni(idZiaka, lekcia, cvicenie);
  return pokusy.length === 0 ? undefined : Math.max(...pokusy.map((r) => r.presnost));
}

function hviezdyCviceniaZiaka(idZiaka, lekcia, cvicenie) {
  return hviezdyZaPresnost(najlepsiaPresnost(idZiaka, lekcia, cvicenie), potrebnaPresnostTriedy());
}

// Hviezdy lekcie = priemer cvičení, nadol na polovičky (rovnako ako u žiaka)
function hviezdyLekcieZiaka(idZiaka, lekcia) {
  let sucet = 0;
  for (let c = 1; c <= pocetCviceni(lekcia); c++) sucet += hviezdyCviceniaZiaka(idZiaka, lekcia, c);
  return Math.floor((sucet / pocetCviceni(lekcia)) * 2) / 2;
}

function jeLekciaHotovaZiaka(idZiaka, lekcia) {
  for (let c = 1; c <= pocetCviceni(lekcia); c++) {
    if (hviezdyCviceniaZiaka(idZiaka, lekcia, c) === 0) return false;
  }
  return true;
}

function zacalLekciu(idZiaka, lekcia) {
  return vysledkyTriedy.some((r) => r.ziak_id === idZiaka && r.druh === "lekcia" && r.lekcia === lekcia);
}

// Zasekol sa v cvičení = cvičenie ešte nemá splnené a posledné 3 pokusy boli pod hranicou
function zasekolSaVCviceni(idZiaka, lekcia, cvicenie) {
  if (hviezdyCviceniaZiaka(idZiaka, lekcia, cvicenie) > 0) return false;
  const posledne = pokusyVCviceni(idZiaka, lekcia, cvicenie).slice(-POKUSOV_NA_ZASEKNUTIE); // vysledky-admin.js
  return posledne.length === POKUSOV_NA_ZASEKNUTIE &&
    posledne.every((r) => r.presnost < potrebnaPresnostTriedy());
}

function zasekolSaVLekcii(idZiaka, lekcia) {
  for (let c = 1; c <= pocetCviceni(lekcia); c++) {
    if (zasekolSaVCviceni(idZiaka, lekcia, c)) return true;
  }
  return false;
}

// Lekcie, ktoré žiak skúšal (aj mimo rozsahu triedy), zoradené
function skusaneLekcie(idZiaka) {
  const cisla = new Set(vysledkyTriedy
    .filter((r) => r.ziak_id === idZiaka && r.druh === "lekcia" && r.lekcia)
    .map((r) => r.lekcia));
  return [...cisla].filter((l) => l <= POCET_LEKCII).sort((a, b) => a - b);
}

// Pre stĺpec „Lekcie“ v prehľade triedy: počet splnených lekcií na tento rok
// (null, ak trieda lekcie nemá) a či sa žiak niekde zasekol
function prehladLekciiZiaka(idZiaka) {
  const { od, do: po } = rozsahLekciiTriedy();
  let hotove = null;
  if (po > 0) {
    hotove = 0;
    for (let l = od; l <= po; l++) if (jeLekciaHotovaZiaka(idZiaka, l)) hotove++;
  }
  return {
    hotove,
    pocet: po > 0 ? po - od + 1 : 0,
    zaseknuty: skusaneLekcie(idZiaka).some((l) => zasekolSaVLekcii(idZiaka, l)),
  };
}

// Päť hviezdičiek (rovnaký vzhľad ako u žiaka)
function hviezdyEl(pocet) {
  const el = document.createElement("span");
  el.className = "hviezdy";
  el.title = `${Math.floor(pocet)}${pocet % 1 ? "½" : ""} z 5 hviezd`;
  const plne = document.createElement("span");
  plne.className = "plne";
  plne.style.width = (pocet / 5) * 100 + "%";
  el.appendChild(plne);
  return el;
}

const bunkaTabulky = (znacka, ...obsah) => {
  const el = document.createElement(znacka);
  el.append(...obsah);
  return el;
};


// ===== Postup v lekciách: vybraný žiak alebo celá trieda =====
function vykresliPostupVLekciach() {
  const { od, do: po } = rozsahLekciiTriedy();
  const obal = $("postupVLekciach");
  obal.innerHTML = "";
  const potrebna = potrebnaPresnostTriedy();

  if (vybranyZiak) {
    // Lekcie na tento rok + všetky ostatné, ktoré žiak skúšal
    const lekcie = new Set(skusaneLekcie(vybranyZiak.id));
    for (let l = od; l >= 1 && l <= po; l++) lekcie.add(l);
    const zoznam = [...lekcie].sort((a, b) => a - b);
    $("postupVLekciachKontajner").classList.toggle("skryty", zoznam.length === 0);
    if (zoznam.length === 0) return;

    $("popisPostupuLekcii").textContent =
      `Cvičenie splní s presnosťou aspoň ${potrebna} %, hviezdy sú za najlepšiu presnosť. ` +
      `Čísla v zátvorke = počet pokusov. ⚠ = posledné ${POKUSOV_NA_ZASEKNUTIE} pokusy v cvičení boli pod hranicou.`;

    const tabulka = document.createElement("table");
    tabulka.className = "lekcie-ziaka";
    const maxCviceni = Math.max(...zoznam.map(pocetCviceni));
    const hlavicka = document.createElement("tr");
    hlavicka.append(bunkaTabulky("th", "Lekcia"), bunkaTabulky("th", "Spolu"));
    for (let c = 1; c <= maxCviceni; c++) hlavicka.append(bunkaTabulky("th", `${c}. cvičenie`));
    tabulka.appendChild(hlavicka);

    for (const l of zoznam) {
      const tr = document.createElement("tr");
      const mimo = l < od || l > po;
      if (mimo) tr.classList.add("mimo-rozsahu");
      const nazov = bunkaTabulky("td", `${l}. ${LEKCIE[l - 1].nazov}`);
      if (l < od) nazov.append(bunkaTabulky("small", " opakovanie"));
      if (l > po) nazov.append(bunkaTabulky("small", " nad rozsah"));
      const spolu = bunkaTabulky("td", hviezdyEl(hviezdyLekcieZiaka(vybranyZiak.id, l)));
      if (jeLekciaHotovaZiaka(vybranyZiak.id, l)) spolu.append(" ✓");
      tr.append(nazov, spolu);

      for (let c = 1; c <= maxCviceni; c++) {
        const td = document.createElement("td");
        if (c <= pocetCviceni(l)) {
          const pokusy = pokusyVCviceni(vybranyZiak.id, l, c);
          if (pokusy.length === 0) {
            td.textContent = "–";
            td.className = "sivy";
          } else {
            td.append(hviezdyEl(hviezdyCviceniaZiaka(vybranyZiak.id, l, c)),
              ` ${najlepsiaPresnost(vybranyZiak.id, l, c)} % (${pokusy.length})`);
            if (zasekolSaVCviceni(vybranyZiak.id, l, c)) {
              td.append(" ⚠");
              td.classList.add("zaseknuty");
            }
          }
          td.title = cviceniaLekcie(l)[c - 1].nazov;
        }
        tr.appendChild(td);
      }
      tabulka.appendChild(tr);
    }
    obal.appendChild(tabulka);
    return;
  }

  // Celá trieda: žiaci × lekcie na tento rok, v bunke hviezdy lekcie
  $("postupVLekciachKontajner").classList.toggle("skryty", po === 0 || ziaci.length === 0);
  if (po === 0 || ziaci.length === 0) return;
  $("popisPostupuLekcii").textContent =
    `Lekcie ${od}–${po} na tento rok: hviezdy za lekciu (priemer cvičení), ✓ = splnená celá lekcia, ` +
    `⚠ = žiak sa v nej zasekol. Dole je, koľko žiakov lekciu splnilo.`;

  const tabulka = document.createElement("table");
  tabulka.className = "lekcie-triedy";
  const hlavicka = document.createElement("tr");
  hlavicka.append(bunkaTabulky("th", "Žiak"));
  for (let l = od; l <= po; l++) {
    hlavicka.appendChild(bunkaTabulky("th", `${l}. ${LEKCIE[l - 1].nazov}`));
  }
  tabulka.appendChild(hlavicka);

  for (const ziak of ziaci) {
    const tr = document.createElement("tr");
    if (!ziak.aktivny) tr.classList.add("vypnuty");
    tr.appendChild(bunkaTabulky("td", ziak.meno));
    for (let l = od; l <= po; l++) {
      const td = document.createElement("td");
      if (!zacalLekciu(ziak.id, l)) {
        td.textContent = "–";
        td.className = "sivy";
      } else {
        td.appendChild(hviezdyEl(hviezdyLekcieZiaka(ziak.id, l)));
        if (jeLekciaHotovaZiaka(ziak.id, l)) td.append(" ✓");
        if (zasekolSaVLekcii(ziak.id, l)) {
          td.append(" ⚠");
          td.classList.add("zaseknuty");
        }
      }
      tr.appendChild(td);
    }
    tr.classList.add("klikatelny");
    tr.addEventListener("click", () => {
      vybranyZiak = ziak;          // vysledky-admin.js
      zapamataj("ziak", ziak.id);  // admin.js
      vykresliPrehlad();
      vykresliAnalyzu();
    });
    tabulka.appendChild(tr);
  }

  const suhrn = document.createElement("tr");
  suhrn.className = "suhrn";
  suhrn.appendChild(bunkaTabulky("td", "Splnilo"));
  for (let l = od; l <= po; l++) {
    const splnilo = ziaci.filter((z) => jeLekciaHotovaZiaka(z.id, l)).length;
    suhrn.appendChild(bunkaTabulky("td", `${splnilo} z ${ziaci.length}`));
  }
  tabulka.appendChild(suhrn);
  obal.appendChild(tabulka);
}
