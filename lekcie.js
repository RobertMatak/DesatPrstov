// ===== Lekcie (aplikácia žiaka) =====
// Obrazovky: mapa lekcií (všetkých 18) a jedna lekcia so zoznamom cvičení.
// Obsah lekcií a hviezdičky sú v lekcie-obsah.js.
//
// Ktoré lekcie žiak vidí, určuje ročník (nastavuje učiteľ, „lekcie od–do“):
//   - lekcie od–do: lekcie na tento rok (budú v rebríčku)
//   - lekcie pod „od“: otvorené na opakovanie
//   - lekcie nad „do“: zamknuté, sú pre starších
// V lekcii sa ďalšie cvičenie odomkne, až keď má žiak v predchádzajúcom
// aspoň potrebnú presnosť (ako v knihách).

let lekcieOd = 0;          // prvá lekcia na tento rok (0 = ročník lekcie nemá)
let lekcieDo = 0;          // posledná prístupná lekcia
let postupLekcii = {};     // "6-2" → najlepšia presnosť v lekcii 6, cvičení 2
let aktualneCvicenie = null; // { lekcia, cvicenie } práve písané cvičenie, inak null
let akciaPoCviceni = null;   // čo urobí Enter po dopísaní: "dalsie", "lekcia" alebo null (znova)
let otvorenaLekcia = null;   // číslo lekcie na obrazovke lekcie (na zapamätanie po F5)

const kluc = (lekcia, cvicenie) => `${lekcia}-${cvicenie}`;

// Po načítaní zo servera (volá pribehy.js). postup = null → ponechať doterajší.
function nastavLekcie(od, po, postup) {
  lekcieOd = od;
  lekcieDo = po;
  if (postup) postupLekcii = postup;
}

// ----- Stav lekcií a hviezdičky -----
function stavLekcie(cislo) {
  if (cislo > lekcieDo) return "zamknuta";
  return cislo >= lekcieOd ? "tento-rok" : "opakovanie";
}

function hviezdyCvicenia(lekcia, cvicenie) {
  return hviezdyZaPresnost(postupLekcii[kluc(lekcia, cvicenie)], potrebnaPresnost); // lekcie-obsah.js, pribehy.js
}

// Hviezdy lekcie = priemer cvičení, zaokrúhlený nadol na polovičky
function hviezdyLekcie(cislo) {
  const pocet = cviceniaLekcie(cislo).length;
  let sucet = 0;
  for (let c = 1; c <= pocet; c++) sucet += hviezdyCvicenia(cislo, c);
  return Math.floor((sucet / pocet) * 2) / 2;
}

function jeLekciaHotova(cislo) {
  const pocet = cviceniaLekcie(cislo).length;
  for (let c = 1; c <= pocet; c++) if (hviezdyCvicenia(cislo, c) === 0) return false;
  return true;
}

const jeCvicenieOdomknute = (lekcia, cvicenie) => cvicenie === 1 || hviezdyCvicenia(lekcia, cvicenie - 1) > 0;

// 3.5 → "3½"
const popisHviezd = (h) => String(Math.floor(h)) + (h % 1 ? "½" : "");

// Päť hviezdičiek, z ktorých je vyplnených "pocet" (aj polovička).
// Sivé hviezdy sú v pozadí, zlaté navrchu, orezané na šírku podľa počtu.
function vytvorHviezdy(pocet) {
  const el = document.createElement("span");
  el.className = "hviezdy";
  el.title = `${popisHviezd(pocet)} z 5 hviezd`;
  const plne = document.createElement("span");
  plne.className = "plne";
  plne.style.width = (pocet / 5) * 100 + "%";
  el.appendChild(plne);
  return el;
}

// ----- Zvýraznenie nových klávesov lekcie na klávesnici -----
function kodyNovychKlavesov(cislo) {
  const l = LEKCIE[cislo - 1];
  const kody = new Set();
  for (const znak of l.nove) {
    for (const krok of krokyPreZnak(znak)) kody.add(krok.kod); // klavesnica.js
  }
  if (l.typ === "shift" || l.typ === "cisla") ["ShiftLeft", "ShiftRight"].forEach((k) => kody.add(k));
  return kody;
}

