// ===== Test rýchlosti (aplikácia žiaka) =====
// Učiteľ vyberie jeden text pre celú školu a obdobie, kedy test beží.
// Žiak píše 1 minútu, potom sa písanie samo zastaví. Výsledok je čistá rýchlosť:
// len správne napísané znaky (5 znakov = 1 slovo). Pokus s presnosťou pod 80 %
// sa do rebríčka nezapočíta. Pokusov je neobmedzene, ráta sa najlepší.
// Údaje o teste a rebríček posiela databáza (funkcia test_pre_ziaka vo faza12.sql).

const DLZKA_TESTU = 60;        // sekúnd
let MIN_PRESNOST_TESTU = 80;   // % (presná hodnota príde zo servera)
let aktualnyTest = null;       // { id, nazov, text, od, do } počas písania testu, inak null
let udajeTestu = null;         // posledná odpoveď servera (test, rebríček, rekord)
let casovacTestu = null;       // časovač, ktorý po minúte ukončí písanie

// "2026-06-30" → "30. 6. 2026"
const formatujDen = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("sk-SK");

// ===== Obrazovka testu: úvod, rebríček, sieň slávy =====
async function ukazTest() {
  aktualnyTest = null;
  aktualnaKapitola = null; // kniznica.js
  aktualneCvicenie = null; // lekcie.js
  ukazObrazovku("test");   // kniznica.js
  podlaId("popisTestu").textContent = "Načítavam test…";
  podlaId("zacatTest").classList.add("skryty");
  for (const id of ["rebricekTestuTrieda", "rebricekTestuSkola", "rekordTestu"]) podlaId(id).innerHTML = "";

  const { data, error } = await db.rpc("test_pre_ziaka", { p_kod: kodZiaka }); // kodZiaka je v ziak.js
  if (error || !data) {
    podlaId("popisTestu").textContent = "Test sa nepodarilo načítať. Skontroluj internet a skús to znova.";
    return;
  }
  udajeTestu = data;
  MIN_PRESNOST_TESTU = data.min_presnost;
  vykresliTest();
}

function vykresliTest() {
  const d = udajeTestu;
  const popis = podlaId("popisTestu");
  podlaId("rekordTestu").innerHTML = "";
  vykresliRekordTestu(d.rekord);

  if (!d.test) {
    podlaId("nadpisTestu").textContent = "Test rýchlosti";
    popis.textContent = "Momentálne neprebieha žiadny test. Keď ho učiteľ spustí, objaví sa tu.";
    podlaId("zacatTest").classList.add("skryty");
    return;
  }

  podlaId("nadpisTestu").textContent = `Test rýchlosti ${d.test.nazov}`;
  popis.textContent = `Píšeš ${DLZKA_TESTU} sekúnd, potom sa písanie samo zastaví. Čas sa spustí prvým písmenom. ` +
    `Ráta sa len správne napísané (5 znakov = 1 slovo) a pokus sa započíta, ak máš presnosť aspoň ${MIN_PRESNOST_TESTU} %. ` +
    `Skúšať môžeš koľkokrát chceš, ráta sa najlepší pokus. Test beží do ${formatujDen(d.test.do)}.` +
    (d.pokusov > 0 ? ` Doteraz si to skúsil ${d.pokusov}×.` : "");
  podlaId("zacatTest").classList.remove("skryty");
  podlaId("zacatTest").textContent = d.pokusov > 0 ? "Skúsiť znova" : "Začať test";

  if (d.ja) {
    vykresliRebricekTestu(podlaId("rebricekTestuTrieda"), d.trieda.nazov, d.trieda, d.ja);
    vykresliRebricekTestu(podlaId("rebricekTestuSkola"), "Škola", d.skola, d.ja);
  } else {
    podlaId("rebricekTestuTrieda").textContent = d.pokusov > 0
      ? `Zatiaľ nemáš započítaný pokus (presnosť aspoň ${MIN_PRESNOST_TESTU} %). Skús to znova, pomalšie a presnejšie!`
      : "Napíš test a uvidíš, na ktorom si mieste v triede aj v škole.";
  }
}

// Tabuľka ako pri lekciách: žiak pred tebou a ty (slová za minútu namiesto ratingu)
function vykresliRebricekTestu(obal, nadpis, rebricek, ja) {
  obal.innerHTML = "";
  const tabulka = document.createElement("table");
  tabulka.className = "rebricek";
  const ziakov = rebricek.pocet === 1 ? "žiak" : rebricek.pocet <= 4 ? "žiaci" : "žiakov";
  tabulka.innerHTML = `<thead><tr><th colspan="4"></th></tr>
    <tr class="stlpce"><th>Umiestnenie</th><th>Meno</th><th>Slov/min</th><th>Chýba</th></tr></thead><tbody></tbody>`;
  tabulka.querySelector("th").textContent = `${nadpis} · ${rebricek.pocet} ${ziakov} v rebríčku`;
  const telo = tabulka.querySelector("tbody");

  const riadok = (bunky, trieda) => {
    const tr = document.createElement("tr");
    if (trieda) tr.className = trieda;
    for (const obsah of bunky) {
      const td = document.createElement("td");
      td.textContent = obsah;
      tr.appendChild(td);
    }
    telo.appendChild(tr);
  };
  if (rebricek.pred) {
    riadok([rebricek.pred.miesto + ".", rebricek.pred.meno, rebricek.pred.rychlost, "-" + (rebricek.pred.rychlost - ja.rychlost)]);
  }
  riadok([rebricek.miesto + ".", "TY", ja.rychlost, "---"], "ty");
  obal.appendChild(tabulka);

  if (rebricek.miesto === 1) {
    const prvy = document.createElement("p");
    prvy.className = "prvy";
    prvy.textContent = "🥇 Si na prvom mieste!";
    obal.appendChild(prvy);
  }
}

