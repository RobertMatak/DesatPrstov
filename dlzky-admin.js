// ===== Úryvky podľa ročníkov: dĺžka a potrebná presnosť =====
// Pre každý ročník 1–9:
//   - počet slov, ktorý žiak napíše v jednom úryvku,
//   - presnosť (%), ktorú potrebuje na postup v knihe.
// Ukladá sa do tabuľky dlzky_rocnikov (každý učiteľ má vlastné).
// Keď ročník nemá uloženú hodnotu, platí predvolená (rovnaká ako v databáze).

const PREDVOLENE_DLZKY = [6, 8, 10, 15, 20, 25, 30, 40, 50];         // ročníky 1. až 9.
const PREDVOLENE_PRESNOSTI = [80, 80, 85, 85, 90, 90, 90, 90, 90];  // ročníky 1. až 9.
const MIN_SLOV = 3;
const MAX_SLOV = 200;
const MIN_PRESNOST = 50;
const MAX_PRESNOST = 100;

let dlzky = [...PREDVOLENE_DLZKY];          // dlzky[0] = 1. ročník … dlzky[8] = 9. ročník
let presnosti = [...PREDVOLENE_PRESNOSTI];

async function nacitajDlzky() {
  const { data, error } = await db.from("dlzky_rocnikov").select("rocnik, slov, presnost");
  if (error) return ukazHlasku(popisChyby(error), true);

  dlzky = [...PREDVOLENE_DLZKY];
  presnosti = [...PREDVOLENE_PRESNOSTI];
  for (const riadok of data) {
    dlzky[riadok.rocnik - 1] = riadok.slov;
    if (riadok.presnost) presnosti[riadok.rocnik - 1] = riadok.presnost;
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
  for (const text of ["Ročník", "Slov", "Presnosť"]) {
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
    mriezka.append(rocnik, vytvorPole(dlzky[i], MIN_SLOV, MAX_SLOV, "pole-slov"), presnost);
  }
}

// Potrebná presnosť pre vybranú triedu (používa aj vysledky-admin.js)
function potrebnaPresnostTriedy() {
  return vybranaTrieda && vybranaTrieda.rocnik ? presnosti[vybranaTrieda.rocnik - 1] : 90;
}

// Text v záložke Náhodné texty: koľko slov píše vybraná trieda
function popisDlzkyTriedy() {
  if (!vybranaTrieda || !vybranaTrieda.rocnik) return "";
  const i = vybranaTrieda.rocnik - 1;
  return `Trieda ${vybranaTrieda.nazov} píše úryvky po približne ${dlzky[i]} slovách ` +
    `a v knihách potrebuje presnosť aspoň ${presnosti[i]} %.`;
}

$("ulozitDlzky").addEventListener("click", () => {
  sTlacidlom($("ulozitDlzky"), async () => {
    const noveDlzky = [...document.querySelectorAll("#dlzkyRocnikov .pole-slov")].map((p) => Number(p.value));
    const novePresnosti = [...document.querySelectorAll("#dlzkyRocnikov .pole-presnost")].map((p) => Number(p.value));

    if (noveDlzky.some((n) => !Number.isInteger(n) || n < MIN_SLOV || n > MAX_SLOV)) {
      return ukazHlasku(`Počet slov musí byť celé číslo od ${MIN_SLOV} do ${MAX_SLOV}.`, true);
    }
    if (novePresnosti.some((n) => !Number.isInteger(n) || n < MIN_PRESNOST || n > MAX_PRESNOST)) {
      return ukazHlasku(`Presnosť musí byť celé číslo od ${MIN_PRESNOST} do ${MAX_PRESNOST} %.`, true);
    }

    // upsert = vlož nový riadok, alebo uprav existujúci (ak už ročník má hodnotu)
    const { data: prihlasenie } = await db.auth.getSession();
    const riadky = noveDlzky.map((slov, i) => ({
      ucitel_id: prihlasenie.session.user.id,
      rocnik: i + 1,
      slov,
      presnost: novePresnosti[i],
    }));
    const { error } = await db.from("dlzky_rocnikov").upsert(riadky);
    if (error) return ukazHlasku(popisChyby(error), true);

    dlzky = noveDlzky;
    presnosti = novePresnosti;
    $("dlzkaPreTriedu").textContent = popisDlzkyTriedy();
    ukazHlasku("Nastavenia úryvkov sú uložené. Žiaci ich dostanú pri ďalšom prihlásení alebo obnovení stránky.");
    if (vybranaTrieda) vykresliAnalyzu(); // vysledky-admin.js: upozornenia „zasekol sa“ podľa novej presnosti
  });
});