// cislo = číslo lekcie, alebo null (zrušiť zvýraznenie)
function zvyrazniNoveKlavesy(cislo, kontajner = document.getElementById("klavesnica")) {
  kontajner.querySelectorAll(".klaves.nova").forEach((k) => k.classList.remove("nova"));
  if (!cislo) return;
  const kody = kodyNovychKlavesov(cislo);
  kontajner.querySelectorAll(".klaves").forEach((k) => {
    if (kody.has(k.dataset.kod)) k.classList.add("nova");
  });
}


// ===== Mapa lekcií =====
function ukazLekcie() {
  aktualneCvicenie = null;
  aktualnaKapitola = null; // kniznica.js
  aktualnyTest = null;     // test.js

  const popis = podlaId("popisLekcii"); // podlaId je z kniznica.js
  if (lekcieDo === 0) {
    popis.textContent = "Lekcie začínajú v 3. ročníku. Zatiaľ si precvičuj náhodné texty.";
  } else {
    popis.textContent = (lekcieOd > 0 ? `Tento rok ťa čakajú lekcie ${lekcieOd}–${lekcieDo}. ` : "") +
      (lekcieOd > 1 ? "Staršie lekcie si môžeš zopakovať. " : "") +
      `Cvičenie splníš s presnosťou aspoň ${potrebnaPresnost} %, za vyššiu presnosť dostaneš viac hviezd.`;
  }

  const mapa = podlaId("mapaLekcii");
  mapa.innerHTML = "";
  for (const l of LEKCIE) {
    const stav = stavLekcie(l.cislo);
    const dlazdica = document.createElement("button");
    dlazdica.className = "dlazdica-lekcie " + stav;
    if (jeLekciaHotova(l.cislo)) dlazdica.classList.add("hotova");

    const cislo = document.createElement("div");
    cislo.className = "cislo";
    cislo.textContent = l.cislo;
    const klavesy = document.createElement("div");
    klavesy.className = "klavesy";
    klavesy.textContent = l.nazov;
    const stitok = document.createElement("div");
    stitok.className = "stitok";
    stitok.textContent = stav === "zamknuta" ? "🔒 pre starších" : stav === "tento-rok" ? "tento rok" : "opakovanie";

    dlazdica.append(cislo, klavesy, vytvorHviezdy(hviezdyLekcie(l.cislo)), stitok);
    if (stav === "zamknuta") {
      dlazdica.disabled = true;
      dlazdica.title = "Táto lekcia je pre vyšší ročník.";
    } else {
      dlazdica.addEventListener("click", () => ukazLekciu(l.cislo));
    }
    mapa.appendChild(dlazdica);
  }
  ukazObrazovku("lekcie"); // kniznica.js
}