// Sieň slávy testu: najrýchlejší všetkých čias
function vykresliRekordTestu(rekord) {
  const tabulka = document.createElement("table");
  tabulka.className = "rebricek rekord";
  tabulka.innerHTML = `<thead><tr><th colspan="4">🏆 Sieň slávy · najrýchlejší všetkých čias</th></tr>
    <tr class="stlpce"><th>Meno</th><th>Trieda</th><th>Školský rok</th><th>Slov/min</th></tr></thead><tbody><tr></tr></tbody>`;
  const tr = tabulka.querySelector("tbody tr");
  const bunky = rekord ? [rekord.meno, rekord.trieda, rekord.rok, rekord.rychlost] : ["Rekord zatiaľ nikto nemá. Môžeš byť prvý!"];
  for (const obsah of bunky) {
    const td = document.createElement("td");
    td.textContent = obsah;
    tr.appendChild(td);
  }
  if (!rekord) tr.firstChild.colSpan = 4;
  podlaId("rekordTestu").appendChild(tabulka);
}

podlaId("zacatTest").addEventListener("click", () => {
  aktualnaKapitola = null;
  aktualneCvicenie = null;
  aktualnyTest = udajeTestu.test;
  ukazObrazovku("pisanie");
  dalsiText(); // pribehy.js → dalsiTextTestu()
});


// ===== Písanie testu =====
// Volá dalsiText (pribehy.js): test sa vždy píše od začiatku
function dalsiTextTestu() {
  clearTimeout(casovacTestu);
  aktualnyUryvok = null;          // pribehy.js
  aktualnyText = aktualnyTest.text; // script.js
  nastavHlavickuPisania(
    `Test rýchlosti ${aktualnyTest.nazov}`,
    `Píšeš ${DLZKA_TESTU} sekúnd, čas sa spustí prvým písmenom. Píš rýchlo, ale presne: pokus sa ráta pri presnosti aspoň ${MIN_PRESNOST_TESTU} %.`,
    true,
    "← Test"
  ); // kniznica.js
  podlaId("zdrojTextu").textContent = "";
  zvyrazniNoveKlavesy(null); // lekcie.js
  zacniCvicenie();           // script.js
  podlaId("text").scrollTop = 0;
}

// Prvé písmeno (volá script.js): spustí odpočet jednej minúty
function spustiOdpocetTestu() {
  clearTimeout(casovacTestu);
  const test = aktualnyTest;
  casovacTestu = setTimeout(() => {
    if (aktualnyTest === test && !hotovo) koniec(); // script.js: písanie sa zastaví
  }, DLZKA_TESTU * 1000);
}

// Dlhý text: posúvanie tak, aby bol aktuálny riadok vždy viditeľný (volá script.js)
function posunTextTestu() {
  const textEl = podlaId("text");
  const span = textEl.children[Math.min(pozicia, textEl.children.length - 1)]; // pozicia je v script.js
  if (!span) return;
  const riadok = parseFloat(getComputedStyle(textEl).lineHeight) || 40;
  const cisloRiadku = Math.floor(span.offsetTop / riadok); // 0 = prvý riadok textu
  // aktuálny riadok bude druhý zhora (prvý je ten, ktorý už žiak dopísal)
  textEl.scrollTop = Math.max(0, (cisloRiadku - 1) * riadok);
}

// ----- Po skončení minúty (volá kniznica.js → poDopisaniUryvku) -----
function poDopisaniTestu(presnost) {
  clearTimeout(casovacTestu);
  const sprava = podlaId("spravaKapitoly");
  const cisloPresnosti = podlaId("vysledokPresnost");
  const rychlost = podlaId("vysledokRychlost").textContent;

  if (presnost < MIN_PRESNOST_TESTU) {
    cisloPresnosti.classList.add("presnost-malo");
    sprava.textContent = `Presnosť ${presnost} % je pod ${MIN_PRESNOST_TESTU} %, tento pokus sa do rebríčka nezapočíta. ` +
      "Skús to znova, trochu pomalšie a presnejšie!";
  } else {
    cisloPresnosti.classList.add("presnost-ok");
    sprava.textContent = `⏱️ Čas vypršal! Napísal si ${rychlost} slov za minútu. Pokus sa započíta do rebríčka, ` +
      "ráta sa tvoj najlepší. Svoje miesto uvidíš tlačidlom ← Test.";
  }
  podlaId("dalsi").textContent = "Skúsiť znova (Enter)";
}
