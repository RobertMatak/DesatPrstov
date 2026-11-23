// ===== Nastavenia ročníkov: dĺžka, potrebná presnosť a lekcie =====
// Pre každý ročník 1–9:
//   - počet slov, ktorý žiak napíše v jednom úryvku,
//   - presnosť (%), ktorú potrebuje na postup v knihe a na splnenie cvičenia v lekcii,
//   - lekcie od–do: „do“ = najvyššia prístupná lekcia, „od“ = lekcie na tento rok
//     (nižšie sú na opakovanie). 0–0 = ročník lekcie nemá.
// Ukladá sa do tabuľky dlzky_rocnikov (každý učiteľ má vlastné).
// Keď ročník nemá uloženú hodnotu, platí predvolená (rovnaká ako v databáze).

const PREDVOLENE_DLZKY = [6, 8, 10, 15, 20, 25, 30, 40, 50];         // ročníky 1. až 9.
const PREDVOLENE_PRESNOSTI = [80, 80, 85, 85, 90, 90, 90, 90, 90];  // ročníky 1. až 9.
const PREDVOLENE_LEKCIE_OD = [0, 0, 1, 4, 8, 10, 12, 14, 16];       // rovnaké ako v databáze (faza9.sql)
const PREDVOLENE_LEKCIE_DO = [0, 0, 4, 8, 10, 12, 14, 16, 18];
const MAX_LEKCIA = 18;
const MIN_SLOV = 3;
const MAX_SLOV = 200;
const MIN_PRESNOST = 50;
const MAX_PRESNOST = 100;

let dlzky = [...PREDVOLENE_DLZKY];          // dlzky[0] = 1. ročník … dlzky[8] = 9. ročník
let presnosti = [...PREDVOLENE_PRESNOSTI];
let lekcieOd = [...PREDVOLENE_LEKCIE_OD];
let lekcieDo = [...PREDVOLENE_LEKCIE_DO];

async function nacitajDlzky() {
  let { data, error } = await db.from("dlzky_rocnikov").select("rocnik, slov, presnost, lekcie_od, lekcie_do");
  if (error && error.code === "42703") {
    // Databáza ešte bez lekcií (nespustený faza9.sql): aspoň dĺžky a presnosť
    ({ data, error } = await db.from("dlzky_rocnikov").select("rocnik, slov, presnost"));
    ukazHlasku("V databáze ešte chýbajú lekcie: spusti v Supabase súbor faza9.sql.", true);
  }
  if (error) return ukazHlasku(popisChyby(error), true);

  dlzky = [...PREDVOLENE_DLZKY];
  presnosti = [...PREDVOLENE_PRESNOSTI];
  lekcieOd = [...PREDVOLENE_LEKCIE_OD];
  lekcieDo = [...PREDVOLENE_LEKCIE_DO];
  for (const riadok of data) {
    const i = riadok.rocnik - 1;
    dlzky[i] = riadok.slov;
    if (riadok.presnost) presnosti[i] = riadok.presnost;
    if (riadok.lekcie_od !== null && riadok.lekcie_od !== undefined) lekcieOd[i] = riadok.lekcie_od;
    if (riadok.lekcie_do !== null && riadok.lekcie_do !== undefined) lekcieDo[i] = riadok.lekcie_do;
  }
  vykresliDlzky();
}

function vytvorPole(hodnota, min, max, trieda) {
  const pole = document.createElement("input");
  pole.type = "number";
  pole.min = min;
  pole.max = max;
  pole.value = hodnota;
  pole.className = trieda;
  return pole;
}

function vykresliDlzky() {
  const mriezka = $("dlzkyRocnikov");
  mriezka.innerHTML = "";

  // Hlavička tabuľky
  for (const text of ["Ročník", "Slov", "Presnosť", "Lekcie od–do"]) {
    const bunka = document.createElement("span");
    bunka.className = "dlzky-hlavicka";
    bunka.textContent = text;
    mriezka.appendChild(bunka);
  }

  for (let i = 0; i < 9; i++) {
    const rocnik = document.createElement("span");
    rocnik.textContent = `${i + 1}.`;
    const presnost = document.createElement("label");
    presnost.append(vytvorPole(presnosti[i], MIN_PRESNOST, MAX_PRESNOST, "pole-presnost"), " %");
    const lekcie = document.createElement("label");
    lekcie.append(
      vytvorPole(lekcieOd[i], 0, MAX_LEKCIA, "pole-lekcie-od"), "–",
      vytvorPole(lekcieDo[i], 0, MAX_LEKCIA, "pole-lekcie-do"));
    mriezka.append(rocnik, vytvorPole(dlzky[i], MIN_SLOV, MAX_SLOV, "pole-slov"), presnost, lekcie);
  }
}