// ===== Jedna lekcia: úvod a cvičenia =====
function ukazLekciu(cislo) {
  aktualneCvicenie = null;
  aktualnaKapitola = null;
  aktualnyTest = null;
  otvorenaLekcia = cislo;
  const l = LEKCIE[cislo - 1];

  podlaId("nadpisLekcie").textContent = `Lekcia ${cislo}: ${l.nazov}`;
  podlaId("tipLekcie").textContent = l.tip;
  const hviezdy = podlaId("hviezdyLekcie");
  hviezdy.innerHTML = "";
  hviezdy.appendChild(vytvorHviezdy(hviezdyLekcie(cislo)));
  if (jeLekciaHotova(cislo)) hviezdy.append(" ✓ Lekcia je splnená");

  // Malá klávesnica s vyznačenými novými klávesmi
  const klavesnica = podlaId("klavesnicaLekcie");
  vykresliKlavesnicu(klavesnica); // klavesnica.js
  zvyrazniNoveKlavesy(cislo, klavesnica);

  const zoznam = podlaId("zoznamCviceni");
  zoznam.innerHTML = "";
  cviceniaLekcie(cislo).forEach((cv, i) => {
    const c = i + 1;
    const odomknute = jeCvicenieOdomknute(cislo, c);
    const h = hviezdyCvicenia(cislo, c);
    const najlepsia = postupLekcii[kluc(cislo, c)];

    const li = document.createElement("li");
    if (!odomknute) li.classList.add("zamknuta");
    const info = document.createElement("div");
    info.className = "kapitola-info";
    const nazov = document.createElement("div");
    nazov.className = "kapitola-nazov";
    nazov.textContent = `${c}. ${cv.nazov}`;
    const stav = document.createElement("div");
    stav.className = "kapitola-stav";
    if (!odomknute) {
      stav.textContent = `🔒 Najprv splň predchádzajúce cvičenie (presnosť aspoň ${potrebnaPresnost} %)`;
    } else {
      stav.appendChild(vytvorHviezdy(h));
      stav.append(najlepsia === undefined ? " Nezačaté"
        : h > 0 ? ` Najlepšia presnosť ${najlepsia} %`
        : ` Najlepšia presnosť ${najlepsia} %, potrebuješ ${potrebnaPresnost} %`);
    }
    info.append(nazov, stav);
    li.appendChild(info);

    if (odomknute) {
      const tlacidlo = document.createElement("button");
      tlacidlo.textContent = najlepsia === undefined ? "Začať" : "Písať znova";
      if (h > 0) tlacidlo.className = "druhotne";
      tlacidlo.addEventListener("click", () => otvorCvicenie(cislo, c));
      li.appendChild(tlacidlo);
    }
    zoznam.appendChild(li);
  });

  ukazObrazovku("lekcia");
  nacitajRebricek(cislo);
}

podlaId("spatNaLekcie").addEventListener("click", ukazLekcie);


// ===== Rebríček lekcie =====
// Žiak vidí len svoje miesto v triede a v škole a jedného žiaka tesne pred sebou.
// Rating = priemer najlepších bodov z cvičení lekcie, body = rýchlosť × presnosť³
// (počíta ich databáza, funkcia rebricek_lekcie vo faza11.sql).
let lekciaRebricka = null; // ktorej lekcie rebríček práve čakáme (ak žiak medzitým odíde, odpoveď zahodíme)

// 31.1 → "31,1"
const formatujBody = (n) => Number(n).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

async function nacitajRebricek(cislo) {
  const sekcia = podlaId("rebricekLekcie");
  const popis = podlaId("popisRebricka");
  podlaId("rebricekTrieda").innerHTML = "";
  podlaId("rebricekSkola").innerHTML = "";
  podlaId("rebricekRekord").innerHTML = "";
  sekcia.classList.remove("skryty");
  lekciaRebricka = cislo;
  popis.textContent = "Načítavam rebríček…";

  const { data, error } = await db.rpc("rebricek_lekcie", { p_kod: kodZiaka, p_lekcia: cislo }); // kodZiaka je v ziak.js
  if (lekciaRebricka !== cislo) return; // žiak medzitým otvoril inú lekciu
  if (error || !data) {
    sekcia.classList.add("skryty"); // napr. databáza ešte bez rebríčkov
    return;
  }
  if (data.rekord !== undefined) vykresliRekord(data.rekord); // sieň slávy (faza11b.sql)

  if (stavLekcie(cislo) === "opakovanie") {
    popis.textContent = "Táto lekcia je na opakovanie, do rebríčka sa nepočíta. V rebríčku sú lekcie na tento rok.";
    return;
  }

  let text = "Rating = priemer najlepších bodov z každého cvičenia. Body = rýchlosť × presnosť³, " +
    "takže presnosť znamená viac ako rýchlosť.";
  if (!data.ja) {
    text = "Zatiaľ nemáš v tejto lekcii body. Napíš cvičenia a uvidíš, na ktorom si mieste. " + text;
  } else if (data.ja.cviceni < data.pocet_cviceni) {
    text = `Máš napísané ${data.ja.cviceni} z ${data.pocet_cviceni} cvičení. ` +
      "Nenapísané cvičenie má 0 bodov, oplatí sa spraviť všetky. " + text;
  }
  popis.textContent = text;
  if (!data.ja) return;

  vykresliRebricek(podlaId("rebricekTrieda"), data.trieda.nazov, data.trieda, data.ja);
  vykresliRebricek(podlaId("rebricekSkola"), "Škola", data.skola, data.ja);
}

// Sieň slávy: rekord lekcie všetkých čias (aj od žiakov, ktorí už zo školy odišli)
function vykresliRekord(rekord) {
  const obal = podlaId("rebricekRekord");
  const tabulka = document.createElement("table");
  tabulka.className = "rebricek rekord";
  const hlava = document.createElement("thead");
  hlava.innerHTML = '<tr><th colspan="4">🏆 Sieň slávy · rekord lekcie všetkých čias</th></tr>' +
    '<tr class="stlpce"><th>Meno</th><th>Trieda</th><th>Školský rok</th><th>Rating</th></tr>';
  const telo = document.createElement("tbody");
  const tr = document.createElement("tr");
  const bunky = rekord
    ? [rekord.meno, rekord.trieda, rekord.rok, formatujBody(rekord.body)]
    : ["Rekord zatiaľ nikto nemá. Môžeš byť prvý!", "", "", ""];
  for (const obsah of bunky) {
    const td = document.createElement("td");
    td.textContent = obsah;
    tr.appendChild(td);
  }
  if (!rekord) {
    tr.firstChild.colSpan = 4;
    while (tr.children.length > 1) tr.lastChild.remove();
  }
  telo.appendChild(tr);
  tabulka.append(hlava, telo);
  obal.appendChild(tabulka);
}

// Tabuľka: nadpis (trieda alebo Škola), žiak pred tebou a ty
//  |              6.D                |
//  | Umiestnenie | Meno | Rating | Chýba |
//  |     6.      | Jano S. | 33,0 | -1,9 |
//  |     7.      |   TY    | 31,1 |  ---  |
function vykresliRebricek(obal, nadpis, rebricek, ja) {
  const tabulka = document.createElement("table");
  tabulka.className = "rebricek";

  const riadok = (bunky, trieda) => {
    const tr = document.createElement("tr");
    if (trieda) tr.className = trieda;
    for (const obsah of bunky) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    return tr;
  };

  const hlava = document.createElement("thead");
  const nadpisTr = document.createElement("tr");
  const th = document.createElement("th");
  th.colSpan = 4;
  th.textContent = `${nadpis} · ${rebricek.pocet} ${rebricek.pocet === 1 ? "žiak" : rebricek.pocet <= 4 ? "žiaci" : "žiakov"} v rebríčku`;
  nadpisTr.appendChild(th);
  const stlpce = document.createElement("tr");
  stlpce.className = "stlpce";
  for (const nazov of ["Umiestnenie", "Meno", "Rating", "Chýba"]) {
    const t = document.createElement("th");
    t.textContent = nazov;
    stlpce.appendChild(t);
  }
  hlava.append(nadpisTr, stlpce);

  const telo = document.createElement("tbody");
  if (rebricek.pred) {
    telo.appendChild(riadok([
      rebricek.pred.miesto + ".",
      rebricek.pred.meno,
      formatujBody(rebricek.pred.body),
      "-" + formatujBody(Math.round((rebricek.pred.body - ja.body) * 10) / 10), // zaokrúhlenie kvôli desatinným číslam v počítači
    ]));
  }
  telo.appendChild(riadok([rebricek.miesto + ".", "TY", formatujBody(ja.body), "---"], "ty"));
  tabulka.append(hlava, telo);
  obal.appendChild(tabulka);

  if (rebricek.miesto === 1) {
    const prvy = document.createElement("p");
    prvy.className = "prvy";
    prvy.textContent = "🥇 Si na prvom mieste!";
    obal.appendChild(prvy);
  }
}