// Potrebná presnosť pre vybranú triedu (používa aj vysledky-admin.js)
function potrebnaPresnostTriedy() {
  return vybranaTrieda && vybranaTrieda.rocnik ? presnosti[vybranaTrieda.rocnik - 1] : 90;
}

// Popis pod filtrom náhodných textov: koľko slov píše ročník a akú presnosť potrebuje
function popisRocnika(rocnik) {
  const i = rocnik - 1;
  const lekcie = lekcieDo[i] === 0 ? "Lekcie zatiaľ nemá." : `Robí lekcie ${lekcieOd[i]}–${lekcieDo[i]}.`;
  return `${rocnik}. ročník píše úryvky po približne ${dlzky[i]} slovách, ` +
    `v knihách a lekciách potrebuje presnosť aspoň ${presnosti[i]} %. ${lekcie}`;
}

$("ulozitDlzky").addEventListener("click", () => {
  sTlacidlom($("ulozitDlzky"), async () => {
    const noveDlzky = [...document.querySelectorAll("#dlzkyRocnikov .pole-slov")].map((p) => Number(p.value));
    const novePresnosti = [...document.querySelectorAll("#dlzkyRocnikov .pole-presnost")].map((p) => Number(p.value));
    const noveOd = [...document.querySelectorAll("#dlzkyRocnikov .pole-lekcie-od")].map((p) => Number(p.value));
    const noveDo = [...document.querySelectorAll("#dlzkyRocnikov .pole-lekcie-do")].map((p) => Number(p.value));

    if (noveDlzky.some((n) => !Number.isInteger(n) || n < MIN_SLOV || n > MAX_SLOV)) {
      return ukazHlasku(`Počet slov musí byť celé číslo od ${MIN_SLOV} do ${MAX_SLOV}.`, true);
    }
    if (novePresnosti.some((n) => !Number.isInteger(n) || n < MIN_PRESNOST || n > MAX_PRESNOST)) {
      return ukazHlasku(`Presnosť musí byť celé číslo od ${MIN_PRESNOST} do ${MAX_PRESNOST} %.`, true);
    }
    const zlaLekcia = (n) => !Number.isInteger(n) || n < 0 || n > MAX_LEKCIA;
    if (noveOd.some(zlaLekcia) || noveDo.some(zlaLekcia)) {
      return ukazHlasku(`Lekcie musia byť celé čísla od 0 do ${MAX_LEKCIA} (0 = žiadne).`, true);
    }
    const zlyRozsah = noveOd.findIndex((od, i) => od > noveDo[i] || (od === 0 && noveDo[i] > 0));
    if (zlyRozsah >= 0) {
      return ukazHlasku(`${zlyRozsah + 1}. ročník: lekcie „od“ musí byť aspoň 1 a najviac „do“ (napr. 8–10). ` +
        "Ak ročník lekcie nemá, zadaj 0–0.", true);
    }

    // upsert = vlož nový riadok, alebo uprav existujúci (ak už ročník má hodnotu)
    const { data: prihlasenie } = await db.auth.getSession();
    const riadky = noveDlzky.map((slov, i) => ({
      ucitel_id: prihlasenie.session.user.id,
      rocnik: i + 1,
      slov,
      presnost: novePresnosti[i],
      lekcie_od: noveOd[i],
      lekcie_do: noveDo[i],
    }));
    const { error } = await db.from("dlzky_rocnikov").upsert(riadky);
    if (error) return ukazHlasku(popisChyby(error), true);

    dlzky = noveDlzky;
    presnosti = novePresnosti;
    lekcieOd = noveOd;
    lekcieDo = noveDo;
    vykresliTexty(); // texty-admin.js: popis pod filtrom ročníkov
    ukazHlasku("Nastavenia ročníkov sú uložené. Žiaci ich dostanú pri ďalšom prihlásení alebo obnovení stránky.");
    if (vybranaTrieda) vykresliAnalyzu(); // vysledky-admin.js: upozornenia „zasekol sa“ podľa novej presnosti
  });
});