// ===== Písanie cvičenia =====
function otvorCvicenie(lekcia, cvicenie) {
  aktualnaKapitola = null;
  aktualnyTest = null; // test.js
  aktualneCvicenie = { lekcia, cvicenie };
  akciaPoCviceni = null;
  ukazObrazovku("pisanie");
  dalsiText(); // pribehy.js → dalsiTextLekcie()
}

// Dĺžka cvičenia: podľa ročníka, ale aspoň 8 a najviac 30 „slov“
const dlzkaCvicenia = () => Math.min(30, Math.max(8, slovNaUryvok)); // pribehy.js

// Volá dalsiText (pribehy.js): nový text cvičenia, ďalšie cvičenie, alebo späť na lekciu
function dalsiTextLekcie() {
  const akcia = akciaPoCviceni;
  akciaPoCviceni = null;
  if (akcia === "lekcia") return ukazLekciu(aktualneCvicenie.lekcia);
  if (akcia === "dalsie") aktualneCvicenie.cvicenie++;

  const { lekcia, cvicenie } = aktualneCvicenie;
  const cvicenia = cviceniaLekcie(lekcia);
  const cv = cvicenia[cvicenie - 1];
  aktualnyUryvok = null;              // pribehy.js
  aktualnyText = cv.text(dlzkaCvicenia()); // script.js

  nastavHlavickuPisania(
    `Lekcia ${lekcia}: ${LEKCIE[lekcia - 1].nazov}`,
    `Cvičenie ${cvicenie} z ${cvicenia.length}: ${cv.nazov} · potrebná presnosť ${potrebnaPresnost} %`,
    true,
    "← Lekcia"
  ); // kniznica.js
  podlaId("zdrojTextu").textContent = "";
  zvyrazniNoveKlavesy(lekcia);
  zacniCvicenie(); // script.js
}

// ----- Po dopísaní cvičenia (volá kniznica.js → poDopisaniUryvku) -----
function poDopisaniCvicenia(presnost) {
  const { lekcia, cvicenie } = aktualneCvicenie;
  const sprava = podlaId("spravaKapitoly");
  const dalsi = podlaId("dalsi");
  const cisloPresnosti = podlaId("vysledokPresnost");

  // Najlepšia presnosť v cvičení (na server ide s výsledkom, tu len v pamäti)
  const k = kluc(lekcia, cvicenie);
  const predtym = hviezdyCvicenia(lekcia, cvicenie);
  if (postupLekcii[k] === undefined || presnost > postupLekcii[k]) postupLekcii[k] = presnost;

  const hviezdy = hviezdyZaPresnost(presnost, potrebnaPresnost);
  sprava.innerHTML = "";

  if (hviezdy === 0) {
    cisloPresnosti.classList.add("presnost-malo");
    sprava.textContent = `Presnosť ${presnost} %. Na splnenie cvičenia potrebuješ aspoň ${potrebnaPresnost} %. ` +
      "Skús to ešte raz, pomaly a presne!";
    dalsi.textContent = "Skúsiť znova (Enter)";
    akciaPoCviceni = null;
    return;
  }

  cisloPresnosti.classList.add("presnost-ok");
  const pocetCviceni = cviceniaLekcie(lekcia).length;
  sprava.appendChild(vytvorHviezdy(hviezdy));
  let text = ` ${popisHviezd(hviezdy)} z 5 hviezd za presnosť ${presnost} %.`;
  if (hviezdy > predtym && predtym > 0) text += " Zlepšil si sa!";
  if (hviezdy < 5) text += " Za 5 hviezd napíš cvičenie bez chyby.";

  if (cvicenie < pocetCviceni) {
    dalsi.textContent = "Ďalšie cvičenie (Enter)";
    akciaPoCviceni = "dalsie";
  } else {
    if (jeLekciaHotova(lekcia)) text += ` 🎉 Lekcia ${lekcia} je splnená!`;
    dalsi.textContent = "Späť na lekciu (Enter)";
    akciaPoCviceni = "lekcia";
  }
  sprava.append(text);
}
